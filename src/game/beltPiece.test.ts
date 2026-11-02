import { describe, expect, it } from 'vitest';
import { choosePiece } from './beltPiece';
import type { Dir } from '../sim/types';

const N: Dir = 0, E: Dir = 1, S: Dir = 2, W: Dir = 3;

describe('belt piece choice', () => {
  it('fed from behind or unfed is a straight piece turned to the exit', () => {
    expect(choosePiece(E, [W])).toEqual({ piece: 'straight', angle: 0 });
    expect(choosePiece(S, [N])).toEqual({ piece: 'straight', angle: 90 });
    expect(choosePiece(W, [E])).toEqual({ piece: 'straight', angle: 180 });
    expect(choosePiece(N, [S])).toEqual({ piece: 'straight', angle: 270 });
    expect(choosePiece(N, [])).toEqual({ piece: 'straight', angle: 270 });
  });
  it('fed from the side turns, one corner piece per tile, in every rotation', () => {
    // Art: cw enters west exits south; ccw enters west exits north.
    expect(choosePiece(S, [W])).toEqual({ piece: 'cw', angle: 0 });
    expect(choosePiece(W, [N])).toEqual({ piece: 'cw', angle: 90 });
    expect(choosePiece(N, [E])).toEqual({ piece: 'cw', angle: 180 });
    expect(choosePiece(E, [S])).toEqual({ piece: 'cw', angle: 270 });
    expect(choosePiece(N, [W])).toEqual({ piece: 'ccw', angle: 0 });
    expect(choosePiece(E, [N])).toEqual({ piece: 'ccw', angle: 90 });
    expect(choosePiece(S, [E])).toEqual({ piece: 'ccw', angle: 180 });
    expect(choosePiece(W, [S])).toEqual({ piece: 'ccw', angle: 270 });
  });
  it('behind wins over a side feeder, and both sides read as a straight merge', () => {
    expect(choosePiece(E, [W, N]).piece).toBe('straight');
    expect(choosePiece(E, [N, S]).piece).toBe('straight');
    expect(choosePiece(E, [S, W, N]).piece).toBe('straight');
  });
  it('every facing and feeder set yields exactly one piece with a right-angle rotation', () => {
    for (const f of [N, E, S, W]) {
      for (let m = 0; m < 16; m++) {
        const feeders = ([N, E, S, W] as Dir[]).filter((d) => m & (1 << d));
        const r = choosePiece(f, feeders);
        expect(['straight', 'cw', 'ccw']).toContain(r.piece);
        expect(r.angle % 90).toBe(0);
        expect(r.angle).toBeGreaterThanOrEqual(0);
        expect(r.angle).toBeLessThan(360);
      }
    }
  });
});
