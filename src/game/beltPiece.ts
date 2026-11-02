import { opposite, rotateCCW, rotateCW } from '../sim/grid';
import type { Dir } from '../sim/types';

export type BeltPiece = 'straight' | 'cw' | 'ccw';

/**
 * Which single sprite a belt tile shows, from its own facing (exit side) and the sides
 * that feed it. Art convention: `straight` travels west to east; `cw` enters from the
 * west and exits south; `ccw` enters from the west and exits north. `angle` rotates the
 * art so its exit matches `facing`. Exactly one piece per tile, never two.
 */
export function choosePiece(facing: Dir, feeders: readonly Dir[]): { piece: BeltPiece; angle: number } {
  const behind = opposite(facing);
  const left = rotateCCW(facing);
  const right = rotateCW(facing);
  const fedLeft = feeders.includes(left);
  const fedRight = feeders.includes(right);
  if (feeders.includes(behind) || feeders.length === 0 || (fedLeft && fedRight)) {
    // Straight art points east (facing 1); turn it to the exit side.
    return { piece: 'straight', angle: ((facing - 1 + 4) % 4) * 90 };
  }
  if (fedRight) {
    // cw art exits south (facing 2).
    return { piece: 'cw', angle: ((facing - 2 + 4) % 4) * 90 };
  }
  // ccw art exits north (facing 0).
  return { piece: 'ccw', angle: facing * 90 };
}
