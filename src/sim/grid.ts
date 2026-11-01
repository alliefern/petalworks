import type { Dir, Structure, World } from './types';

export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];
export const DIR_NAMES = ['north', 'east', 'south', 'west'] as const;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const rotateCW = (d: Dir): Dir => ((d + 1) % 4) as Dir;
export const rotateCCW = (d: Dir): Dir => ((d + 3) % 4) as Dir;

export function inBounds(world: World, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export const tileKey = (x: number, y: number): number => (x + 1000) * 2048 + (y + 1000);

/** Direction from (ax,ay) to the adjacent tile (bx,by), or null if not adjacent. */
export function dirBetween(ax: number, ay: number, bx: number, by: number): Dir | null {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return null;
}

/** Spatial index over structures. Rebuilt whenever structures are added or removed. */
export class TileIndex {
  private map = new Map<number, number>();

  rebuild(world: World): void {
    this.map.clear();
    for (const s of Object.values(world.structures)) this.map.set(tileKey(s.x, s.y), s.id);
  }

  idAt(x: number, y: number): number | undefined {
    return this.map.get(tileKey(x, y));
  }

  set(s: Structure): void {
    this.map.set(tileKey(s.x, s.y), s.id);
  }

  clear(x: number, y: number): void {
    this.map.delete(tileKey(x, y));
  }
}

export function structureAt(world: World, index: TileIndex, x: number, y: number): Structure | null {
  const id = index.idAt(x, y);
  return id === undefined ? null : (world.structures[id] ?? null);
}

export function neighbor(world: World, index: TileIndex, s: Structure, d: Dir): Structure | null {
  return structureAt(world, index, s.x + DX[d], s.y + DY[d]);
}
