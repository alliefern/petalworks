import { PLOTS } from './data/plots';
import { STRUCTURES } from './data/structures';
import type { Dir, Port, Structure, StructureDef, World } from './types';

export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];
/** Screen words for facings (copy key facing.*). */
export const DIR_NAMES = ['up', 'right', 'down', 'left'] as const;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const rotateCW = (d: Dir): Dir => ((d + 1) % 4) as Dir;
export const rotateCCW = (d: Dir): Dir => ((d + 3) % 4) as Dir;

export function plotCovers(id: string, x: number, y: number): boolean {
  const p = PLOTS.find((q) => q.id === id);
  if (!p) return false;
  return x >= p.rect.x && y >= p.rect.y && x < p.rect.x + p.rect.w && y < p.rect.y + p.rect.h;
}

/** True when the tile is inside an open plot. */
export function isOpenTile(world: World, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  return world.unlockedPlotIds.some((id) => plotCovers(id, x, y));
}

/** True when the tile is inside any plot at all (open or still closed). */
export function isAnyPlotTile(x: number, y: number): boolean {
  return PLOTS.some((p) => plotCovers(p.id, x, y));
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

/** Resolve a facing-relative port direction to absolute directions. */
export function portDirs(port: Port, facing: Dir): Dir[] {
  switch (port.dir) {
    case 'facing':
      return [facing];
    case 'back':
      return [opposite(facing)];
    case 'left':
      return [rotateCCW(facing)];
    case 'right':
      return [rotateCW(facing)];
    case 'all':
      return [0, 1, 2, 3];
  }
}

/** Absolute sides on which `s` has a port of the given role. */
export function portSides(def: StructureDef, facing: Dir, role: Port['role']): Dir[] {
  const out = new Set<Dir>();
  for (const p of def.ports) if (p.role === role) for (const d of portDirs(p, facing)) out.add(d);
  return [...out];
}

export function hasInputOn(s: Structure, side: Dir): boolean {
  return portSides(STRUCTURES[s.kind], s.facing, 'in').includes(side);
}

export function outputSides(s: Structure): Dir[] {
  return portSides(STRUCTURES[s.kind], s.facing, 'out');
}

/** Tiles within Chebyshev radius r of (x,y), excluding the centre. For later aura systems. */
export function tilesInRadius(x: number, y: number, r: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push({ x: x + dx, y: y + dy });
  return out;
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
