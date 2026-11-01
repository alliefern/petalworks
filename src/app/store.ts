/**
 * GameStore: the single owner of the simulation at runtime. Runs the fixed-tick loop,
 * applies player actions, keeps UI state shared by React and Phaser, and autosaves.
 * React subscribes via useSyncExternalStore; Phaser reads it directly every frame.
 */
import { TICK_MS } from '../sim/data/balance';
import { ORDERS } from '../sim/data/orders';
import { STRUCTURES } from '../sim/data/structures';
import { createWorld, Sim } from '../sim/game';
import { currentOrder, isSandbox } from '../sim/orders';
import { DEFAULT_UI_STATE, deserialize, localStorageStore, memoryStore, serialize, type SaveStore, type UiSaveState } from '../sim/save';
import type { Action, ActionResult, Dir, ItemKind, SimEvent, StructureKind } from '../sim/types';
import { audio } from './audio';

export type Tool =
  | { type: 'select' }
  | { type: 'build'; kind: StructureKind }
  | { type: 'remove' }
  | { type: 'basket'; kind: ItemKind };

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
  until: number;
}

export type Screen = 'title' | 'game';

export interface UiState {
  screen: Screen;
  tool: Tool;
  selectedId: number | null;
  hover: { x: number; y: number } | null;
  buildFacing: Dir;
  paused: boolean;
  speed: 1 | 2 | 3;
  notices: Notice[];
  settings: UiSaveState;
  tutorialOpen: boolean;
  settingsOpen: boolean;
  completionOpen: boolean;
  paletteOpen: boolean;
  hasSave: boolean;
  /** Set when a save failed to load so the title screen can explain. */
  saveProblem: string | null;
  /** Milliseconds of sim time elapsed; drives sim-synced animation. */
  simTimeMs: number;
  /** Last pointer position in page pixels, for the floating build hint. */
  pointer: { x: number; y: number };
  dragPath: Array<{ x: number; y: number }> | null;
}

type Listener = () => void;

export class GameStore {
  sim: Sim;
  ui: UiState;
  /** Interpolation factor between the last tick and the next (0..1). */
  alpha = 0;
  version = 0;
  /** Events produced since the renderer last drained them. */
  pendingEvents: SimEvent[] = [];
  private listeners = new Set<Listener>();
  private acc = 0;
  private raf: number | null = null;
  private lastFrame = 0;
  private lastAutosave = 0;
  private noticeId = 1;
  private storage: SaveStore;

  constructor(storage?: SaveStore) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorageStore() : memoryStore());
    this.sim = new Sim(createWorld());
    const existing = this.storage.get();
    this.ui = {
      screen: 'title',
      tool: { type: 'select' },
      selectedId: null,
      hover: null,
      buildFacing: 1,
      paused: false,
      speed: 1,
      notices: [],
      settings: { ...DEFAULT_UI_STATE },
      tutorialOpen: true,
      settingsOpen: false,
      completionOpen: false,
      paletteOpen: true,
      hasSave: !!existing,
      saveProblem: null,
      simTimeMs: 0,
      pointer: { x: 0, y: 0 },
      dragPath: null,
    };
  }

  // ---- subscription -------------------------------------------------------------
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  setUi(patch: Partial<UiState>): void {
    this.ui = { ...this.ui, ...patch };
    this.emit();
  }

  // ---- lifecycle ------------------------------------------------------------------
  newGame(): void {
    this.sim = new Sim(createWorld());
    this.ui = {
      ...this.ui,
      screen: 'game',
      tool: { type: 'select' },
      selectedId: null,
      paused: false,
      speed: 1,
      settings: { ...DEFAULT_UI_STATE, soundOn: this.ui.settings.soundOn, musicOn: this.ui.settings.musicOn, reducedMotion: this.ui.settings.reducedMotion },
      tutorialOpen: true,
      completionOpen: false,
      notices: [],
      simTimeMs: 0,
      saveProblem: null,
    };
    this.acc = 0;
    this.save();
    this.start();
    this.emit();
  }

  continueGame(): boolean {
    const result = deserialize(this.storage.get());
    if (!result.ok) {
      this.setUi({ saveProblem: `Your saved garden could not be read (${result.reason}).`, hasSave: false });
      return false;
    }
    this.sim = result.sim;
    this.ui = {
      ...this.ui,
      screen: 'game',
      tool: { type: 'select' },
      selectedId: null,
      settings: result.ui,
      speed: result.ui.speed as 1 | 2 | 3,
      paused: false,
      tutorialOpen: !result.ui.tutorialDismissed,
      completionOpen: false,
      notices: [],
      simTimeMs: 0,
      saveProblem: null,
    };
    audio.setSound(result.ui.soundOn);
    audio.setMusic(result.ui.musicOn);
    this.acc = 0;
    this.start();
    this.emit();
    return true;
  }

  start(): void {
    if (this.raf !== null || typeof requestAnimationFrame === 'undefined') return;
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(250, now - this.lastFrame);
      this.lastFrame = now;
      this.advance(dt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  /** Advance real time; runs whole fixed ticks and leaves the remainder for interpolation. */
  advance(dtMs: number): void {
    if (this.ui.screen !== 'game') return;
    const blocked = this.ui.paused || this.ui.settingsOpen || this.ui.completionOpen;
    if (!blocked) {
      this.acc += dtMs * this.ui.speed;
      let ticked = false;
      let guard = 0;
      while (this.acc >= TICK_MS && guard++ < 60) {
        this.acc -= TICK_MS;
        const events = this.sim.step();
        this.handleEvents(events);
        ticked = true;
      }
      this.alpha = this.acc / TICK_MS;
      this.ui.simTimeMs = this.sim.world.tick * TICK_MS + this.acc;
      if (ticked) this.emit();
    }
    this.pruneNotices();
    if (performance.now() - this.lastAutosave > 10_000) this.save();
  }

  /** Run the sim forward by N ticks instantly (used by tests and the e2e harness). */
  fastForward(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.handleEvents(this.sim.step());
    this.emit();
  }

  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      this.pendingEvents.push(e);
      switch (e.type) {
        case 'order_complete': {
          const order = ORDERS.find((o) => o.id === e.orderId);
          this.notify(`Order complete: ${order?.title ?? ''}. +${e.reward} coins!`, 'good', 5000);
          audio.play('order_complete');
          this.save();
          break;
        }
        case 'unlocked': {
          const names = e.kinds.map((k) => STRUCTURES[k].name);
          if (e.expansion) names.push('Garden expansion');
          if (names.length && this.sim.world.orderIndex > 0) {
            this.notify(`Unlocked: ${names.join(', ')}`, 'good', 6000);
            audio.play('unlock');
          }
          break;
        }
        case 'all_orders_complete':
          if (!this.ui.settings.seenCompletion) {
            this.ui.completionOpen = true;
            this.ui.settings = { ...this.ui.settings, seenCompletion: true };
          }
          break;
        case 'crafted':
          audio.play('pop');
          break;
        case 'delivered':
          audio.play('deliver');
          break;
        default:
          break;
      }
    }
    if (this.pendingEvents.length > 500) this.pendingEvents.splice(0, this.pendingEvents.length - 500);
  }

  drainEvents(): SimEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  // ---- actions ----------------------------------------------------------------------
  dispatch(action: Action): ActionResult {
    const events: SimEvent[] = [];
    const result = this.sim.dispatch(action, events);
    this.handleEvents(events);
    if (result.ok) {
      switch (action.type) {
        case 'place':
        case 'place_belt_path':
          audio.play('place');
          break;
        case 'rotate':
          audio.play('rotate');
          break;
        case 'remove':
          audio.play('remove');
          if (this.ui.selectedId === action.id) this.ui.selectedId = null;
          break;
        case 'undo':
          audio.play('remove');
          if (this.ui.selectedId !== null && !this.sim.world.structures[this.ui.selectedId]) this.ui.selectedId = null;
          break;
        case 'expand':
          audio.play('unlock');
          this.notify('The garden is bigger now. More room to build!', 'good');
          break;
        default:
          break;
      }
      if (result.message) this.notify(result.message, 'info');
      this.save();
    } else {
      audio.play('invalid');
      if (result.message) this.notify(result.message, 'bad');
    }
    this.emit();
    return result;
  }

  notify(text: string, tone: Notice['tone'] = 'info', ms = 3200): void {
    const now = performance.now();
    // Collapse duplicates so a held key does not spam.
    const notices = this.ui.notices.filter((n) => n.text !== text);
    notices.push({ id: this.noticeId++, text, tone, until: now + ms });
    this.ui = { ...this.ui, notices: notices.slice(-4) };
    this.emit();
  }

  private pruneNotices(): void {
    const now = performance.now();
    if (this.ui.notices.some((n) => n.until <= now)) {
      this.ui = { ...this.ui, notices: this.ui.notices.filter((n) => n.until > now) };
      this.emit();
    }
  }

  // ---- ui helpers -------------------------------------------------------------------
  setTool(tool: Tool): void {
    this.setUi({ tool, selectedId: tool.type === 'select' ? this.ui.selectedId : null, dragPath: null });
  }

  select(id: number | null): void {
    this.setUi({ selectedId: id, tool: { type: 'select' } });
  }

  rotateBuildFacing(): void {
    this.setUi({ buildFacing: ((this.ui.buildFacing + 1) % 4) as Dir });
    audio.play('rotate');
  }

  togglePause(): void {
    this.setUi({ paused: !this.ui.paused });
  }

  setSpeed(speed: 1 | 2 | 3): void {
    this.ui.settings = { ...this.ui.settings, speed };
    this.setUi({ speed, paused: false });
  }

  updateSettings(patch: Partial<UiSaveState>): void {
    const settings = { ...this.ui.settings, ...patch };
    audio.setSound(settings.soundOn);
    audio.setMusic(settings.musicOn);
    this.setUi({ settings });
    this.save();
  }

  dismissTutorial(): void {
    this.updateSettings({ tutorialDismissed: true });
    this.setUi({ tutorialOpen: false });
  }

  setTutorialStep(step: number): void {
    this.updateSettings({ tutorialStep: step });
  }

  reducedMotion(): boolean {
    const s = this.ui.settings.reducedMotion;
    if (s === 'on') return true;
    if (s === 'off') return false;
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---- persistence -----------------------------------------------------------------
  save(): void {
    if (this.ui.screen !== 'game') return;
    this.storage.set(serialize(this.sim, this.ui.settings));
    this.lastAutosave = performance.now();
    if (!this.ui.hasSave) this.setUi({ hasSave: true });
  }

  clearSave(): void {
    this.storage.clear();
    this.setUi({ hasSave: false });
  }

  // ---- derived -----------------------------------------------------------------------
  get order() {
    return currentOrder(this.sim.world);
  }

  get sandbox(): boolean {
    return isSandbox(this.sim.world);
  }
}

export const store = new GameStore();

// Expose for the e2e harness and debugging.
declare global {
  interface Window {
    petalworks?: GameStore;
  }
}
if (typeof window !== 'undefined') window.petalworks = store;
