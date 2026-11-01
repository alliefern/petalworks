/**
 * GameStore: the single owner of the simulation at runtime. Runs the fixed-tick loop,
 * applies player actions, keeps UI state shared by React and Phaser, and autosaves.
 * React subscribes via useSyncExternalStore; Phaser reads it directly every frame.
 */
import { TICK_MS } from '../sim/data/balance';
import { ORDERS, orderIndex } from '../sim/data/orders';
import { STRUCTURES } from '../sim/data/structures';
import { PLOTS } from '../sim/data/plots';
const PLOT_COST = PLOTS[1].cost;
import { createWorld, Sim } from '../sim/game';
import { currentOrder, isSandbox } from '../sim/orders';
import { DEFAULT_SETTINGS, deserialize, localStorageStore, memoryStore, serialize, type SaveStore, type Settings } from '../sim/save';
import type { Action, ActionResult, BlockReason, Dir, ItemKind, SimEvent, Structure, StructureKind } from '../sim/types';
import { blockCopy, buildingName, COPY, EXTRA, facingWord, fmt, itemName, orderCopy } from '../ui/strings';
import { audio } from './audio';
import { shell } from './shell';

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
  key?: string;
}

export interface BlockedLabel {
  id: number;
  text: string;
  until: number;
}

export type Screen = 'title' | 'game';

export interface Celebration {
  orderId: string;
  reward: number;
  unlockLine: string | null;
  final: boolean;
  until: number;
}

export interface UiState {
  screen: Screen;
  tool: Tool;
  selectedId: number | null;
  hover: { x: number; y: number } | null;
  /** Keyboard cursor on the garden (null until the garden is focused and an arrow pressed). */
  cursor: { x: number; y: number } | null;
  buildFacing: Dir;
  paused: boolean;
  speed: 1 | 2 | 3;
  notices: Notice[];
  settings: Settings;
  tutorialOpen: boolean;
  settingsOpen: boolean;
  completionOpen: boolean;
  paletteOpen: boolean;
  hasSave: boolean;
  /** Set when a save failed to load so the title screen can explain. */
  saveProblem: string | null;
  /** Milliseconds of sim time elapsed; drives sim-synced animation. */
  simTimeMs: number;
  /** Belt path being laid by drag or by keyboard. */
  dragPath: Array<{ x: number; y: number }> | null;
  /** True while the keyboard is laying a belt path (Enter started it). */
  keyPathActive: boolean;
  celebration: Celebration | null;
  /** Text for the polite live region describing the cursor tile. */
  announce: string;
  /** Short-lived labels drawn beside blocked buildings. */
  blockedLabels: BlockedLabel[];
}

type Listener = () => void;

/** One-line block message (label + detail) in copy.json's words. */
export function blockText(reason: BlockReason, item?: ItemKind | null, target?: string, onBelt = false): string {
  const c = blockCopy(reason, { item, target, onBelt });
  return c.label ? `${c.label}. ${c.detail}` : '';
}

/** Map a sim action result to the final copy, filling cost/coins placeholders. */
function messageFor(result: ActionResult, action: Action, coins: number): string | undefined {
  const e = COPY.errors;
  switch (result.error) {
    case 'occupied':
      return e.occupied;
    case 'out_of_bounds':
      return e.outside;
    case 'locked_plot':
      return e.lockedPlot;
    case 'locked':
      return e.locked;
    case 'unaffordable': {
      if (action.type === 'place_belt_path' && result.ids?.length) return e.fundsPath;
      if (action.type === 'expand') return fmt(COPY.expansion.cantAfford, { cost: PLOT_COST, coins });
      const cost = action.type === 'place' ? STRUCTURES[action.kind].cost : action.type === 'place_belt_path' ? STRUCTURES.belt.cost : 0;
      if (action.type === 'undo') return EXTRA.errors.undoFunds;
      return fmt(e.funds, { cost, coins });
    }
    case 'nothing_to_undo':
      return e.undoEmpty;
    case 'undo_unsafe':
      return result.message?.includes('taken') ? EXTRA.errors.undoTaken : e.undoUnsafe;
    case 'not_removable':
      return fmt(EXTRA.errors.notRemovable, { name: buildingName('packing_station') });
    case 'unknown_structure':
      return action.type === 'remove' ? e.removeEmpty : undefined;
    case 'not_a_belt':
      return e.basketPlace;
    case 'belt_occupied':
      return e.beltFull;
    case 'basket_empty':
      return EXTRA.errors.basketEmpty;
    case 'expansion_locked':
      return EXTRA.errors.expansionLocked;
    case 'already_expanded':
      return EXTRA.errors.expansionDone;
    case 'invalid':
      return action.type === 'rotate' ? EXTRA.errors.packingNoFacing : undefined;
    default:
      return undefined;
  }
}

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
  private announceTimer: number | null = null;

  constructor(storage?: SaveStore) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorageStore() : memoryStore());
    this.sim = new Sim(createWorld());
    const existing = this.storage.get();
    const prefersReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ui = {
      screen: 'title',
      tool: { type: 'select' },
      selectedId: null,
      hover: null,
      cursor: null,
      buildFacing: 1,
      paused: false,
      speed: 1,
      notices: [],
      settings: { ...DEFAULT_SETTINGS, reducedMotion: prefersReduced },
      tutorialOpen: true,
      settingsOpen: false,
      completionOpen: false,
      paletteOpen: true,
      hasSave: !!existing,
      saveProblem: null,
      simTimeMs: 0,
      dragPath: null,
      keyPathActive: false,
      celebration: null,
      announce: '',
      blockedLabels: [],
    };
    // A saved mute survives even on the title screen so the first click honors it.
    const peek = deserialize(existing);
    if (peek.ok) {
      this.ui.settings = peek.settings;
    }
    this.applyAudioSettings();
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

  private applyAudioSettings(): void {
    audio.setSound(this.ui.settings.sound);
    audio.setMusic(this.ui.settings.music);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-reduced-motion', this.ui.settings.reducedMotion ? 'true' : 'false');
    }
  }

  // ---- lifecycle ------------------------------------------------------------------
  newGame(): void {
    this.sim = new Sim(createWorld());
    const keep = this.ui.settings;
    this.ui = {
      ...this.ui,
      screen: 'game',
      tool: { type: 'select' },
      selectedId: null,
      cursor: null,
      paused: false,
      speed: 1,
      settings: { ...DEFAULT_SETTINGS, sound: keep.sound, music: keep.music, reducedMotion: keep.reducedMotion },
      tutorialOpen: true,
      completionOpen: false,
      settingsOpen: false,
      notices: [],
      simTimeMs: 0,
      saveProblem: null,
      celebration: null,
      dragPath: null,
      keyPathActive: false,
    };
    this.acc = 0;
    this.applyAudioSettings();
    this.save();
    this.start();
    this.emit();
  }

  continueGame(): boolean {
    const result = deserialize(this.storage.get());
    if (!result.ok) {
      this.storage.backup();
      this.setUi({ saveProblem: COPY.save.unreadableBody, hasSave: false });
      return false;
    }
    this.sim = result.sim;
    this.ui = {
      ...this.ui,
      screen: 'game',
      tool: { type: 'select' },
      selectedId: null,
      cursor: null,
      settings: result.settings,
      speed: result.settings.speed as 1 | 2 | 3,
      paused: false,
      tutorialOpen: !result.settings.tutorialDismissed,
      completionOpen: false,
      settingsOpen: false,
      notices: [],
      simTimeMs: 0,
      saveProblem: null,
      celebration: null,
      dragPath: null,
      keyPathActive: false,
    };
    this.acc = 0;
    this.applyAudioSettings();
    this.start();
    this.emit();
    return true;
  }

  start(): void {
    if (this.raf !== null || typeof requestAnimationFrame === 'undefined') return;
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      // A hidden tab stops animation frames; when it returns we do not catch up (max 250 ms).
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

  /** The sim is held while paused, while a dialog covers the garden, and during the celebration beat. */
  get held(): boolean {
    return this.ui.paused || this.ui.settingsOpen || this.ui.completionOpen || this.ui.celebration !== null;
  }

  /** Advance real time; runs whole fixed ticks and leaves the remainder for interpolation. */
  advance(dtMs: number): void {
    if (this.ui.screen !== 'game') return;
    const now = performance.now();
    if (this.ui.celebration && now >= this.ui.celebration.until) {
      this.ui = { ...this.ui, celebration: null };
      this.emit();
    }
    const held = this.held;
    audio.setPaused(held);
    if (!held) {
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
      if (ticked) {
        this.updateLoops();
        this.emit();
      }
    }
    this.pruneNotices();
    if (now - this.lastAutosave > 10_000) this.save();
  }

  private updateLoops(): void {
    let working = false;
    let riding = false;
    for (const s of Object.values(this.sim.world.structures)) {
      if (s.processor?.workTicks !== null && s.processor !== undefined) working = true;
      if (s.belt?.item) riding = true;
      if (working && riding) break;
    }
    audio.setLoop('machine_working', working);
    audio.setLoop('belt_tick', riding);
  }

  /** Run the sim forward by N ticks instantly (used by the e2e harness). */
  fastForward(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.handleEvents(this.sim.step());
    this.ui.simTimeMs = this.sim.world.tick * TICK_MS;
    this.emit();
  }

  private handleEvents(events: SimEvent[]): void {
    let delivered = false;
    for (const e of events) {
      this.pendingEvents.push(e);
      switch (e.type) {
        case 'order_complete': {
          const oc = orderCopy(e.orderId);
          const next = ORDERS[orderIndex(e.orderId) + 1];
          let unlockLine: string | null = oc?.unlockLine ?? null;
          if (next?.unlocksExpansion) unlockLine = (unlockLine ? unlockLine + ' ' : '') + fmt(EXTRA.celebration.unlockGeneric, { name: COPY.expansion.button });
          this.ui = {
            ...this.ui,
            celebration: e.final
              ? null
              : { orderId: e.orderId, reward: e.reward, unlockLine, final: e.final, until: performance.now() + 3200 },
          };
          this.notify((oc?.complete ?? '') + ' ' + fmt(COPY.celebration.earned, { coins: e.reward }), 'good', 5000, 'order');
          if (unlockLine) this.notify(unlockLine, 'good', 6000, 'unlock');
          shell.onOrderCompleted(e.orderId, e.final);
          audio.play(e.final ? 'final_celebration' : 'order_complete');
          if (unlockLine) audio.play('unlock', { delay: 1.2 });
          this.save();
          break;
        }
        case 'all_orders_complete':
          if (!this.ui.settings.seenCompletion) {
            this.ui = { ...this.ui, completionOpen: true, settings: { ...this.ui.settings, seenCompletion: true } };
          }
          break;
        case 'crafted':
          audio.play('item_pop', { throttleMs: 120 });
          break;
        case 'item_spawned':
          audio.play('flower_bloom', { throttleMs: 400 });
          break;
        case 'delivered':
          delivered = true;
          break;
        case 'blocked': {
          const s = this.sim.world.structures[e.structureId];
          if (s) {
            const held = s.producer?.output?.kind ?? s.processor?.outputs[0]?.kind ?? null;
            const text = blockText(e.reason, held, EXTRA.hud.orders && 'The machine ahead');
            // Shown beside the building by the scene (no banner), announced for screen readers.
            this.ui = { ...this.ui, blockedLabels: [...this.ui.blockedLabels.filter((b) => b.id !== s.id), { id: s.id, text, until: performance.now() + 4500 }].slice(-4), announce: `${buildingName(s.kind)}: ${text}` };
            audio.play('blocked', { throttleMs: 500 });
          }
          break;
        }
        default:
          break;
      }
    }
    if (delivered) audio.play('deliver', { throttleMs: 150 });
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
          audio.play('build_place');
          break;
        case 'rotate':
          audio.play('build_rotate');
          break;
        case 'remove':
          audio.play('build_remove');
          if (result.refund) audio.play('coins', { delay: 0.15 });
          if (this.ui.selectedId === action.id) this.ui.selectedId = null;
          break;
        case 'undo':
          audio.play('undo');
          if (this.ui.selectedId !== null && !this.sim.world.structures[this.ui.selectedId]) this.ui.selectedId = null;
          break;
        case 'expand':
          audio.play('unlock');
          break;
        case 'basket_drop':
          audio.play('build_place');
          break;
      }
      if (action.type === 'expand') this.notify(COPY.expansion.opened, 'good', 3200, 'expand');
      else if (action.type === 'remove') {
        const removed = events.find((ev) => ev.type === 'removed');
        if (removed && removed.type === 'removed') {
          const kinds = Object.entries(removed.recovered).filter(([, n]) => (n ?? 0) > 0);
          const total = kinds.reduce((a, [, n]) => a + (n ?? 0), 0);
          const parts: string[] = [];
          if (total === 1) parts.push(fmt(COPY.basket.removed, { item: itemName(kinds[0][0] as ItemKind) }));
          else if (total > 1) parts.push(COPY.basket.removedMany);
          if (removed.refund > 0) parts.push(fmt(COPY.basket.refund, { coins: removed.refund }));
          if (parts.length) this.notify(parts.join(' '), 'info', 3200, 'refund');
        }
      } else if (action.type === 'place_belt_path' && result.message) this.notify(COPY.errors.dragSkipped, 'info', 3200, 'skip');
      this.save();
      shell.onSaved();
    } else {
      audio.play('ui_error');
      const msg = messageFor(result, action, this.sim.world.coins) ?? result.message;
      if (msg) this.notify(msg, 'bad', 3200, 'error');
    }
    this.emit();
    return result;
  }

  /** At most two toasts; a new toast with the same key replaces the old one (so refunds merge). */
  notify(text: string, tone: Notice['tone'] = 'info', ms = 3200, key?: string): void {
    const now = performance.now();
    const notices = this.ui.notices.filter((n) => n.text !== text && (!key || n.key !== key));
    notices.push({ id: this.noticeId++, text, tone, until: now + ms, key });
    this.ui = { ...this.ui, notices: notices.slice(-2) };
    this.emit();
  }

  private pruneNotices(): void {
    const now = performance.now();
    const staleNotice = this.ui.notices.some((n) => n.until <= now);
    const staleLabel = this.ui.blockedLabels.some((n) => n.until <= now);
    if (staleNotice || staleLabel) {
      this.ui = { ...this.ui, notices: this.ui.notices.filter((n) => n.until > now), blockedLabels: this.ui.blockedLabels.filter((n) => n.until > now) };
      this.emit();
    }
  }

  // ---- ui helpers -------------------------------------------------------------------
  setTool(tool: Tool): void {
    audio.play('ui_click');
    this.setUi({ tool, selectedId: tool.type === 'select' ? this.ui.selectedId : null, dragPath: null, keyPathActive: false });
  }

  select(id: number | null): void {
    this.setUi({ selectedId: id, tool: { type: 'select' } });
  }

  rotateBuildFacing(ccw = false): void {
    this.setUi({ buildFacing: ((this.ui.buildFacing + (ccw ? 3 : 1)) % 4) as Dir });
    audio.play('build_rotate');
  }

  /** R: rotate the ghost while building, else the selected structure. */
  rotate(ccw = false): void {
    if (this.ui.tool.type === 'build') this.rotateBuildFacing(ccw);
    else if (this.ui.selectedId !== null) {
      const s = this.sim.world.structures[this.ui.selectedId];
      if (s) this.dispatch({ type: 'rotate', id: s.id, facing: ((s.facing + (ccw ? 3 : 1)) % 4) as Dir });
    } else this.rotateBuildFacing(ccw);
  }

  togglePause(): void {
    audio.play('ui_click');
    this.setUi({ paused: !this.ui.paused });
  }

  setSpeed(speed: 1 | 2 | 3): void {
    audio.play('ui_click');
    this.ui.settings = { ...this.ui.settings, speed };
    this.setUi({ speed, paused: false });
  }

  cycleSpeed(): void {
    this.setSpeed((this.ui.speed === 3 ? 1 : this.ui.speed + 1) as 1 | 2 | 3);
  }

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.ui.settings, ...patch };
    this.ui = { ...this.ui, settings };
    this.applyAudioSettings();
    this.emit();
    this.save();
  }

  dismissTutorial(): void {
    this.updateSettings({ tutorialDismissed: true });
    this.setUi({ tutorialOpen: false });
  }

  /** Cancel the current thing: dialog, then path, then tool, then selection. Returns true if something changed. */
  cancel(): boolean {
    if (this.ui.settingsOpen) {
      this.setUi({ settingsOpen: false });
      return true;
    }
    if (this.ui.dragPath || this.ui.keyPathActive) {
      this.setUi({ dragPath: null, keyPathActive: false });
      return true;
    }
    if (this.ui.tool.type !== 'select') {
      this.setTool({ type: 'select' });
      return true;
    }
    if (this.ui.selectedId !== null) {
      this.select(null);
      return true;
    }
    return false;
  }

  // ---- keyboard cursor ----------------------------------------------------------------
  moveCursor(dx: number, dy: number): void {
    const w = this.sim.world;
    const c = this.ui.cursor ?? this.ui.hover ?? { x: Math.floor(w.cols / 2), y: Math.floor(w.rows / 2) };
    const nx = Math.max(0, Math.min(w.cols - 1, c.x + dx));
    const ny = Math.max(0, Math.min(w.rows - 1, c.y + dy));
    const cursor = { x: nx, y: ny };
    let dragPath = this.ui.dragPath;
    if (this.ui.keyPathActive && dragPath) {
      const idx = dragPath.findIndex((t) => t.x === nx && t.y === ny);
      dragPath = idx >= 0 ? dragPath.slice(0, idx + 1) : [...dragPath, cursor];
    }
    this.setUi({ cursor, dragPath });
    this.scheduleAnnounce();
  }

  private scheduleAnnounce(): void {
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      this.announceTimer = null;
      const c = this.ui.cursor;
      if (!c) return;
      const s = this.sim.at(c.x, c.y);
      const what = s ? describeStructure(s) : EXTRA.a11y.emptyTile;
      this.setUi({ announce: fmt(EXTRA.a11y.cursorTile, { what, x: c.x + 1, y: c.y + 1 }) });
    }, 400);
  }

  /** Enter / Space on the garden. */
  activateCursor(): void {
    const c = this.ui.cursor;
    if (!c) {
      this.moveCursor(0, 0);
      return;
    }
    const tool = this.ui.tool;
    switch (tool.type) {
      case 'build':
        if (tool.kind === 'belt') {
          if (!this.ui.keyPathActive) {
            this.setUi({ keyPathActive: true, dragPath: [c] });
          } else {
            const path = this.ui.dragPath ?? [c];
            this.setUi({ keyPathActive: false, dragPath: null });
            if (path.length === 1) this.dispatch({ type: 'place', kind: 'belt', x: path[0].x, y: path[0].y, facing: this.ui.buildFacing });
            else this.dispatch({ type: 'place_belt_path', tiles: path });
          }
        } else {
          this.dispatch({ type: 'place', kind: tool.kind, x: c.x, y: c.y, facing: this.ui.buildFacing });
        }
        break;
      case 'remove': {
        const s = this.sim.at(c.x, c.y);
        if (s) this.dispatch({ type: 'remove', id: s.id });
        else this.notify(COPY.errors.removeEmpty, 'bad', 3200, 'error');
        break;
      }
      case 'basket': {
        const r = this.dispatch({ type: 'basket_drop', kind: tool.kind, x: c.x, y: c.y });
        if (r.ok && !(this.sim.world.basket[tool.kind] ?? 0)) this.setTool({ type: 'select' });
        break;
      }
      case 'select': {
        const s = this.sim.at(c.x, c.y);
        this.select(s ? s.id : null);
        break;
      }
    }
  }

  // ---- persistence -----------------------------------------------------------------
  save(): void {
    if (this.ui.screen !== 'game') return;
    this.storage.set(serialize(this.sim, this.ui.settings, Date.now()));
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

  get reducedMotion(): boolean {
    return this.ui.settings.reducedMotion;
  }
}

export function describeStructure(s: Structure): string {
  const def = STRUCTURES[s.kind];
  const st = COPY.states;
  let state = '';
  if (s.belt) state = s.belt.item ? fmt(st.belt.carrying.label, { item: itemName(s.belt.item.kind) }) : st.belt.empty.label;
  else if (s.producer) state = s.producer.blockedTicks > 3 ? blockCopy(s.producer.block, { item: s.producer.output?.kind }).label : s.producer.output ? st.ready.label : st.growing.label;
  else if (s.processor)
    state = s.processor.blockedTicks > 3 ? blockCopy(s.processor.block, { item: s.processor.outputs[0]?.kind }).label : s.processor.workTicks !== null ? st.processing.label : s.processor.outputs.length ? st.ready.label : st.waiting.label;
  else state = st.packing.waiting.label;
  const facing = def.hasFacing ? ', ' + fmt(COPY.inspector.values.sends, { facing: facingWord(s.facing) }) : '';
  return `${buildingName(s.kind)}, ${state}${facing}`;
}

export const store = new GameStore();

// Expose for the e2e harness and debugging.
declare global {
  interface Window {
    petalworks?: GameStore;
  }
}
if (typeof window !== 'undefined') window.petalworks = store;
