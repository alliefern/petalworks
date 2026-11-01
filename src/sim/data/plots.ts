import type { PlotDef, Rect } from '../types';

/**
 * Garden plots. Coordinates are absolute with a fixed northwest origin, so opening a
 * plot never moves anything already built. A plot is a union of rectangles (built here
 * from an ASCII mask, one rect per run of `#`); a tile is buildable if any open plot
 * covers it. Gameplay stays on the tile grid; the renderer draws a smooth, wobbly border
 * around the open tiles (src/game/outline.ts), so the mask only needs to be lumpy, not pretty.
 *
 * Masks are 20 wide; row 0 is the top. `#` is in the plot, `.` is not.
 */
const POTTING_MASK = [
  '........#####.......', // 0   a lump at the top, off centre
  '......#########.....', // 1
  '..###############...', // 2
  '.################...', // 3
  '.##################.', // 4   bulge to the east
  '###############.....', // 5   deep bay on the east side
  '################....', // 6   (packing station sits at 13,6)
  '..################..', // 7   bay on the west side
  '....##############..', // 8   deeper still
  '..#################.', // 9   bulge east again
  '.################...', // 10  bulge west
  '...##########.......', // 11  bay to the south-east
  '.....##########.....', // 12  a lower lump
  '........#####.......', // 13
];

/** The expansion grows the same blob outward: it fills the two inlets and adds lobes. */
const SOUTH_RIM_MASK = [
  '......##.....####...', // 0
  '....##.........###..', // 1
  '.#...............##.', // 2
  '#................###', // 3
  '#..................#', // 4
  '...............####.', // 5   fills most of the east bay
  '................###.', // 6
  '##................##', // 7   and the west bay
  '.###..............##', // 8
  '##.................#', // 9
  '#................###', // 10
  '.##..........#######', // 11  a lobe to the south-east
  '..###.........######', // 12
  '....####.....######.', // 13
  '......#########.##..', // 14
  '........######......', // 15
];

export function rectsFromMask(rows: string[], ox = 0, oy = 0): Rect[] {
  const rects: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === '#') x++;
      rects.push({ x: ox + start, y: oy + y, w: x - start, h: 1 });
    }
  });
  return rects;
}

export const PLOTS: PlotDef[] = [
  { id: 'potting', rects: rectsFromMask(POTTING_MASK), cost: 0, purchasable: false },
  { id: 'south-rim', rects: rectsFromMask(SOUTH_RIM_MASK), cost: 100, purchasable: true },
  // Not purchasable: added on load for saves made when the yard was a plain 16×12 box
  // (and its 20×14 expansion), so anything built in a corner that is now outside stays valid.
  { id: 'legacy-potting', rects: [{ x: 0, y: 0, w: 16, h: 12 }], cost: 0, purchasable: false },
  { id: 'legacy-south-rim', rects: [{ x: 0, y: 0, w: 20, h: 14 }], cost: 0, purchasable: false },
];

export const START_PLOT_IDS = ['potting'];
export const EXPANSION_PLOT_ID = 'south-rim';
/** Legacy plot to add when an older save has a structure outside the current shape. */
export const LEGACY_FOR: Record<string, string> = { potting: 'legacy-potting', 'south-rim': 'legacy-south-rim' };

export function plotById(id: string): PlotDef | undefined {
  return PLOTS.find((p) => p.id === id);
}

export function rectCovers(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

export function plotCoversTile(p: PlotDef, x: number, y: number): boolean {
  return p.rects.some((r) => rectCovers(r, x, y));
}

/** Bounding box (cols, rows) of the given open plots. */
export function boundsOf(ids: string[]): { cols: number; rows: number } {
  let cols = 0;
  let rows = 0;
  for (const id of ids) {
    const p = plotById(id);
    if (!p) continue;
    for (const r of p.rects) {
      cols = Math.max(cols, r.x + r.w);
      rows = Math.max(rows, r.y + r.h);
    }
  }
  return { cols, rows };
}

/** Every tile covered by the given plot ids (deduplicated). */
export function tilesOf(ids: string[]): Array<{ x: number; y: number }> {
  const seen = new Set<string>();
  const out: Array<{ x: number; y: number }> = [];
  for (const id of ids) {
    const p = plotById(id);
    if (!p) continue;
    for (const r of p.rects) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const k = `${x},${y}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ x, y });
        }
      }
    }
  }
  return out;
}
