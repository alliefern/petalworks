import { PACKING_START, START_COINS, UNDO_STACK_LIMIT } from './data/balance';
import { ITEMS } from './data/items';
import { ORDERS } from './data/orders';
import { boundsOf, EXPANSION_PLOT_ID, plotById, START_PLOT_IDS } from './data/plots';
import { STRUCTURES } from './data/structures';
import { dirBetween, isAnyPlotTile, isOpenTile, opposite, structureAt, TileIndex } from './grid';
import { allocateStock, isSandbox, startOrder } from './orders';
import { newItem, tickProcessors, tickProducers } from './production';
import { tickBelts } from './transport';
import type { Action, ActionResult, Counts, Dir, Item, ItemKind, SimEvent, Structure, StructureKind, World } from './types';

export type UndoEntry =
  | { type: 'place'; id: number; cost: number }
  | { type: 'belt_path'; placed: number[]; rotated: Array<{ id: number; prev: Dir }>; cost: number }
  | { type: 'remove'; kind: StructureKind; x: number; y: number; facing: Dir; refund: number }
  | { type: 'rotate'; id: number; prev: Dir };

export function createWorld(): World {
  const { cols, rows } = boundsOf(START_PLOT_IDS);
  const world: World = {
    tick: 0,
    cols,
    rows,
    unlockedPlotIds: [...START_PLOT_IDS],
    structures: {},
    nextStructureId: 1,
    nextItemId: 1,
    coins: START_COINS,
    stock: {},
    basket: {},
    orders: { activeId: null, offeredIds: [], completedIds: [], progress: { orderId: null, delivered: {} } },
    unlocked: [],
    expansionUnlocked: false,
    stats: { delivered: 0, crafted: 0, coinsEarned: 0 },
  };
  // The Packing Station is part of the yard: free, pre-placed, and it stays.
  const packing = makeStructure(world, 'packing_station', PACKING_START.x, PACKING_START.y, 0);
  world.structures[packing.id] = packing;
  startOrder(world, ORDERS[0].id, []);
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
      s.producer = { growTicks: 0, output: null, blockedTicks: 0, block: 'none' };
      break;
    case 'processor':
      s.processor = {
        recipeId: def.recipeIds![0],
        inputs: [],
        outputs: [],
        workTicks: null,
        blockedTicks: 0,
        block: 'none',
        lastRefusedTick: -1,
        lastRefusedKind: null,
      };
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
 *
 * Tick order is fixed: transport (belts advance and transfer), then production
 * (beds grow, machines craft, and both push finished items out), then orders
 * (deliveries allocate to the active order). A craft that finishes on tick T leaves
 * on tick T if its output tile is free, and a belt tile freed by transport can be
 * refilled by a bed in the same tick, so a packed line never shows a false "blocked".
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

  /** Is the tile inside an open plot (buildable)? */
  isOpen(x: number, y: number): boolean {
    return isOpenTile(this.world, x, y);
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
    if (!def.buildable) return { ok: false, error: 'not_buildable', message: `${def.name} is already in the yard.` };
    if (!this.isUnlocked(kind)) return { ok: false, error: 'locked', message: 'That unlocks later.' };
    if (!isOpenTile(w, x, y)) {
      if (isAnyPlotTile(x, y)) return { ok: false, error: 'locked_plot', message: 'That part of the garden is still closed.' };
      return { ok: false, error: 'out_of_bounds', message: 'That spot is outside the garden.' };
    }
    if (this.at(x, y)) return { ok: false, error: 'occupied', message: 'That tile already has something on it.' };
    if (w.coins < def.cost) return { ok: false, error: 'unaffordable', message: `Not enough coins. This costs ${def.cost}. You have ${w.coins}.` };
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
    if (!this.isUnlocked('belt')) return { ok: false, error: 'locked', message: 'That unlocks later.' };
    if (tiles.length === 0) return { ok: false, error: 'invalid' };
    const cost = STRUCTURES.belt.cost;
    const placed: number[] = [];
    const rotated: Array<{ id: number; prev: Dir }> = [];
    let spent = 0;
    let unaffordable = false;
    let skipped = false;
    let lastDir: Dir | null = null;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const next = tiles[i + 1];
      let facing: Dir | null = next ? dirBetween(t.x, t.y, next.x, next.y) : lastDir;
      if (facing === null) facing = t.facing ?? 1;
      lastDir = facing;
      if (!isOpenTile(this.world, t.x, t.y)) continue;
      const existing = this.at(t.x, t.y);
      if (existing) {
        if (existing.kind === 'belt' && existing.facing !== facing && tiles.length > 1) {
          rotated.push({ id: existing.id, prev: existing.facing });
          this.setBeltFacing(existing, facing);
          events.push({ type: 'rotated', structureId: existing.id });
        } else if (existing.kind !== 'belt') skipped = true;
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
    if (placed.length || rotated.length) this.pushUndo({ type: 'belt_path', placed, rotated, cost: spent });
    if (unaffordable) {
      return {
        ok: placed.length > 0,
        error: 'unaffordable',
        message: placed.length ? 'Not enough coins to finish this path.' : `Not enough coins. This costs ${cost}. You have ${this.world.coins}.`,
        ids: placed,
      };
    }
    if (!placed.length && !rotated.length) return { ok: false, error: 'occupied', message: 'That tile already has something on it.' };
    return { ok: true, ids: [...placed, ...rotated.map((r) => r.id)], message: skipped ? 'Full tiles were skipped.' : undefined };
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
    if (!STRUCTURES[s.kind].hasFacing) return { ok: false, error: 'invalid', message: 'The Packing Station takes deliveries from every side. It has no direction.' };
    const target: Dir = facing ?? (((s.facing + 1) % 4) as Dir);
    if (target === s.facing) return { ok: true, ids: [id] };
    const prev = s.facing;
    if (s.kind === 'belt') this.setBeltFacing(s, target);
    else {
      s.facing = target;
      if (s.producer) {
        s.producer.blockedTicks = 0;
        s.producer.block = 'none';
      }
      if (s.processor) {
        s.processor.blockedTicks = 0;
        s.processor.block = 'none';
      }
    }
    this.pushUndo({ type: 'rotate', id, prev });
    events.push({ type: 'rotated', structureId: id });
    return { ok: true, ids: [id] };
  }

  private remove(id: number, events: SimEvent[]): ActionResult {
    const s = this.world.structures[id];
    if (!s) return { ok: false, error: 'unknown_structure', message: 'Nothing there to remove.' };
    const def = STRUCTURES[s.kind];
    if (!def.removable) return { ok: false, error: 'not_removable', message: `The ${def.name} stays in the yard.` };
    const refund = def.refund;
    const recovered: Counts = {};
    for (const item of itemsIn(s)) {
      addCounts(this.world.basket, item.kind);
      addCounts(recovered, item.kind);
    }
    delete this.world.structures[id];
    this.index.clear(s.x, s.y);
    this.world.coins += refund;
    this.pushUndo({ type: 'remove', kind: s.kind, x: s.x, y: s.y, facing: s.facing, refund });
    events.push({ type: 'removed', structureId: id, kind: s.kind, recovered, refund });
    const n = totalCount(recovered);
    const parts: string[] = [];
    if (n === 1) parts.push(`${ITEMS[Object.keys(recovered)[0] as ItemKind].name} went to the basket.`);
    else if (n > 1) parts.push('Items went to the basket.');
    if (refund > 0) parts.push(`${refund} coins returned.`);
    return { ok: true, ids: [id], refund, message: parts.length ? parts.join(' ') : undefined };
  }

  private undo(events: SimEvent[]): ActionResult {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return { ok: false, error: 'nothing_to_undo', message: 'Nothing to undo yet.' };
    const w = this.world;
    switch (entry.type) {
      case 'place': {
        const s = w.structures[entry.id];
        if (!s) {
          this.undoStack.pop();
          return this.undo(events);
        }
        if (itemsIn(s).length) return { ok: false, error: 'undo_unsafe', message: 'Undo would drop items, so nothing changed.' };
        this.undoStack.pop();
        delete w.structures[s.id];
        this.index.clear(s.x, s.y);
        w.coins += entry.cost;
        events.push({ type: 'removed', structureId: s.id, kind: s.kind, recovered: {}, refund: entry.cost });
        return { ok: true, ids: [s.id] };
      }
      case 'belt_path': {
        const belts = entry.placed.map((id) => w.structures[id]).filter((s): s is Structure => !!s);
        if (belts.some((s) => itemsIn(s).length)) {
          return { ok: false, error: 'undo_unsafe', message: 'Undo would drop items, so nothing changed.' };
        }
        this.undoStack.pop();
        for (const s of belts) {
          delete w.structures[s.id];
          this.index.clear(s.x, s.y);
          w.coins += STRUCTURES.belt.cost;
          events.push({ type: 'removed', structureId: s.id, kind: 'belt', recovered: {}, refund: STRUCTURES.belt.cost });
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
        if (this.at(entry.x, entry.y)) return { ok: false, error: 'undo_unsafe', message: 'That tile is taken now, so nothing changed.' };
        if (w.coins < entry.refund) return { ok: false, error: 'unaffordable', message: 'Not enough coins to put that back.' };
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
    if ((this.world.basket[kind] ?? 0) <= 0) return { ok: false, error: 'basket_empty', message: 'The basket has none of those.' };
    const s = this.at(x, y);
    if (!s || s.kind !== 'belt') return { ok: false, error: 'not_a_belt', message: 'Put that on an empty belt.' };
    if (s.belt!.item) return { ok: false, error: 'belt_occupied', message: 'That belt is holding something.' };
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
    const plot = plotById(EXPANSION_PLOT_ID)!;
    if (!w.expansionUnlocked) return { ok: false, error: 'expansion_locked', message: 'More garden opens later.' };
    if (w.unlockedPlotIds.includes(plot.id)) return { ok: false, error: 'already_expanded', message: 'The far plot is already open.' };
    if (w.coins < plot.cost) return { ok: false, error: 'unaffordable', message: `Not enough coins. Opening the plot costs ${plot.cost}. You have ${w.coins}.` };
    w.coins -= plot.cost;
    w.unlockedPlotIds.push(plot.id);
    const b = boundsOf(w.unlockedPlotIds);
    w.cols = b.cols;
    w.rows = b.rows;
    events.push({ type: 'expanded' });
    return { ok: true, message: 'The far plot is open.' };
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
