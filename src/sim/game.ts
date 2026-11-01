import {
  BASE_GRID,
  EXPANDED_GRID,
  EXPANSION_COST,
  REFUND_RATE,
  START_COINS,
  UNDO_STACK_LIMIT,
} from './data/balance';
import { ITEMS } from './data/items';
import { STRUCTURES } from './data/structures';
import { dirBetween, inBounds, opposite, structureAt, TileIndex } from './grid';
import { allocateStock, isSandbox, startCurrentOrder } from './orders';
import { newItem, tickProcessors, tickProducers } from './production';
import { tickBelts } from './transport';
import type {
  Action,
  ActionResult,
  Counts,
  Dir,
  Item,
  ItemKind,
  SimEvent,
  Structure,
  StructureKind,
  World,
} from './types';

export type UndoEntry =
  | { type: 'place'; id: number; cost: number }
  | { type: 'belt_path'; placed: number[]; rotated: Array<{ id: number; prev: Dir }>; cost: number }
  | { type: 'remove'; kind: StructureKind; x: number; y: number; facing: Dir; refund: number }
  | { type: 'rotate'; id: number; prev: Dir };

export function createWorld(): World {
  const world: World = {
    tick: 0,
    width: BASE_GRID.width,
    height: BASE_GRID.height,
    expanded: false,
    structures: {},
    nextStructureId: 1,
    nextItemId: 1,
    coins: START_COINS,
    stock: {},
    basket: {},
    orderIndex: 0,
    orderProgress: {},
    completedOrders: [],
    unlocked: [],
    expansionUnlocked: false,
    stats: { delivered: 0, crafted: 0, coinsEarned: 0 },
  };
  startCurrentOrder(world, []);
  return world;
}

export function makeStructure(world: World, kind: StructureKind, x: number, y: number, facing: Dir): Structure {
  const def = STRUCTURES[kind];
  const s: Structure = { id: world.nextStructureId++, kind, x, y, facing: def.hasFacing ? facing : 0 };
  switch (def.role) {
    case 'belt':
      s.belt = { item: null, progress: 0, from: opposite(facing), block: 'none', stuckTicks: 0 };
      break;
    case 'producer':
      s.producer = { growTicks: 0, output: null, blocked: false };
      break;
    case 'processor':
      s.processor = { inputs: [], outputs: [], workTicks: null, blocked: false, lastRefusedTick: -1, lastRefusedKind: null };
      break;
    case 'packing':
      s.packing = { lastReceivedTick: -1, received: 0 };
      break;
  }
  return s;
}

/** Items held inside a structure (for removal and bookkeeping). */
export function itemsIn(s: Structure): Item[] {
  const out: Item[] = [];
  if (s.belt?.item) out.push(s.belt.item);
  if (s.producer?.output) out.push(s.producer.output);
  if (s.processor) out.push(...s.processor.inputs, ...s.processor.outputs);
  return out;
}

export function addCounts(target: Counts, kind: ItemKind, n = 1): void {
  target[kind] = (target[kind] ?? 0) + n;
}

export function totalCount(c: Counts): number {
  return Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
}

/**
 * The simulation. Owns a World plus a spatial index and an undo stack.
 * step() advances exactly one fixed tick. dispatch() applies a player action.
 */
export class Sim {
  world: World;
  readonly index = new TileIndex();
  undoStack: UndoEntry[] = [];

  constructor(world: World = createWorld()) {
    this.world = world;
    this.index.rebuild(world);
  }

  at(x: number, y: number): Structure | null {
    return structureAt(this.world, this.index, x, y);
  }

  isUnlocked(kind: StructureKind): boolean {
    return isSandbox(this.world) || this.world.unlocked.includes(kind);
  }

  step(): SimEvent[] {
    const events: SimEvent[] = [];
    const w = this.world;
    w.tick += 1;
    tickBelts(w, this.index, events);
    tickProducers(w, this.index, events);
    tickProcessors(w, this.index, events);
    // Record refusals on processors for inspector feedback.
    for (const e of events) {
      if (e.type === 'refused') {
        const s = w.structures[e.structureId];
        if (s?.processor) {
          s.processor.lastRefusedTick = w.tick;
          s.processor.lastRefusedKind = e.kind;
        }
      }
    }
    if (events.some((e) => e.type === 'delivered')) allocateStock(w, events);
    return events;
  }

  dispatch(action: Action, events: SimEvent[] = []): ActionResult {
    switch (action.type) {
      case 'place':
        return this.place(action.kind, action.x, action.y, action.facing, events);
      case 'place_belt_path':
        return this.placeBeltPath(action.tiles, events);
      case 'rotate':
        return this.rotate(action.id, action.facing, events);
      case 'remove':
        return this.remove(action.id, events);
      case 'undo':
        return this.undo(events);
      case 'basket_drop':
        return this.basketDrop(action.kind, action.x, action.y);
      case 'expand':
        return this.expand(events);
    }
  }

  /** Validate a placement without performing it (for ghost previews). */
  canPlace(kind: StructureKind, x: number, y: number): ActionResult {
    const w = this.world;
    const def = STRUCTURES[kind];
    if (!def) return { ok: false, error: 'unknown_structure', message: 'Unknown structure.' };
    if (!this.isUnlocked(kind)) return { ok: false, error: 'locked', message: `${def.name} is not unlocked yet.` };
    if (!inBounds(w, x, y)) return { ok: false, error: 'out_of_bounds', message: 'That is outside the garden.' };
    if (this.at(x, y)) return { ok: false, error: 'occupied', message: 'That tile is already taken.' };
    if (w.coins < def.cost) return { ok: false, error: 'unaffordable', message: `Not enough coins. ${def.name} costs ${def.cost}.` };
    return { ok: true };
  }

  private place(kind: StructureKind, x: number, y: number, facing: Dir, events: SimEvent[]): ActionResult {
    const check = this.canPlace(kind, x, y);
    if (!check.ok) return check;
    const def = STRUCTURES[kind];
    const s = makeStructure(this.world, kind, x, y, facing);
    this.world.structures[s.id] = s;
    this.index.set(s);
    this.world.coins -= def.cost;
    this.pushUndo({ type: 'place', id: s.id, cost: def.cost });
    events.push({ type: 'placed', structureId: s.id, kind });
    return { ok: true, ids: [s.id] };
  }

  /**
   * Lay a dragged belt path. Each tile faces the next; the last tile keeps the previous
   * direction. Existing belts on the path are re-oriented for free; other structures are skipped.
   */
  private placeBeltPath(tiles: Array<{ x: number; y: number; facing?: Dir }>, events: SimEvent[]): ActionResult {
    if (!this.isUnlocked('belt')) return { ok: false, error: 'locked', message: 'Belts are not unlocked yet.' };
    if (tiles.length === 0) return { ok: false, error: 'invalid' };
    const cost = STRUCTURES.belt.cost;
    const placed: number[] = [];
    const rotated: Array<{ id: number; prev: Dir }> = [];
    let spent = 0;
    let unaffordable = false;
    let lastDir: Dir | null = null;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const next = tiles[i + 1];
      let facing: Dir | null = next ? dirBetween(t.x, t.y, next.x, next.y) : lastDir;
      if (facing === null) facing = t.facing ?? 1;
      lastDir = facing;
      if (!inBounds(this.world, t.x, t.y)) continue;
      const existing = this.at(t.x, t.y);
      if (existing) {
        if (existing.kind === 'belt' && existing.facing !== facing && tiles.length > 1) {
          rotated.push({ id: existing.id, prev: existing.facing });
          this.setBeltFacing(existing, facing);
          events.push({ type: 'rotated', structureId: existing.id });
        }
        continue;
      }
      if (this.world.coins < cost) {
        unaffordable = true;
        break;
      }
      const s = makeStructure(this.world, 'belt', t.x, t.y, facing);
      this.world.structures[s.id] = s;
      this.index.set(s);
      this.world.coins -= cost;
      spent += cost;
      placed.push(s.id);
      events.push({ type: 'placed', structureId: s.id, kind: 'belt' });
    }
    if (placed.length || rotated.length) {
      this.pushUndo({ type: 'belt_path', placed, rotated, cost: spent });
    }
    if (unaffordable) {
      return {
        ok: placed.length > 0,
        error: 'unaffordable',
        message: placed.length ? 'Ran out of coins part way along the belt.' : 'Not enough coins for a belt.',
        ids: placed,
      };
    }
    if (!placed.length && !rotated.length) return { ok: false, error: 'occupied', message: 'Those tiles are already taken.' };
    return { ok: true, ids: [...placed, ...rotated.map((r) => r.id)] };
  }

  private setBeltFacing(s: Structure, facing: Dir): void {
    s.facing = facing;
    const st = s.belt!;
    // Rotating never destroys the item on the belt; it just re-routes it.
    if (st.item && st.from === facing) st.from = opposite(facing);
    if (!st.item) st.from = opposite(facing);
    st.block = 'none';
    st.stuckTicks = 0;
  }

  private rotate(id: number, facing: Dir | undefined, events: SimEvent[]): ActionResult {
    const s = this.world.structures[id];
    if (!s) return { ok: false, error: 'unknown_structure' };
    if (!STRUCTURES[s.kind].hasFacing) return { ok: false, error: 'invalid', message: 'The Packing Station accepts from every side; it has no direction.' };
    const target: Dir = facing ?? (((s.facing + 1) % 4) as Dir);
    if (target === s.facing) return { ok: true, ids: [id] };
    const prev = s.facing;
    if (s.kind === 'belt') this.setBeltFacing(s, target);
    else {
      s.facing = target;
      if (s.producer) s.producer.blocked = false;
      if (s.processor) s.processor.blocked = false;
    }
    this.pushUndo({ type: 'rotate', id, prev });
    events.push({ type: 'rotated', structureId: id });
    return { ok: true, ids: [id] };
  }

  private remove(id: number, events: SimEvent[]): ActionResult {
    const s = this.world.structures[id];
    if (!s) return { ok: false, error: 'unknown_structure' };
    const refund = Math.round(STRUCTURES[s.kind].cost * REFUND_RATE);
    const recovered: Counts = {};
    for (const item of itemsIn(s)) {
      addCounts(this.world.basket, item.kind);
      addCounts(recovered, item.kind);
    }
    delete this.world.structures[id];
    this.index.clear(s.x, s.y);
    this.world.coins += refund;
    this.pushUndo({ type: 'remove', kind: s.kind, x: s.x, y: s.y, facing: s.facing, refund });
    events.push({ type: 'removed', structureId: id, kind: s.kind, recovered });
    const n = totalCount(recovered);
    return {
      ok: true,
      ids: [id],
      message: n > 0 ? `${n} item${n === 1 ? '' : 's'} moved to your basket.` : undefined,
    };
  }

  private undo(events: SimEvent[]): ActionResult {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return { ok: false, error: 'nothing_to_undo', message: 'Nothing to undo.' };
    const w = this.world;
    switch (entry.type) {
      case 'place': {
        const s = w.structures[entry.id];
        if (!s) {
          this.undoStack.pop();
          return this.undo(events);
        }
        if (itemsIn(s).length) return { ok: false, error: 'undo_unsafe', message: 'Cannot undo: it is holding items. Remove it instead.' };
        this.undoStack.pop();
        delete w.structures[s.id];
        this.index.clear(s.x, s.y);
        w.coins += entry.cost;
        events.push({ type: 'removed', structureId: s.id, kind: s.kind, recovered: {} });
        return { ok: true, ids: [s.id] };
      }
      case 'belt_path': {
        const belts = entry.placed.map((id) => w.structures[id]).filter((s): s is Structure => !!s);
        if (belts.some((s) => itemsIn(s).length)) {
          return { ok: false, error: 'undo_unsafe', message: 'Cannot undo: those belts are carrying items.' };
        }
        this.undoStack.pop();
        for (const s of belts) {
          delete w.structures[s.id];
          this.index.clear(s.x, s.y);
          w.coins += STRUCTURES.belt.cost;
          events.push({ type: 'removed', structureId: s.id, kind: 'belt', recovered: {} });
        }
        for (const r of entry.rotated) {
          const s = w.structures[r.id];
          if (s?.belt) {
            this.setBeltFacing(s, r.prev);
            events.push({ type: 'rotated', structureId: s.id });
          }
        }
        return { ok: true, ids: belts.map((b) => b.id) };
      }
      case 'remove': {
        if (this.at(entry.x, entry.y)) return { ok: false, error: 'undo_unsafe', message: 'Cannot undo: that tile is taken now.' };
        if (w.coins < entry.refund) return { ok: false, error: 'unaffordable', message: 'Cannot undo: not enough coins to rebuild it.' };
        this.undoStack.pop();
        const s = makeStructure(w, entry.kind, entry.x, entry.y, entry.facing);
        w.structures[s.id] = s;
        this.index.set(s);
        w.coins -= entry.refund;
        events.push({ type: 'placed', structureId: s.id, kind: s.kind });
        return { ok: true, ids: [s.id] };
      }
      case 'rotate': {
        this.undoStack.pop();
        const s = w.structures[entry.id];
        if (!s) return this.undo(events);
        if (s.kind === 'belt') this.setBeltFacing(s, entry.prev);
        else s.facing = entry.prev;
        events.push({ type: 'rotated', structureId: s.id });
        return { ok: true, ids: [s.id] };
      }
    }
  }

  private basketDrop(kind: ItemKind, x: number, y: number): ActionResult {
    if (!ITEMS[kind]) return { ok: false, error: 'invalid' };
    if ((this.world.basket[kind] ?? 0) <= 0) return { ok: false, error: 'basket_empty', message: 'Your basket has none of those.' };
    const s = this.at(x, y);
    if (!s || s.kind !== 'belt') return { ok: false, error: 'not_a_belt', message: 'Drop basket items onto an empty belt.' };
    if (s.belt!.item) return { ok: false, error: 'belt_occupied', message: 'That belt already has something on it.' };
    const item = newItem(this.world, kind);
    s.belt!.item = item;
    s.belt!.progress = 0;
    s.belt!.from = opposite(s.facing);
    s.belt!.block = 'none';
    s.belt!.stuckTicks = 0;
    this.world.basket[kind]! -= 1;
    if (this.world.basket[kind] === 0) delete this.world.basket[kind];
    return { ok: true, ids: [s.id] };
  }

  private expand(events: SimEvent[]): ActionResult {
    const w = this.world;
    if (!w.expansionUnlocked) return { ok: false, error: 'expansion_locked', message: 'The extra garden plot is not available yet.' };
    if (w.expanded) return { ok: false, error: 'already_expanded', message: 'The garden is already expanded.' };
    if (w.coins < EXPANSION_COST) return { ok: false, error: 'unaffordable', message: `Expanding costs ${EXPANSION_COST} coins.` };
    w.coins -= EXPANSION_COST;
    w.expanded = true;
    w.width = EXPANDED_GRID.width;
    w.height = EXPANDED_GRID.height;
    events.push({ type: 'expanded' });
    return { ok: true };
  }

  private pushUndo(entry: UndoEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > UNDO_STACK_LIMIT) this.undoStack.shift();
  }
}

/** Every item currently in the world, by kind, including stock and basket. Used by tests. */
export function countAllItems(world: World): Counts {
  const counts: Counts = {};
  for (const s of Object.values(world.structures)) for (const i of itemsIn(s)) addCounts(counts, i.kind);
  for (const [k, n] of Object.entries(world.stock)) addCounts(counts, k as ItemKind, n ?? 0);
  for (const [k, n] of Object.entries(world.basket)) addCounts(counts, k as ItemKind, n ?? 0);
  return counts;
}
