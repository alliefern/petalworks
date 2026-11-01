import { describe, expect, it } from 'vitest';
import { mtof, rng } from './music';

describe('music helpers (pure parts of the Sugar Belt port)', () => {
  it('rng is deterministic per seed and stays in [0,1)', () => {
    const a = rng(42);
    const b = rng(42);
    const c = rng(43);
    const xs = Array.from({ length: 50 }, () => a());
    const ys = Array.from({ length: 50 }, () => b());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(xs).not.toEqual(Array.from({ length: 50 }, () => c()));
  });

  it('mtof maps MIDI 69 to 440 Hz and octaves double', () => {
    expect(mtof(69)).toBeCloseTo(440, 6);
    expect(mtof(81)).toBeCloseTo(880, 6);
  });
});
