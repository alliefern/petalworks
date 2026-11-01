import { ORDERS } from './data/orders';
import { BASE_GRID, EXPANDED_GRID } from './data/balance';
import { isItemKind } from './data/items';
import { isStructureKind, STRUCTURES } from './data/structures';
import { createWorld, makeStructure, Sim } from './game';
import type { Counts, Dir, Item, Structure, World } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'petalworks.save';

export interface UiSaveState {
  tutorialStep: number;
  tutorialDismissed: boolean;
  soundOn: boolean;
  musicOn: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  speed: number;
  seenCompletion: boolean;
}

export const DEFAULT_UI_STATE: UiSaveState = {
  tutorialStep: 0,
  tutorialDismissed: false,
  soundOn: true,
  musicOn: true,
  reducedMotion: 'system',
  speed: 1,
  seenCompletion: false,
};

export interface SaveFile {
  version: number;
  savedAt: number;
  world: World;
  ui: UiSaveState;
}

export function serialize(sim: Sim, ui: UiSaveState): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), world: sim.world, ui };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; sim: Sim; ui: UiSaveState } | { ok: false; reason: string };

/**
 * Parse and validate a save. Anything structurally wrong is dropped rather than
 * crashing: duplicated tiles lose the later structure, bad items are discarded,
 * unknown kinds are skipped. A hopeless payload returns ok:false.
 */
export function deserialize(json: string | null | undefined): LoadResult {
  if (!json) return { ok: false, reason: 'empty' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'not json' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' };
  const file = raw as Partial<SaveFile>;
  if (typeof file.version !== 'number') return { ok: false, reason: 'missing version' };
  if (file.version > SAVE_VERSION) return { ok: false, reason: 'save is from a newer version' };
  const migrated = migrate(file);
  const world = sanitizeWorld(migrated.world);
  if (!world) return { ok: false, reason: 'world invalid' };
  const ui = { ...DEFAULT_UI_STATE, ...(isRecord(migrated.ui) ? pickUi(migrated.ui) : {}) };
  return { ok: true, sim: new Sim(world), ui };
}

function migrate(file: Partial<SaveFile>): Partial<SaveFile> {
  // Future schema bumps add steps here; v1 is the first format.
  return file;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function pickUi(u: Record<string, unknown>): Partial<UiSaveState> {
  const out: Partial<UiSaveState> = {};
  if (typeof u.tutorialStep === 'number') out.tutorialStep = u.tutorialStep;
  if (typeof u.tutorialDismissed === 'boolean') out.tutorialDismissed = u.tutorialDismissed;
  if (typeof u.soundOn === 'boolean') out.soundOn = u.soundOn;
  if (typeof u.musicOn === 'boolean') out.musicOn = u.musicOn;
  if (u.reducedMotion === 'system' || u.reducedMotion === 'on' || u.reducedMotion === 'off') out.reducedMotion = u.reducedMotion;
  if (typeof u.speed === 'number' && [1, 2, 3].includes(u.speed)) out.speed = u.speed;
  if (typeof u.seenCompletion === 'boolean') out.seenCompletion = u.seenCompletion;
  return out;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function counts(v: unknown): Counts {
  const out: Counts = {};
  if (!isRecord(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (isItemKind(k) && typeof n === 'number' && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

function sanitizeWorld(raw: unknown): World | null {
  if (!isRecord(raw)) return null;
  const fresh = createWorld();
  const expanded = raw.expanded === true;
  const dims = expanded ? EXPANDED_GRID : BASE_GRID;
  const world: World = {
    ...fresh,
    tick: Math.max(0, Math.floor(num(raw.tick, 0))),
    width: dims.width,
    height: dims.height,
    expanded,
    structures: {},
    nextStructureId: 1,
    nextItemId: 1,
    coins: Math.max(0, Math.floor(num(raw.coins, fresh.coins))),
    stock: counts(raw.stock),
    basket: counts(raw.basket),
    orderIndex: Math.min(ORDERS.length, Math.max(0, Math.floor(num(raw.orderIndex, 0)))),
    orderProgress: counts(raw.orderProgress),
    completedOrders: Array.isArray(raw.completedOrders) ? raw.completedOrders.filter((s): s is string => typeof s === 'string') : [],
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter(isStructureKind) : [],
    expansionUnlocked: raw.expansionUnlocked === true,
    stats: isRecord(raw.stats)
      ? { delivered: num(raw.stats.delivered, 0), crafted: num(raw.stats.crafted, 0), coinsEarned: num(raw.stats.coinsEarned, 0) }
      : fresh.stats,
  };

  // Unlocks must at least match what the order sequence guarantees, so a damaged save can't softlock.
  for (let i = 0; i <= Math.min(world.orderIndex, ORDERS.length - 1); i++) {
    for (const k of ORDERS[i].unlocks) if (!world.unlocked.includes(k)) world.unlocked.push(k);
    if (ORDERS[i].unlocksExpansion) world.expansionUnlocked = true;
  }
  if (world.orderIndex >= ORDERS.length) {
    world.unlocked = Object.keys(STRUCTURES) as World['unlocked'];
    world.expansionUnlocked = true;
  }

  const seenTiles = new Set<string>();
  const seenItems = new Set<number>();
  let maxItemId = 0;
  const takeItem = (v: unknown): Item | null => {
    if (!isRecord(v) || !isItemKind(v.kind)) return null;
    const id = Math.floor(num(v.id, -1));
    if (id < 0 || seenItems.has(id)) return null;
    seenItems.add(id);
    maxItemId = Math.max(maxItemId, id);
    return { id, kind: v.kind };
  };

  const list: unknown[] = Array.isArray(raw.structures)
    ? raw.structures
    : isRecord(raw.structures)
      ? Object.values(raw.structures)
      : [];
  let maxId = 0;
  for (const rs of list) {
    if (!isRecord(rs) || !isStructureKind(rs.kind)) continue;
    const x = Math.floor(num(rs.x, -1));
    const y = Math.floor(num(rs.y, -1));
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
    const key = `${x},${y}`;
    if (seenTiles.has(key)) continue;
    const facingRaw = Math.floor(num(rs.facing, 1));
    const facing = (facingRaw >= 0 && facingRaw <= 3 ? facingRaw : 1) as Dir;
    const id = Math.floor(num(rs.id, -1));
    if (id <= 0 || world.structures[id]) continue;
    seenTiles.add(key);
    const s: Structure = { ...makeStructure(world, rs.kind, x, y, facing), id };
    maxId = Math.max(maxId, id);
    if (s.belt && isRecord(rs.belt)) {
      const item = takeItem(rs.belt.item);
      s.belt.item = item;
      s.belt.progress = item ? Math.max(0, Math.floor(num(rs.belt.progress, 0))) : 0;
      const from = Math.floor(num(rs.belt.from, (facing + 2) % 4));
      s.belt.from = (from >= 0 && from <= 3 ? from : (facing + 2) % 4) as Dir;
    }
    if (s.producer && isRecord(rs.producer)) {
      s.producer.growTicks = Math.max(0, Math.floor(num(rs.producer.growTicks, 0)));
      s.producer.output = takeItem(rs.producer.output);
    }
    if (s.processor && isRecord(rs.processor)) {
      const inputs = Array.isArray(rs.processor.inputs) ? rs.processor.inputs : [];
      const outputs = Array.isArray(rs.processor.outputs) ? rs.processor.outputs : [];
      s.processor.inputs = inputs.map(takeItem).filter((i): i is Item => !!i);
      s.processor.outputs = outputs.map(takeItem).filter((i): i is Item => !!i);
      const wt = rs.processor.workTicks;
      s.processor.workTicks = typeof wt === 'number' && wt >= 0 ? Math.floor(wt) : null;
    }
    if (s.packing && isRecord(rs.packing)) {
      s.packing.received = Math.max(0, Math.floor(num(rs.packing.received, 0)));
    }
    world.structures[id] = s;
  }
  world.nextStructureId = Math.max(maxId + 1, Math.floor(num(raw.nextStructureId, 1)));
  world.nextItemId = Math.max(maxItemId + 1, Math.floor(num(raw.nextItemId, 1)));
  return world;
}

/** Storage adapter so the sim stays testable without a browser. */
export interface SaveStore {
  get(): string | null;
  set(value: string): void;
  clear(): void;
}

export function localStorageStore(storage: Storage = globalThis.localStorage): SaveStore {
  return {
    get: () => {
      try {
        return storage.getItem(SAVE_KEY);
      } catch {
        return null;
      }
    },
    set: (v) => {
      try {
        storage.setItem(SAVE_KEY, v);
      } catch {
        /* quota or private mode: ignore, the game still runs */
      }
    },
    clear: () => {
      try {
        storage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

export function memoryStore(): SaveStore {
  let v: string | null = null;
  return { get: () => v, set: (s) => (v = s), clear: () => (v = null) };
}
