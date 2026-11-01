import { describe, expect, it } from 'vitest';
import { PACKING_START } from './data/balance';
import { boundsOf, EXPANSION_PLOT_ID, PLOTS, plotById, START_PLOT_IDS, tilesOf } from './data/plots';
import { createWorld, Sim } from './game';
import { isOpenTile } from './grid';
import { DEFAULT_SETTINGS, deserialize, serialize } from './save';

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

describe('garden plots', () => {
  it('starting plot is irregular (not its bounding box) with a workable size and no negative tiles', () => {
    const tiles = tilesOf(START_PLOT_IDS);
    const b = boundsOf(START_PLOT_IDS);
    expect(tiles.length).toBeLessThan(b.cols * b.rows);
    expect(tiles.length).toBeGreaterThanOrEqual(176); // about the old 16×12
    expect(tiles.every((t) => t.x >= 0 && t.y >= 0)).toBe(true);
    // Stepped corners: the four box corners are notches.
    const set = new Set(tiles.map(key));
    for (const c of ['0,0', '15,0', '0,11', '15,11']) expect(set.has(c)).toBe(false);
    // Packing Station and a straight first chain west of it are open.
    for (let x = PACKING_START.x - 6; x <= PACKING_START.x; x++) expect(set.has(`${x},${PACKING_START.y}`)).toBe(true);
  });

  it('the expansion only adds tiles, never removes or moves any, and is not a uniform rim', () => {
    const before = new Set(tilesOf(START_PLOT_IDS).map(key));
    const after = new Set(tilesOf([...START_PLOT_IDS, EXPANSION_PLOT_ID]).map(key));
    for (const k of before) expect(after.has(k)).toBe(true);
    const added = [...after].filter((k) => !before.has(k));
    expect(added.length).toBeGreaterThanOrEqual(80);
    expect(added.length).toBeLessThanOrEqual(100);
    const rects = plotById(EXPANSION_PLOT_ID)!.rects;
    expect(rects.length).toBeGreaterThan(1);
    // Structures placed before expanding stay exactly where they were.
    const sim = new Sim(createWorld());
    sim.world.coins = 1000;
    sim.dispatch({ type: 'place', kind: 'daisy_bed', x: 2, y: 2, facing: 1 });
    sim.dispatch({ type: 'place', kind: 'belt', x: 3, y: 2, facing: 1 });
    const snapshot = JSON.stringify(Object.values(sim.world.structures).map((s) => [s.id, s.kind, s.x, s.y, s.facing]));
    sim.world.expansionUnlocked = true;
    expect(sim.dispatch({ type: 'expand' }).ok).toBe(true);
    expect(JSON.stringify(Object.values(sim.world.structures).map((s) => [s.id, s.kind, s.x, s.y, s.facing]))).toBe(snapshot);
    expect(isOpenTile(sim.world, 18, 13)).toBe(true);
  });

  it('every tile of the old 16×12 box (and the old 20×14 expansion) a save could have built on is still valid after load', () => {
    const oldBox = { w: 16, h: 12 };
    // A v2 save with a belt on every tile of the old box (except the packing tile), none of the new ids.
    const structures: Record<number, unknown> = {};
    let id = 1;
    for (let y = 0; y < oldBox.h; y++) {
      for (let x = 0; x < oldBox.w; x++) {
        if (x === PACKING_START.x && y === PACKING_START.y) structures[id] = { id, kind: 'packing_station', x, y, facing: 0, packing: { lastReceivedTick: -1, received: 0 } };
        else structures[id] = { id, kind: 'belt', x, y, facing: 1, belt: { item: null, progress: 0, from: 3, block: 'none', stuckTicks: 0 } };
        id++;
      }
    }
    const v2 = {
      schemaVersion: 2,
      savedAt: 1,
      world: {
        tick: 5, cols: 16, rows: 12, unlockedPlotIds: ['potting'], structures, nextStructureId: id, nextItemId: 1, coins: 50, stock: {}, basket: {},
        orders: { activeId: 'order2', offeredIds: ['order2'], completedIds: ['order1'], progress: { orderId: 'order2', delivered: {} } },
        unlocked: ['daisy_bed', 'belt', 'bundling_table'], expansionUnlocked: false, stats: { delivered: 2, crafted: 0, coinsEarned: 50 },
      },
      settings: DEFAULT_SETTINGS,
    };
    const loaded = deserialize(JSON.stringify(v2));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(Object.keys(loaded.sim.world.structures)).toHaveLength(oldBox.w * oldBox.h);
    for (const s of Object.values(loaded.sim.world.structures)) expect(isOpenTile(loaded.sim.world, s.x, s.y)).toBe(true);
    expect(loaded.sim.world.unlockedPlotIds).toContain('legacy-potting');
    // Round trip keeps it.
    const again = deserialize(serialize(loaded.sim, loaded.settings, 0));
    expect(again.ok && Object.keys(again.sim.world.structures).length).toBe(oldBox.w * oldBox.h);

    // And the old expanded box.
    const v2x = JSON.parse(JSON.stringify(v2));
    v2x.world.unlockedPlotIds = ['potting', 'south-rim'];
    v2x.world.cols = 20;
    v2x.world.rows = 14;
    v2x.world.structures[id] = { id, kind: 'belt', x: 19, y: 13, facing: 1, belt: { item: null, progress: 0, from: 3, block: 'none', stuckTicks: 0 } };
    const loadedX = deserialize(JSON.stringify(v2x));
    expect(loadedX.ok && loadedX.sim.at(19, 13)?.kind).toBe('belt');
    expect(loadedX.ok && loadedX.sim.world.unlockedPlotIds).toContain('legacy-south-rim');
  });

  it('a fresh save does not pick up legacy plots', () => {
    const sim = new Sim(createWorld());
    const loaded = deserialize(serialize(sim, DEFAULT_SETTINGS, 0));
    expect(loaded.ok && loaded.sim.world.unlockedPlotIds).toEqual(['potting']);
    expect(PLOTS.filter((p) => p.purchasable)).toHaveLength(1);
  });
});
