import { describe, expect, it } from 'vitest';
import { chaikin, inside, organicOutline, resample, signedArea, simplify, traceLoops, wobble } from './outline';

const rectTiles = (x0: number, y0: number, w: number, h: number) => {
  const t = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) t.push({ x, y });
  return t;
};

describe('plot outline geometry', () => {
  it('traces a rectangle into one loop of its four corners', () => {
    const loops = traceLoops(rectTiles(0, 0, 3, 2));
    expect(loops).toHaveLength(1);
    const s = simplify(loops[0]);
    expect(s).toHaveLength(4);
    expect(Math.abs(signedArea(s))).toBe(6);
  });

  it('traces an L shape into one loop with six corners and keeps holes separate', () => {
    const L = [...rectTiles(0, 0, 3, 1), ...rectTiles(0, 1, 1, 2)];
    const loops = traceLoops(L);
    expect(loops).toHaveLength(1);
    expect(simplify(loops[0])).toHaveLength(6);
    // A ring (3×3 minus centre) has an outer loop and an inner loop.
    const ring = rectTiles(0, 0, 3, 3).filter((t) => !(t.x === 1 && t.y === 1));
    expect(traceLoops(ring)).toHaveLength(2);
  });

  it('smoothing keeps the curve near the tiles, wobble stays small and deterministic', () => {
    const tiles = [...rectTiles(0, 0, 6, 4), ...rectTiles(2, 4, 2, 2)];
    const loops = organicOutline(tiles, 64, 3);
    expect(loops).toHaveLength(1);
    const loop = loops[0];
    expect(loop.length).toBeGreaterThan(40);
    // Every point lies within 0.4 tile of the tile-edge polygon's bounding box, and the
    // tile centres of interior tiles are inside the curve.
    for (const p of loop) {
      expect(p.x).toBeGreaterThan(-0.4 * 64);
      expect(p.x).toBeLessThan(6.4 * 64);
      expect(p.y).toBeGreaterThan(-0.4 * 64);
      expect(p.y).toBeLessThan(6.4 * 64);
    }
    for (const t of [{ x: 1, y: 1 }, { x: 4, y: 2 }, { x: 2, y: 4 }]) expect(inside(loop, (t.x + 0.5) * 64, (t.y + 0.5) * 64)).toBe(true);
    expect(inside(loop, 5.5 * 64, 5.5 * 64)).toBe(false);
    expect(organicOutline(tiles, 64, 3)).toEqual(loops);
    expect(organicOutline(tiles, 64, 4)).not.toEqual(loops);
  });

  it('chaikin, resample and wobble preserve loop closure', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const r = resample(sq, 2.5);
    expect(r.length).toBe(16);
    const c = chaikin(sq, 1);
    expect(c).toHaveLength(8);
    const w = wobble(r, 0.5, 1);
    expect(w).toHaveLength(r.length);
  });
});
