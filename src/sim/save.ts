import { ORDERS } from './data/orders';
import { isItemKind } from './data/items';
import { boundsOf, PLOTS, START_PLOT_IDS } from './data/plots';
import { RECIPES } from './data/recipes';
import { isStructureKind, STRUCTURES } from './data/structures';
import { createWorld, makeStructure, Sim } from './game';
import type { Counts, Dir, Item, Structure, World } from './types';

/** Bump when the shape changes; add a step to MIGRATIONS. */
export const SCHEMA_VERSION = 2;
export const SAVE_KEY = 'petalworks.save';
export const BACKUP_KEY = 'petalworks.save.backup';

/** Player settings live beside the sim so a sim migration never resets them. */
export interface Settings {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  tutorialStep: number;
  tutorialDismissed: boolean;
  speed: number;
  seenCompletion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  reducedMotion: false,
  tutorialStep: 0,
  tutorialDismissed: false,
  speed: 1,
  seenCompletion: false,
};

export interface SaveFile {
  schemaVersion: number;
  savedAt: number;
  world: World;
  settings: Settings;
}

export function serialize(sim: Sim, settings: Settings, savedAt: number): string {
  const file: SaveFile = { schemaVersion: SCHEMA_VERSION, savedAt, world: sim.world, settings };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; sim: Sim; settings: Settings } | { ok: false; reason: string };

type RawSave = Record<string, unknown>;

/**
 * Ordered, pure migrations. Each takes the raw object at version N and returns version N+1.
 * v1 → v2: `version` → `schemaVersion`; `ui` → `settings` with boolean sound/music/reducedMotion;
 * `expanded` → `unlockedPlotIds`; `orderIndex/orderProgress/completedOrders` → `orders` board;
 * `width/height` → `cols/rows`; processor `recipeId` added.
 */
const MIGRATIONS: Array<(raw: RawSave) => RawSave> = [
  // index 0 is unused (there is no version 0)
  (raw) => raw,
  (raw) => {
    const out: RawSave = { ...raw };
    delete out.version;
    out.schemaVersion = 2;
    const ui = isRecord(raw.ui) ? raw.ui : {};
    const prefersReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    out.settings = {
      sound: ui.soundOn !== false,
      music: ui.musicOn !== false,
      reducedMotion: ui.reducedMotion === 'on' ? true : ui.reducedMotion === 'off' ? false : prefersReduced,
      tutorialStep: typeof ui.tutorialStep === 'number' ? ui.tutorialStep : 0,
      tutorialDismissed: ui.tutorialDismissed === true,
      speed: typeof ui.speed === 'number' ? ui.speed : 1,
      seenCompletion: ui.seenCompletion === true,
    };
    delete out.ui;
    const w = isRecord(raw.world) ? { ...raw.world } : {};
    w.unlockedPlotIds = w.expanded === true ? PLOTS.map((p) => p.id) : [...START_PLOT_IDS];
    delete w.expanded;
    w.cols = w.width;
    w.rows = w.height;
    delete w.width;
    delete w.height;
    const idx = typeof w.orderIndex === 'number' ? w.orderIndex : 0;
    w.orders = {
      activeId: ORDERS[idx]?.id ?? null,
      offeredIds: ORDERS[idx] ? [ORDERS[idx].id] : [],
      completedIds: Array.isArray(w.completedOrders) ? w.completedOrders : ORDERS.slice(0, idx).map((o) => o.id),
      progress: { orderId: ORDERS[idx]?.id ?? null, delivered: isRecord(w.orderProgress) ? w.orderProgress : {} },
    };
    delete w.orderIndex;
    delete w.orderProgress;
    delete w.completedOrders;
    out.world = w;
    return out;
  },
];

/**
 * Parse, migrate and validate a save. Anything structurally wrong is dropped rather than
 * crashing: duplicated tiles lose the later structure, bad items are discarded, unknown
 * kinds are skipped, unknown fields are ignored. A hopeless payload returns ok:false.
 */
export function deserialize(json: string | null | undefined): LoadResult {
  if (!json) return { ok: false, reason: 'empty' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'not json' };
  }
  if (!isRecord(raw)) return { ok: false, reason: 'not an object' };
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : typeof raw.version === 'number' ? raw.version : NaN;
  if (!Number.isInteger(version) || version < 1) return { ok: false, reason: 'missing schema version' };
  if (version > SCHEMA_VERSION) return { ok: false, reason: 'save is from a newer version' };
  let file: RawSave = raw;
  while (version < SCHEMA_VERSION) {
    file = MIGRATIONS[version](file);
    version += 1;
  }
  const world = sanitizeWorld(file.world);
  if (!world) return { ok: false, reason: 'world invalid' };
  const settings = { ...DEFAULT_SETTINGS, ...(isRecord(file.settings) ? pickSettings(file.settings) : {}) };
  return { ok: true, sim: new Sim(world), settings };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function pickSettings(u: Record<string, unknown>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (typeof u.sound === 'boolean') out.sound = u.sound;
  if (typeof u.music === 'boolean') out.music = u.music;
  if (typeof u.reducedMotion === 'boolean') out.reducedMotion = u.reducedMotion;
  if (typeof u.tutorialStep === 'number') out.tutorialStep = u.tutorialStep;
  if (typeof u.tutorialDismissed === 'boolean') out.tutorialDismissed = u.tutorialDismissed;
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
  const plotIds = Array.isArray(raw.unlockedPlotIds) ? raw.unlockedPlotIds.filter((id): id is string => typeof id === 'string' && PLOTS.some((p) => p.id === id)) : [];
  for (const id of START_PLOT_IDS) if (!plotIds.includes(id)) plotIds.push(id);
  const bounds = boundsOf(plotIds);

  const ordersRaw = isRecord(raw.orders) ? raw.orders : {};
  const activeRaw = ordersRaw.activeId;
  const activeId = typeof activeRaw === 'string' && ORDERS.some((o) => o.id === activeRaw) ? activeRaw : activeRaw === null ? null : ORDERS[0].id;
  const completedIds = Array.isArray(ordersRaw.completedIds) ? ordersRaw.completedIds.filter((s): s is string => typeof s === 'string' && ORDERS.some((o) => o.id === s)) : [];
  const progressRaw = isRecord(ordersRaw.progress) ? ordersRaw.progress : {};

  const world: World = {
    ...fresh,
    tick: Math.max(0, Math.floor(num(raw.tick, 0))),
    cols: bounds.cols,
    rows: bounds.rows,
    unlockedPlotIds: plotIds,
    structures: {},
    nextStructureId: 1,
    nextItemId: 1,
    coins: Math.max(0, Math.floor(num(raw.coins, fresh.coins))),
    stock: counts(raw.stock),
    basket: counts(raw.basket),
    orders: {
      activeId,
      offeredIds: activeId ? [activeId] : [],
      completedIds,
      progress: { orderId: activeId, delivered: progressRaw.orderId === activeId || progressRaw.orderId === undefined ? counts(progressRaw.delivered) : {} },
    },
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter(isStructureKind) : [],
    expansionUnlocked: raw.expansionUnlocked === true,
    stats: isRecord(raw.stats)
      ? { delivered: num(raw.stats.delivered, 0), crafted: num(raw.stats.crafted, 0), coinsEarned: num(raw.stats.coinsEarned, 0) }
      : { ...fresh.stats },
  };

  // Unlocks must at least match what the order sequence guarantees, so a damaged save can't softlock.
  const idx = activeId ? ORDERS.findIndex((o) => o.id === activeId) : ORDERS.length;
  for (let i = 0; i <= Math.min(idx, ORDERS.length - 1); i++) {
    for (const k of ORDERS[i].unlocks) if (!world.unlocked.includes(k)) world.unlocked.push(k);
    if (ORDERS[i].unlocksExpansion) world.expansionUnlocked = true;
  }
  if (activeId === null) {
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

  const list: unknown[] = Array.isArray(raw.structures) ? raw.structures : isRecord(raw.structures) ? Object.values(raw.structures) : [];
  let maxId = 0;
  let hasPacking = false;
  for (const rs of list) {
    if (!isRecord(rs) || !isStructureKind(rs.kind)) continue;
    const x = Math.floor(num(rs.x, -1));
    const y = Math.floor(num(rs.y, -1));
    if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) continue;
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
      const def = STRUCTURES[s.kind];
      const rid = rs.processor.recipeId;
      if (typeof rid === 'string' && def.recipeIds!.includes(rid) && RECIPES[rid]) s.processor.recipeId = rid;
      const inputs = Array.isArray(rs.processor.inputs) ? rs.processor.inputs : [];
      const outputs = Array.isArray(rs.processor.outputs) ? rs.processor.outputs : [];
      s.processor.inputs = inputs.map(takeItem).filter((i): i is Item => !!i);
      s.processor.outputs = outputs.map(takeItem).filter((i): i is Item => !!i);
      const wt = rs.processor.workTicks;
      s.processor.workTicks = typeof wt === 'number' && wt >= 0 ? Math.floor(wt) : null;
    }
    if (s.packing && isRecord(rs.packing)) {
      s.packing.received = Math.max(0, Math.floor(num(rs.packing.received, 0)));
      s.packing.lastReceivedTick = Math.floor(num(rs.packing.lastReceivedTick, -1));
    }
    if (s.kind === 'packing_station') hasPacking = true;
    world.structures[id] = s;
  }
  world.nextStructureId = Math.max(maxId + 1, Math.floor(num(raw.nextStructureId, 1)));
  world.nextItemId = Math.max(maxItemId + 1, Math.floor(num(raw.nextItemId, 1)));
  if (!hasPacking) {
    // The yard always has its Packing Station. Put it back on the first free tile near home.
    const home = Object.values(fresh.structures).find((s) => s.kind === 'packing_station')!;
    let placed = false;
    for (let r = 0; r < 20 && !placed; r++) {
      for (let dy = -r; dy <= r && !placed; dy++) {
        for (let dx = -r; dx <= r && !placed; dx++) {
          const x = home.x + dx;
          const y = home.y + dy;
          if (x < 0 || y < 0 || x >= world.cols || y >= world.rows || seenTiles.has(`${x},${y}`)) continue;
          const s = makeStructure(world, 'packing_station', x, y, 0);
          world.structures[s.id] = s;
          placed = true;
        }
      }
    }
  }
  return world;
}

/** Storage adapter so the sim stays testable without a browser. */
export interface SaveStore {
  get(): string | null;
  set(value: string): void;
  clear(): void;
  /** Keep a broken payload aside instead of overwriting it. */
  backup(): void;
}

export function localStorageStore(storage: Storage = globalThis.localStorage): SaveStore {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    get: () => safe(() => storage.getItem(SAVE_KEY), null),
    set: (v) => safe(() => storage.setItem(SAVE_KEY, v), undefined),
    clear: () => safe(() => storage.removeItem(SAVE_KEY), undefined),
    backup: () =>
      safe(() => {
        const v = storage.getItem(SAVE_KEY);
        if (v) storage.setItem(BACKUP_KEY, v);
      }, undefined),
  };
}

export function memoryStore(): SaveStore {
  let v: string | null = null;
  const backups: string[] = [];
  return { get: () => v, set: (s) => (v = s), clear: () => (v = null), backup: () => void (v && backups.push(v)) };
}
