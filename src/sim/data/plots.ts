import type { PlotDef } from '../types';

/**
 * Garden plots. Coordinates are absolute with a fixed northwest origin, so opening a
 * plot never moves anything already built. A tile is buildable if any open plot covers it.
 */
export const PLOTS: PlotDef[] = [
  { id: 'potting', rect: { x: 0, y: 0, w: 16, h: 12 }, cost: 0 },
  { id: 'south-rim', rect: { x: 0, y: 0, w: 20, h: 14 }, cost: 100 },
];

export const START_PLOT_IDS = ['potting'];
export const EXPANSION_PLOT_ID = 'south-rim';

export function plotById(id: string): PlotDef | undefined {
  return PLOTS.find((p) => p.id === id);
}

/** Bounding box (cols, rows) of the given open plots. */
export function boundsOf(ids: string[]): { cols: number; rows: number } {
  let cols = 0;
  let rows = 0;
  for (const id of ids) {
    const p = plotById(id);
    if (!p) continue;
    cols = Math.max(cols, p.rect.x + p.rect.w);
    rows = Math.max(rows, p.rect.y + p.rect.h);
  }
  return { cols, rows };
}
