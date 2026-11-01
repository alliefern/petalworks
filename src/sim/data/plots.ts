import type { PlotDef, Rect } from '../types';

/**
 * Garden plots. Coordinates are absolute with a fixed northwest origin, so opening a
 * plot never moves anything already built. A plot is a union of rectangles; a tile is
 * buildable if any open plot covers it. Shapes are deliberately not boxes: the starting
 * yard has stepped corners, a south alcove and an east nook, and the expansion is an
 * L-shaped wing with a north-east nook rather than a uniform rim.
 *
 * Tile map (`#` potting, `+` added by the expansion, `.` never open):
 *
 *      0         1
 *      01234567890123456789
 *   0  ..############++++++
 *   1  ..############++++++
 *   2  ################++..
 *   3  ################++..
 *   4  ################++..
 *   5  ################++++
 *   6  ################++++
 *   7  ################++++
 *   8  ################++++
 *   9  ################++++
 *  10  ++############++++++
 *  11  ++############++++++
 *  12  ++++++####++++++++++
 *  13  ++++++####++++++++++
 *  14  ..........++++++++++
 */
export const PLOTS: PlotDef[] = [
  {
    id: 'potting',
    rects: [
      { x: 0, y: 2, w: 16, h: 8 }, // wide band
      { x: 2, y: 0, w: 12, h: 12 }, // tall band (the two bands make the stepped corners)
      { x: 6, y: 12, w: 4, h: 2 }, // south alcove
      { x: 16, y: 2, w: 2, h: 3 }, // east nook
    ],
    cost: 0,
    purchasable: false,
  },
  {
    id: 'south-rim',
    rects: [
      { x: 16, y: 5, w: 4, h: 5 }, // east wing
      { x: 14, y: 10, w: 6, h: 2 }, // wing's foot (also fills the old south-east notch)
      { x: 10, y: 12, w: 10, h: 3 }, // south-east corner
      { x: 0, y: 10, w: 6, h: 4 }, // south-west step
      { x: 14, y: 0, w: 6, h: 2 }, // north-east nook
    ],
    cost: 100,
    purchasable: true,
  },
  // Not purchasable: added on load for saves made when the yard was a plain 16×12 box
  // (and its 20×14 expansion), so anything built in a corner that is now a notch stays valid.
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
