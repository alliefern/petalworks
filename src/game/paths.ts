import { BELT_TICKS } from '../sim/data/balance';
import { DX, DY, opposite } from '../sim/grid';
import type { Dir, Structure } from '../sim/types';
import { TILE } from './constants';

export function tileCenter(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

/**
 * World position of the item on `belt` at normalized progress t (0 = entry edge, 1 = exit edge).
 * Straight belts lerp between edge midpoints; corners follow a quarter-circle around the
 * inside corner so the item tracks the painted curve.
 */
export function itemPositionOnBelt(belt: Structure, t: number): { x: number; y: number } {
  const st = belt.belt!;
  const c = tileCenter(belt.x, belt.y);
  const entry: Dir = st.from;
  const exit: Dir = belt.facing;
  const h = TILE / 2;
  const start = { x: c.x + DX[entry] * h, y: c.y + DY[entry] * h };
  const end = { x: c.x + DX[exit] * h, y: c.y + DY[exit] * h };
  if (entry === opposite(exit)) {
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  }
  if (entry === exit) {
    // Degenerate (belt rotated to face its own entry): just hold at centre.
    return c;
  }
  const corner = { x: c.x + (DX[entry] + DX[exit]) * h, y: c.y + (DY[entry] + DY[exit]) * h };
  const a0 = Math.atan2(start.y - corner.y, start.x - corner.x);
  let a1 = Math.atan2(end.y - corner.y, end.x - corner.x);
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  a1 = a0 + da;
  const a = a0 + (a1 - a0) * t;
  return { x: corner.x + Math.cos(a) * h, y: corner.y + Math.sin(a) * h };
}

export function beltProgressT(belt: Structure, alpha: number): number {
  const st = belt.belt!;
  if (st.progress >= BELT_TICKS) return 1;
  return Math.min(1, (st.progress + alpha) / BELT_TICKS);
}
