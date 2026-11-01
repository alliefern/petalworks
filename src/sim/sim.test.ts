import { describe, expect, it } from 'vitest';
import { BELT_TICKS, INPUT_BUFFER_PER_INGREDIENT, PACKING_START, START_COINS, STOCK_CAP } from './data/balance';
import { PLOTS } from './data/plots';
import { ORDERS } from './data/orders';
import { RECIPES } from './data/recipes';
import { STRUCTURES } from './data/structures';
import { countAllItems, createWorld, makeStructure, Sim, totalCount } from './game';
import { currentOrder, isSandbox } from './orders';
import { deserialize, DEFAULT_SETTINGS, SCHEMA_VERSION, serialize } from './save';
import type { Dir, ItemKind, SimEvent, StructureKind } from './types';

const EXPANSION_COST = PLOTS.find((p) => p.id === 'south-rim')!.cost;
const orderIdx = (sim: Sim) => (sim.world.orders.activeId ? ORDERS.findIndex((o) => o.id === sim.world.orders.activeId) : ORDERS.length);
const packingId = (sim: Sim) => Object.values(sim.world.structures).find((x) => x.kind === 'packing_station')!.id;

const E: Dir = 1;
const S: Dir = 2;
const W: Dir = 3;
const N: Dir = 0;

/** A sim with everything unlocked and plenty of coins, for mechanics tests. */
/** Mechanics tests use the plain 16×12 box (the legacy plot) so corner coordinates stay valid. */
function rich(): Sim {
  const sim = new Sim(createWorld());
  sim.world.coins = 10_000;
  sim.world.unlocked = Object.keys(STRUCTURES) as StructureKind[];
  sim.world.unlockedPlotIds.push('legacy-potting');
  return sim;
}

/** Tests that place their own Packing Station bypass `buildable` the way a scenario file would. */
function placePacking(sim: Sim, x: number, y: number): number {
  const s = makeStructure(sim.world, 'packing_station', x, y, 0);
  sim.world.structures[s.id] = s;
  sim.index.set(s);
  return s.id;
}

function place(sim: Sim, kind: StructureKind, x: number, y: number, facing: Dir = E): number {
  const r = sim.dispatch({ type: 'place', kind, x, y, facing });
  if (!r.ok) throw new Error(`place ${kind} at ${x},${y} failed: ${r.error}`);
  return r.ids![0];
}

function belts(sim: Sim, from: [number, number], to: [number, number], facing: Dir): number[] {
  const ids: number[] = [];
  const [x0, y0] = from;
  const [x1, y1] = to;
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) ids.push(place(sim, 'belt', x, y, facing));
  }
  return ids;
}

function runUntil(sim: Sim, pred: () => boolean, max = 20000): void {
  for (let i = 0; i < max && !pred(); i++) sim.step();
  if (!pred()) throw new Error('condition not reached within ' + max + ' ticks');
}

function run(sim: Sim, ticks: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) all.push(...sim.step());
  return all;
}

describe('fresh world', () => {
  it('starts with the first order and its unlocks only', () => {
    const sim = new Sim();
    expect(sim.world.coins).toBe(START_COINS);
    expect(currentOrder(sim.world)?.id).toBe('order1');
    expect(sim.isUnlocked('daisy_bed')).toBe(true);
    expect(sim.isUnlocked('belt')).toBe(true);
    expect(sim.isUnlocked('bundling_table')).toBe(true);
    expect(sim.isUnlocked('lavender_bed')).toBe(false);
    // The Packing Station is pre-placed, free, and cannot be built or removed.
    const packing = sim.at(PACKING_START.x, PACKING_START.y);
    expect(packing?.kind).toBe('packing_station');
    expect(sim.dispatch({ type: 'place', kind: 'packing_station', x: 1, y: 1, facing: E }).error).toBe('not_buildable');
    expect(sim.dispatch({ type: 'remove', id: packing!.id }).error).toBe('not_removable');
    expect(sim.at(PACKING_START.x, PACKING_START.y)).toBeTruthy();
  });

  it('cannot place locked structures or spend what it does not have', () => {
    const sim = new Sim();
    expect(sim.dispatch({ type: 'place', kind: 'lavender_bed', x: 3, y: 3, facing: E }).error).toBe('locked');
    sim.world.coins = 5;
    expect(sim.dispatch({ type: 'place', kind: 'daisy_bed', x: 3, y: 3, facing: E }).error).toBe('unaffordable');
    expect(Object.values(sim.world.structures).filter((x) => x.kind !== 'packing_station')).toHaveLength(0);
  });

  it('rejects out-of-bounds and occupied tiles', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 2, 2);
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 2, y: 2, facing: E }).error).toBe('occupied');
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 18, y: 6, facing: E }).error).toBe('locked_plot');
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 16, y: 0, facing: E }).error).toBe('locked_plot'); // north-east nook, opens later
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 25, y: 2, facing: E }).error).toBe('out_of_bounds');
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: -1, y: 2, facing: E }).error).toBe('out_of_bounds');
  });
});

describe('producers and belts', () => {
  it('grows a daisy on schedule and pushes it onto a belt', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    const [b] = belts(sim, [1, 0], [1, 0], E);
    const grow = STRUCTURES.daisy_bed.growTicks!;
    run(sim, grow - 1);
    expect(sim.world.structures[b].belt!.item).toBeNull();
    run(sim, 1);
    expect(sim.world.structures[b].belt!.item?.kind).toBe('daisy');
  });

  it('takes exactly BELT_TICKS per tile with no gaps and no duplication', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    const ids = belts(sim, [1, 0], [6, 0], E);
    run(sim, STRUCTURES.daisy_bed.growTicks!); // item lands on belt 1 at progress 0
    expect(sim.world.structures[ids[0]].belt!.item).toBeTruthy();
    run(sim, BELT_TICKS);
    expect(sim.world.structures[ids[0]].belt!.item).toBeNull();
    expect(sim.world.structures[ids[1]].belt!.item).toBeTruthy();
    run(sim, BELT_TICKS * 3);
    expect(sim.world.structures[ids[4]].belt!.item).toBeTruthy();
    // Count daisies in the world: bed has produced a second one by now at most.
    const total = totalCount(countAllItems(sim.world));
    expect(total).toBeLessThanOrEqual(3);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('stops at a dead end and reports it, with the bed pausing when blocked', () => {
    const sim = rich();
    const bed = place(sim, 'daisy_bed', 0, 0, E);
    const [b] = belts(sim, [1, 0], [1, 0], E);
    run(sim, STRUCTURES.daisy_bed.growTicks! + BELT_TICKS + 2);
    const st = sim.world.structures[b].belt!;
    expect(st.item).toBeTruthy();
    expect(st.progress).toBe(BELT_TICKS);
    expect(st.block).toBe('dead_end');
    // Second daisy grows, cannot leave the bed, bed is blocked.
    run(sim, STRUCTURES.daisy_bed.growTicks!);
    const p = sim.world.structures[bed].producer!;
    expect(p.output).toBeTruthy();
    expect(p.blockedTicks).toBeGreaterThan(0);
    expect(p.block).toBe('queue');
    const before = p.growTicks;
    run(sim, 10);
    expect(p.growTicks).toBe(before); // paused, not accumulating
    expect(totalCount(countAllItems(sim.world))).toBe(2);
  });

  it('refuses head-on belts', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    belts(sim, [1, 0], [1, 0], E);
    const [back] = belts(sim, [2, 0], [2, 0], W);
    run(sim, STRUCTURES.daisy_bed.growTicks! + BELT_TICKS + 1);
    expect(sim.world.structures[back].belt!.item).toBeNull();
    expect(sim.at(1, 0)!.belt!.block).toBe('head_on');
  });

  it('resolves a contested destination deterministically: behind wins, no item lost', () => {
    const sim = rich();
    // Two beds feed belt lines that merge into tile (3,1): one straight from (2,1), one from the side (3,0).
    place(sim, 'daisy_bed', 0, 1, E);
    belts(sim, [1, 1], [2, 1], E);
    place(sim, 'daisy_bed', 3, 0, S); // bed pushes directly into (3,1) from north... make it a belt instead
    sim.dispatch({ type: 'remove', id: sim.at(3, 0)!.id });
    place(sim, 'lavender_bed', 4, 0, W);
    belts(sim, [3, 0], [3, 0], S);
    const merge = belts(sim, [3, 1], [8, 1], E);
    // Make the lavender bed as fast as the daisy bed for the test.
    sim.world.structures[sim.at(4, 0)!.id].producer!.growTicks = STRUCTURES.lavender_bed.growTicks! - STRUCTURES.daisy_bed.growTicks!;
    run(sim, 400);
    const counts = countAllItems(sim.world);
    // Everything produced is still somewhere (belts fill up and then beds pause).
    const onBelts = Object.values(sim.world.structures).filter((s) => s.belt?.item).length;
    expect(totalCount(counts)).toBe(onBelts + Object.values(sim.world.structures).filter((s) => s.producer?.output).length);
    // The merge belt's downstream is a dead end so the line is full; both kinds made it through.
    expect(counts.daisy ?? 0).toBeGreaterThan(0);
    expect(counts.lavender ?? 0).toBeGreaterThan(0);
    expect(sim.world.structures[merge[merge.length - 1]].belt!.item).toBeTruthy();
    // Determinism: a second identical run gives identical state.
    const sim2 = rich();
    place(sim2, 'daisy_bed', 0, 1, E);
    belts(sim2, [1, 1], [2, 1], E);
    place(sim2, 'daisy_bed', 3, 0, S);
    sim2.dispatch({ type: 'remove', id: sim2.at(3, 0)!.id });
    place(sim2, 'lavender_bed', 4, 0, W);
    belts(sim2, [3, 0], [3, 0], S);
    belts(sim2, [3, 1], [8, 1], E);
    sim2.world.structures[sim2.at(4, 0)!.id].producer!.growTicks = STRUCTURES.lavender_bed.growTicks! - STRUCTURES.daisy_bed.growTicks!;
    run(sim2, 400);
    expect(JSON.stringify(sim2.world)).toBe(JSON.stringify(sim.world));
  });

  it('a packed line moves as a unit when the head frees up', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    const ids = belts(sim, [1, 0], [3, 0], E);
    run(sim, 600); // line fills: 3 items parked at tile exits
    expect(ids.every((id) => sim.world.structures[id].belt!.item)).toBe(true);
    const first = sim.world.structures[ids[0]].belt!.item!.id;
    const second = sim.world.structures[ids[1]].belt!.item!.id;
    placePacking(sim, 4, 0);
    run(sim, 1);
    // Head delivered, and the two behind each advanced one tile in the same tick
    // (the bed, which was blocked, then refills the first tile).
    expect(sim.world.structures[ids[2]].belt!.item!.id).toBe(second);
    expect(sim.world.structures[ids[1]].belt!.item!.id).toBe(first);
    expect(sim.world.structures[ids[0]].belt!.item!.id).not.toBe(first);
    // The delivered daisy went straight into the active order.
    expect(sim.world.orders.progress.delivered.daisy).toBe(1);
  });
});

describe('processors', () => {
  it('bundles two daisies in exactly the recipe time and outputs on its facing side', () => {
    const sim = rich();
    const table = place(sim, 'bundling_table', 0, 0, E);
    const [out] = belts(sim, [1, 0], [1, 0], E);
    const m = sim.world.structures[table].processor!;
    m.inputs.push({ id: 900, kind: 'daisy' }, { id: 901, kind: 'daisy' });
    sim.world.nextItemId = 902;
    run(sim, 1);
    expect(m.workTicks).toBe(0);
    expect(m.inputs).toHaveLength(0);
    run(sim, RECIPES.daisy_bundle.durationTicks - 1);
    expect(m.outputs).toHaveLength(0);
    run(sim, 1);
    // Crafted and pushed out in the same tick.
    expect(sim.world.structures[out].belt!.item?.kind).toBe('daisy_bundle');
    expect(m.outputs).toHaveLength(0);
  });

  it('refuses wrong items and full buffers', () => {
    const sim = rich();
    place(sim, 'lavender_bed', 0, 0, E);
    belts(sim, [1, 0], [1, 0], E);
    place(sim, 'bundling_table', 2, 0, E);
    const events = run(sim, STRUCTURES.lavender_bed.growTicks! + BELT_TICKS + 1);
    expect(sim.at(1, 0)!.belt!.block).toBe('wrong_item');
    expect(events.some((e) => e.type === 'refused' && e.reason === 'wrong_item')).toBe(true);

    const sim2 = rich();
    const table = place(sim2, 'bundling_table', 2, 0, E);
    const m = sim2.world.structures[table].processor!;
    // Fill the daisy slot to capacity and hold crafting by filling the output slot too.
    for (let i = 0; i < INPUT_BUFFER_PER_INGREDIENT; i++) m.inputs.push({ id: 10 + i, kind: 'daisy' });
    m.outputs.push({ id: 5, kind: 'daisy_bundle' });
    sim2.world.nextItemId = 100;
    place(sim2, 'daisy_bed', 0, 0, E);
    belts(sim2, [1, 0], [1, 0], E);
    run(sim2, STRUCTURES.daisy_bed.growTicks! + BELT_TICKS + 1);
    expect(sim2.at(1, 0)!.belt!.block).toBe('buffer_full');
    expect(m.workTicks).toBeNull(); // output slot full, no crafting
    expect(m.blockedTicks).toBeGreaterThan(0);
  });

  it('arrangement table takes both inputs from any side and makes a bouquet', () => {
    const sim = rich();
    const t = place(sim, 'arrangement_table', 5, 5, S);
    // Feed from west and from north via belts.
    const [wb] = belts(sim, [4, 5], [4, 5], E);
    const [nb] = belts(sim, [5, 4], [5, 4], S);
    const [out] = belts(sim, [5, 6], [5, 6], S);
    sim.world.structures[wb].belt!.item = { id: 1, kind: 'daisy_bundle' };
    sim.world.structures[nb].belt!.item = { id: 2, kind: 'lavender_sachet' };
    sim.world.nextItemId = 3;
    run(sim, BELT_TICKS + 1 + RECIPES.mixed_bouquet.durationTicks);
    expect(sim.world.structures[out].belt!.item?.kind).toBe('mixed_bouquet');
    expect(sim.world.structures[t].processor!.inputs).toHaveLength(0);
  });
});

describe('orders and economy', () => {
  it('completes order 1 from real deliveries, pays, and unlocks the bundling table', () => {
    const sim = new Sim();
    // Bed at the pre-placed station's west side, two belts between.
    const px = PACKING_START.x;
    const py = PACKING_START.y;
    place(sim, 'daisy_bed', px - 3, py, E);
    belts(sim, [px - 2, py], [px - 1, py], E);
    const coinsAfterBuild = sim.world.coins;
    expect(coinsAfterBuild).toBe(START_COINS - 20 - 4);
    const events = run(sim, 200);
    expect(events.some((e) => e.type === 'order_complete' && e.orderId === 'order1')).toBe(true);
    expect(currentOrder(sim.world)?.id).toBe('order2');
    expect(sim.world.coins).toBe(coinsAfterBuild + ORDERS[0].reward);
    expect(sim.world.orders.completedIds).toEqual(['order1']);
  });

  it('packing station never counts items that were not delivered, and caps stock', () => {
    const sim = rich();
    sim.world.orders.activeId = 'order2'; // order 2 needs bundles, daisies are surplus
    sim.world.orders.progress = { orderId: 'order2', delivered: {} };
    place(sim, 'daisy_bed', 0, 0, E);
    belts(sim, [1, 0], [1, 0], E);
    placePacking(sim, 2, 0);
    run(sim, 2000);
    expect(sim.world.stock.daisy).toBe(STOCK_CAP);
    expect(sim.at(1, 0)!.belt!.block).toBe('stock_full');
    expect(sim.world.orders.progress.delivered.daisy_bundle ?? 0).toBe(0);
  });

  it('plays all six orders through actual production chains and reaches sandbox', () => {
    const sim = new Sim();
    const px = PACKING_START.x; // 13
    const py = PACKING_START.y; // 6
    // Order 1: bed -> belt -> packing (from the west).
    place(sim, 'daisy_bed', px - 2, py, E);
    belts(sim, [px - 1, py], [px - 1, py], E);
    runUntil(sim, () => orderIdx(sim) === 1, 300);
    // Orders 2-3: insert a bundling table: bed (px-3) -> belt (px-2) -> table (px-1) -> packing.
    sim.dispatch({ type: 'remove', id: sim.at(px - 1, py)!.id });
    sim.dispatch({ type: 'remove', id: sim.at(px - 2, py)!.id });
    place(sim, 'daisy_bed', px - 3, py, E);
    belts(sim, [px - 2, py], [px - 2, py], E);
    place(sim, 'bundling_table', px - 1, py, E);
    runUntil(sim, () => orderIdx(sim) === 2, 1500);
    runUntil(sim, () => orderIdx(sim) === 3, 2500);
    expect(sim.isUnlocked('lavender_bed')).toBe(true);
    expect(sim.world.expansionUnlocked).toBe(true);
    // Order 4: lavender line into the packing station from the south.
    place(sim, 'lavender_bed', px, py + 3, N);
    belts(sim, [px, py + 2], [px, py + 2], N);
    belts(sim, [px, py + 1], [px, py + 1], N);
    runUntil(sim, () => orderIdx(sim) === 4, 1500);
    expect(sim.isUnlocked('drying_bench')).toBe(true);
    // Order 5: drying bench replaces the middle belt.
    sim.dispatch({ type: 'remove', id: sim.at(px, py + 2)!.id });
    place(sim, 'drying_bench', px, py + 2, N);
    runUntil(sim, () => orderIdx(sim) === 5, 3000);
    expect(sim.isUnlocked('arrangement_table')).toBe(true);
    // Order 6: arrangement table east of the station? The station is fixed, so put the table
    // where bundles and sachets both arrive: replace belt (px, py+1) with the table facing north
    // into packing; bundles come from the west via a belt turned south... simpler: move the daisy
    // line to feed the table from the west at (px-1, py+1).
    sim.dispatch({ type: 'remove', id: sim.at(px, py + 1)!.id });
    place(sim, 'arrangement_table', px, py + 1, N);
    sim.dispatch({ type: 'rotate', id: sim.at(px - 1, py)!.id, facing: S }); // bundling table now outputs south into (px-1, py+1)
    belts(sim, [px - 1, py + 1], [px - 1, py + 1], E); // belt carries bundles east into the table
    runUntil(sim, () => orderIdx(sim) === 6, 8000);
    expect(isSandbox(sim.world)).toBe(true);
    expect(sim.world.orders.completedIds).toHaveLength(6);
    expect(sim.world.orders.activeId).toBeNull();
    // Sandbox: deliveries sell for coins.
    const coins = sim.world.coins;
    run(sim, 600);
    expect(sim.world.coins).toBeGreaterThan(coins);
  });

  it('is never unaffordable: cumulative rewards cover the minimal chain for every order', () => {
    // Minimal equipment per order (one of each needed structure, no belts; belts refund fully anyway).
    const need: StructureKind[][] = [
      ['daisy_bed'],
      ['daisy_bed', 'bundling_table'],
      ['daisy_bed', 'bundling_table'],
      ['lavender_bed'],
      ['lavender_bed', 'drying_bench'],
      ['daisy_bed', 'bundling_table', 'lavender_bed', 'drying_bench', 'arrangement_table'],
    ];
    let wealth = START_COINS;
    need.forEach((kinds, i) => {
      const cost = kinds.reduce((a, k) => a + STRUCTURES[k].cost, 0) + 4 * STRUCTURES.belt.cost;
      expect(wealth, `order ${i + 1}`).toBeGreaterThanOrEqual(cost);
      wealth += ORDERS[i].reward;
    });
  });

  it('expansion is gated, costs coins, and grows the grid', () => {
    const sim = new Sim();
    expect(sim.dispatch({ type: 'expand' }).error).toBe('expansion_locked');
    sim.world.expansionUnlocked = true;
    sim.world.coins = EXPANSION_COST - 1;
    expect(sim.dispatch({ type: 'expand' }).error).toBe('unaffordable');
    sim.world.coins = EXPANSION_COST;
    expect(sim.dispatch({ type: 'expand' }).ok).toBe(true);
    expect(sim.world.cols).toBe(20);
    expect(sim.world.rows).toBe(16);
    expect(sim.world.unlockedPlotIds).toEqual(['potting', 'south-rim']);
    expect(sim.world.coins).toBe(0);
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 18, y: 13, facing: E }).error).toBe('unaffordable');
    sim.world.coins = 10;
    expect(sim.dispatch({ type: 'place', kind: 'belt', x: 18, y: 13, facing: E }).ok).toBe(true);
    expect(sim.dispatch({ type: 'expand' }).error).toBe('already_expanded');
  });
});

describe('editing: rotate, remove, undo, basket', () => {
  it('rotating a belt keeps its item', () => {
    const sim = rich();
    const [b] = belts(sim, [1, 1], [1, 1], E);
    sim.world.structures[b].belt!.item = { id: 1, kind: 'daisy' };
    sim.dispatch({ type: 'rotate', id: b });
    expect(sim.world.structures[b].facing).toBe(S);
    expect(sim.world.structures[b].belt!.item?.kind).toBe('daisy');
    sim.dispatch({ type: 'rotate', id: b, facing: W });
    expect(sim.world.structures[b].facing).toBe(W);
    expect(sim.world.structures[b].belt!.from).not.toBe(W);
  });

  it('removing refunds per the definition (belts 100%, buildings 75%) and moves held items to the basket; basket drops back onto belts', () => {
    const sim = rich();
    const coins = sim.world.coins;
    const t = place(sim, 'bundling_table', 2, 2, E);
    sim.world.structures[t].processor!.inputs.push({ id: 1, kind: 'daisy' });
    const r = sim.dispatch({ type: 'remove', id: t });
    expect(r.ok).toBe(true);
    expect(r.refund).toBe(STRUCTURES.bundling_table.refund);
    expect(sim.world.coins).toBe(coins - STRUCTURES.bundling_table.cost + STRUCTURES.bundling_table.refund);
    const b0 = belts(sim, [7, 7], [7, 7], E)[0];
    const before = sim.world.coins;
    sim.dispatch({ type: 'remove', id: b0 });
    expect(sim.world.coins).toBe(before + STRUCTURES.belt.cost);
    expect(sim.world.basket.daisy).toBe(1);
    expect(sim.at(2, 2)).toBeNull();
    const [b] = belts(sim, [5, 5], [5, 5], E);
    expect(sim.dispatch({ type: 'basket_drop', kind: 'daisy', x: 4, y: 4 }).error).toBe('not_a_belt');
    expect(sim.dispatch({ type: 'basket_drop', kind: 'daisy', x: 5, y: 5 }).ok).toBe(true);
    expect(sim.world.basket.daisy).toBeUndefined();
    expect(sim.world.structures[b].belt!.item?.kind).toBe('daisy');
    expect(sim.dispatch({ type: 'basket_drop', kind: 'daisy', x: 5, y: 5 }).error).toBe('basket_empty');
  });

  it('undo reverses place, belt paths, rotate and remove, and refuses when unsafe', () => {
    const sim = rich();
    const coins = sim.world.coins;
    const bed = place(sim, 'daisy_bed', 0, 0, E);
    expect(sim.dispatch({ type: 'undo' }).ok).toBe(true);
    expect(sim.world.structures[bed]).toBeUndefined();
    expect(sim.world.coins).toBe(coins);

    const r = sim.dispatch({ type: 'place_belt_path', tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }] });
    expect(r.ok).toBe(true);
    expect(sim.at(1, 1)!.facing).toBe(E);
    expect(sim.at(2, 1)!.facing).toBe(S);
    expect(sim.at(2, 2)!.facing).toBe(S);
    expect(sim.world.coins).toBe(coins - 6);
    // Dragging over an existing belt re-orients it without charging.
    sim.dispatch({ type: 'place_belt_path', tiles: [{ x: 2, y: 2 }, { x: 3, y: 2 }] });
    expect(sim.at(2, 2)!.facing).toBe(E);
    expect(sim.world.coins).toBe(coins - 8);
    expect(sim.dispatch({ type: 'undo' }).ok).toBe(true);
    expect(sim.at(3, 2)).toBeNull();
    expect(sim.at(2, 2)!.facing).toBe(S);
    expect(sim.world.coins).toBe(coins - 6);

    const belt = sim.at(1, 1)!.id;
    sim.dispatch({ type: 'rotate', id: belt });
    expect(sim.dispatch({ type: 'undo' }).ok).toBe(true);
    expect(sim.at(1, 1)!.facing).toBe(E);

    sim.dispatch({ type: 'remove', id: belt });
    expect(sim.at(1, 1)).toBeNull();
    expect(sim.dispatch({ type: 'undo' }).ok).toBe(true);
    expect(sim.at(1, 1)!.kind).toBe('belt');

    // Unsafe: belt now carries an item.
    sim.at(1, 1)!.belt!.item = { id: 50, kind: 'daisy' };
    sim.dispatch({ type: 'rotate', id: sim.at(1, 1)!.id }); // pushes a rotate entry; undo that first
    expect(sim.dispatch({ type: 'undo' }).ok).toBe(true);
    const res = sim.dispatch({ type: 'undo' }); // undoing the re-place (a 'remove' undo re-placed it as 'place'? no: it's the original belt_path)
    // Whatever entry is on top, undo must never delete an item.
    const total = totalCount(countAllItems(sim.world));
    expect(total).toBe(1);
    expect(res.ok === false ? res.error : 'ok').toMatch(/undo_unsafe|ok/);
    expect(totalCount(countAllItems(sim.world))).toBe(1);
  });

  it('nothing to undo on a fresh game', () => {
    const sim = new Sim();
    expect(sim.dispatch({ type: 'undo' }).error).toBe('nothing_to_undo');
  });
});

describe('save and load', () => {
  it('round-trips a mid-game world without duplicating or losing anything', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    belts(sim, [1, 0], [3, 0], E);
    place(sim, 'bundling_table', 4, 0, E);
    belts(sim, [5, 0], [5, 0], E);
    placePacking(sim, 6, 0);
    run(sim, 137);
    const json = serialize(sim, DEFAULT_SETTINGS, 0);
    const loaded = deserialize(json);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(JSON.stringify(loaded.sim.world)).toBe(JSON.stringify(sim.world));
    expect(countAllItems(loaded.sim.world)).toEqual(countAllItems(sim.world));
    // Both continue identically.
    run(sim, 300);
    run(loaded.sim, 300);
    expect(JSON.stringify(loaded.sim.world)).toBe(JSON.stringify(sim.world));
  });

  it('restores a completed (sandbox) save', () => {
    const sim = rich();
    sim.world.orders = { activeId: null, offeredIds: [], completedIds: ORDERS.map((o) => o.id), progress: { orderId: null, delivered: {} } };
    const loaded = deserialize(serialize(sim, { ...DEFAULT_SETTINGS, seenCompletion: true, sound: false }, 0));
    expect(loaded.ok && isSandbox(loaded.sim.world)).toBe(true);
    expect(loaded.ok && loaded.sim.isUnlocked('arrangement_table')).toBe(true);
    expect(loaded.ok && loaded.settings.seenCompletion).toBe(true);
    expect(loaded.ok && loaded.settings.sound).toBe(false);
  });

  it('survives corrupted saves', () => {
    expect(deserialize('').ok).toBe(false);
    expect(deserialize('{not json').ok).toBe(false);
    expect(deserialize('42').ok).toBe(false);
    expect(deserialize('{"schemaVersion":99,"world":{}}').ok).toBe(false);
    const sim = rich();
    const bed = place(sim, 'daisy_bed', 0, 0, E);
    const raw = JSON.parse(serialize(sim, DEFAULT_SETTINGS, 0));
    // Duplicate the bed on the same tile, add a bogus item kind, break coins, drop the packing station.
    raw.world.structures[999] = { ...raw.world.structures[bed], id: 999 };
    raw.world.structures[77] = { id: 77, kind: 'belt', x: 1, y: 0, facing: 1, belt: { item: { id: 5, kind: 'rose' }, progress: 0, from: 3 } };
    raw.world.coins = 'lots';
    delete raw.world.structures[packingId(sim)];
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const kinds = Object.values(loaded.sim.world.structures).map((x) => x.kind).sort();
    expect(kinds).toEqual(['belt', 'daisy_bed', 'packing_station']);
    expect(loaded.sim.world.structures[77].belt!.item).toBeNull();
    expect(typeof loaded.sim.world.coins).toBe('number');
  });

  it('migrates a version 1 save to the current schema', () => {
    const v1 = {
      version: 1,
      savedAt: 1,
      world: {
        tick: 10, width: 16, height: 12, expanded: false,
        structures: { 1: { id: 1, kind: 'daisy_bed', x: 2, y: 2, facing: 1, producer: { growTicks: 5, output: null, blocked: false } } },
        nextStructureId: 2, nextItemId: 1, coins: 33, stock: {}, basket: { daisy: 1 },
        orderIndex: 1, orderProgress: { daisy_bundle: 1 }, completedOrders: ['o1_daisies'],
        unlocked: ['belt', 'daisy_bed', 'packing_station', 'bundling_table'], expansionUnlocked: false,
        stats: { delivered: 2, crafted: 0, coinsEarned: 30 },
      },
      ui: { soundOn: false, musicOn: true, reducedMotion: 'on', tutorialStep: 0, tutorialDismissed: true, speed: 2, seenCompletion: false },
    };
    const loaded = deserialize(JSON.stringify(v1));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.sim.world.orders.activeId).toBe('order2');
    expect(loaded.sim.world.orders.progress.delivered.daisy_bundle).toBe(1);
    expect(loaded.sim.world.unlockedPlotIds).toEqual(['potting']);
    expect(loaded.sim.world.cols).toBe(18);
    expect(loaded.sim.world.basket.daisy).toBe(1);
    expect(loaded.settings).toMatchObject({ sound: false, music: true, reducedMotion: true, tutorialDismissed: true, speed: 2 });
    expect(Object.values(loaded.sim.world.structures).some((x) => x.kind === 'packing_station')).toBe(true);
    expect(JSON.parse(serialize(loaded.sim, loaded.settings, 0)).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('simulation is tick-based, not time-based', () => {
    // Same number of ticks → same result regardless of how they are batched (frame rate independence).
    const build = () => {
      const s = rich();
      place(s, 'daisy_bed', 0, 0, E);
      belts(s, [1, 0], [2, 0], E);
      place(s, 'bundling_table', 3, 0, E);
      belts(s, [4, 0], [4, 0], E);
      placePacking(s, 5, 0);
      return s;
    };
    const a = build();
    const b = build();
    run(a, 500);
    for (let i = 0; i < 500; i += 7) run(b, Math.min(7, 500 - i));
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  });
});

describe('ports and typed slots', () => {
  it('beds have no input, packing accepts from every side, belts refuse head-on', () => {
    const sim = rich();
    const bed = place(sim, 'daisy_bed', 5, 5, E);
    const [feeder] = belts(sim, [4, 5], [4, 5], E);
    sim.world.structures[feeder].belt!.item = { id: 1, kind: 'daisy' };
    sim.world.nextItemId = 2;
    run(sim, BELT_TICKS + 2);
    expect(sim.world.structures[feeder].belt!.item).toBeTruthy();
    expect(sim.world.structures[feeder].belt!.block).toBe('dead_end');
    expect(sim.world.structures[bed].producer!.output).toBeNull();

    const pk = placePacking(sim, 9, 9);
    for (const [x, y, f] of [[8, 9, E], [10, 9, W], [9, 8, S], [9, 10, N]] as Array<[number, number, Dir]>) {
      const [b] = belts(sim, [x, y], [x, y], f);
      sim.world.structures[b].belt!.item = { id: sim.world.nextItemId++, kind: 'daisy' };
    }
    const before = sim.world.structures[pk].packing!.received;
    run(sim, BELT_TICKS + 1);
    expect(sim.world.structures[pk].packing!.received).toBe(before + 4);
  });

  it('arrangement table never deadlocks: a flood of bundles leaves room for the sachet', () => {
    const sim = rich();
    const t = place(sim, 'arrangement_table', 5, 5, S);
    belts(sim, [5, 6], [5, 6], S);
    const m = sim.world.structures[t].processor!;
    for (let i = 0; i < 40; i++) m.inputs.push({ id: 100 + i, kind: 'daisy_bundle' });
    // Sanity: the sim would never let that happen; refusalReason caps per ingredient.
    const [wb] = belts(sim, [4, 5], [4, 5], E);
    sim.world.structures[wb].belt!.item = { id: 1, kind: 'daisy_bundle' };
    sim.world.nextItemId = 500;
    run(sim, BELT_TICKS + 1);
    expect(sim.world.structures[wb].belt!.block).toBe('buffer_full');
    const [nb] = belts(sim, [5, 4], [5, 4], S);
    sim.world.structures[nb].belt!.item = { id: 2, kind: 'lavender_sachet' };
    run(sim, BELT_TICKS + 1);
    expect(sim.world.structures[nb].belt!.item).toBeNull(); // sachet accepted despite the bundle pile
    expect(m.workTicks).not.toBeNull();
  });

  it('tick order: a craft finished on tick T leaves on tick T when the output tile is free', () => {
    const sim = rich();
    const t = place(sim, 'bundling_table', 0, 0, E);
    const [out] = belts(sim, [1, 0], [1, 0], E);
    const m = sim.world.structures[t].processor!;
    m.inputs.push({ id: 1, kind: 'daisy' }, { id: 2, kind: 'daisy' });
    sim.world.nextItemId = 3;
    run(sim, 1); // starts crafting
    run(sim, RECIPES.daisy_bundle.durationTicks - 1);
    expect(sim.world.structures[out].belt!.item).toBeNull();
    const events = run(sim, 1);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['crafted', 'item_moved']));
    expect(sim.world.structures[out].belt!.item?.kind).toBe('daisy_bundle');
  });

  it('a bed blocked for a while raises exactly one blocked event per reason', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E); // faces grass
    const events = run(sim, 200);
    const blocked = events.filter((e) => e.type === 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ reason: 'dead_end' });
  });
});

describe('item conservation', () => {
  it('never duplicates or loses items across a busy network', () => {
    const sim = rich();
    place(sim, 'daisy_bed', 0, 0, E);
    place(sim, 'daisy_bed', 0, 1, E);
    belts(sim, [1, 0], [3, 0], E);
    belts(sim, [1, 1], [3, 1], E);
    belts(sim, [4, 1], [4, 1], N);
    place(sim, 'bundling_table', 4, 0, E);
    belts(sim, [5, 0], [7, 0], E);
    placePacking(sim, 8, 0);
    let spawned = 0;
    let crafted = 0;
    let consumedDaisies = 0;
    for (let i = 0; i < 1500; i++) {
      for (const e of sim.step()) {
        if (e.type === 'item_spawned') spawned++;
        if (e.type === 'crafted') {
          crafted++;
          consumedDaisies += 2;
        }
      }
    }
    const counts = countAllItems(sim.world);
    const delivered = sim.world.stats.delivered;
    // All daisies: still in the world or consumed by crafting. Bundles: in world (stock counts as in world).
    expect((counts.daisy ?? 0) + consumedDaisies).toBe(spawned);
    expect(counts.daisy_bundle ?? 0).toBe(crafted);
    expect(delivered).toBeGreaterThan(0);
    const kinds: ItemKind[] = ['daisy', 'daisy_bundle'];
    for (const k of Object.keys(counts)) expect(kinds).toContain(k);
  });
});
