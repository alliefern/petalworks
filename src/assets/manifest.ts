/**
 * Asset manifest: semantic sprite keys -> files. The game never references a file
 * name directly. Resolution order for every key:
 *   1. assets/art/<file>        (final illustrated art, dropped in by the art team)
 *   2. assets/interim/<file>    (generated stand-ins, flagged interim)
 * Facing variants fall back to the east-facing file plus a runtime rotation.
 * See docs/ASSET_SPECS.md for the full list.
 */
import type { Dir, ItemKind, StructureKind } from '../sim/types';

const ART = import.meta.glob('../../assets/art/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const INTERIM = import.meta.glob('../../assets/interim/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function lookup(table: Record<string, string>, file: string): string | undefined {
  for (const [path, url] of Object.entries(table)) {
    if (path.endsWith('/' + file)) return url;
  }
  return undefined;
}

export interface ResolvedSprite {
  key: string;
  url: string;
  /** Degrees to rotate the texture at runtime (non-zero only for facing fallbacks). */
  angle: number;
  interim: boolean;
}

export const FACING_LETTERS: Record<Dir, 'n' | 'e' | 's' | 'w'> = { 0: 'n', 1: 'e', 2: 's', 3: 'w' };
/** Rotation to turn an east-facing sprite toward `d`. */
export const FACING_ANGLE: Record<Dir, number> = { 0: -90, 1: 0, 2: 90, 3: 180 };

function resolveFile(file: string): { url: string; interim: boolean } | null {
  const art = lookup(ART, file) ?? lookup(ART, file.replace(/\.png$/, '.webp'));
  if (art) return { url: art, interim: false };
  const interim = lookup(INTERIM, file);
  if (interim) return { url: interim, interim: true };
  return null;
}

/**
 * Resolve a semantic key. Facing keys look like `bed.daisy.n.ready`; if only the `e`
 * file exists the result carries the rotation to apply.
 */
export function resolveSprite(key: string): ResolvedSprite | null {
  const file = keyToFile(key);
  const direct = resolveFile(file);
  if (direct) return { key, url: direct.url, angle: 0, interim: direct.interim };
  const m = key.match(/^(bed|machine)\.([a-z_]+)\.([nesw])\.(.+)$/);
  if (m) {
    const facing = m[3] as 'n' | 'e' | 's' | 'w';
    const eastKey = `${m[1]}.${m[2]}.e.${m[4]}`;
    const east = resolveFile(keyToFile(eastKey));
    if (east) {
      const angle = { n: -90, e: 0, s: 90, w: 180 }[facing];
      return { key, url: east.url, angle, interim: east.interim };
    }
  }
  return null;
}

/** `bed.daisy.e.ready` -> `bed_daisy_e_ready.png`; `belt.straight.3` -> `belt_straight_3.png`. */
export function keyToFile(key: string): string {
  return key.replace(/\./g, '_') + '.png';
}

export function spriteUrl(key: string): string | undefined {
  return resolveSprite(key)?.url;
}

// ---- Key builders ---------------------------------------------------------------

export const BELT_FRAMES = 8;
export const WORK_FRAMES = 4;
export const RECEIVE_FRAMES = 4;

export type BedState = 'empty' | 'grow0' | 'grow1' | 'ready';
export type MachineState = 'idle' | 'work0' | 'work1' | 'work2' | 'work3' | 'ready';

export const PRODUCER_SPRITE: Partial<Record<StructureKind, string>> = { daisy_bed: 'bed.daisy', lavender_bed: 'bed.lavender' };
export const PROCESSOR_SPRITE: Partial<Record<StructureKind, string>> = {
  bundling_table: 'machine.bundling',
  drying_bench: 'machine.drying',
  arrangement_table: 'machine.arrangement',
};

export function bedKey(kind: StructureKind, facing: Dir, state: BedState): string {
  return `${PRODUCER_SPRITE[kind]}.${FACING_LETTERS[facing]}.${state}`;
}
export function machineKey(kind: StructureKind, facing: Dir, state: MachineState): string {
  return `${PROCESSOR_SPRITE[kind]}.${FACING_LETTERS[facing]}.${state}`;
}
export function packingKey(state: 'idle' | 'receive0' | 'receive1' | 'receive2' | 'receive3'): string {
  return `machine.packing.${state}`;
}
export function itemKey(kind: ItemKind): string {
  return `item.${kind}`;
}

/** Thumbnail key used in the build palette for each structure kind. */
export function paletteKey(kind: StructureKind): string {
  switch (kind) {
    case 'belt':
      return 'belt.straight.0';
    case 'daisy_bed':
      return 'bed.daisy.e.ready';
    case 'lavender_bed':
      return 'bed.lavender.e.ready';
    case 'packing_station':
      return 'machine.packing.idle';
    default:
      return machineKey(kind, 1, 'idle');
  }
}

/** Every key the world scene preloads. */
export function allSpriteKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 4; i++) keys.push(`ground.grass.${i}`);
  keys.push('ground.locked');
  for (const e of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) keys.push(`edge.hedge.${e}`);
  for (let f = 0; f < BELT_FRAMES; f++) keys.push(`belt.straight.${f}`, `belt.corner.cw.${f}`, `belt.corner.ccw.${f}`);
  keys.push('belt.end');
  const facings: Dir[] = [0, 1, 2, 3];
  for (const bed of ['daisy_bed', 'lavender_bed'] as StructureKind[]) {
    for (const d of facings) for (const st of ['empty', 'grow0', 'grow1', 'ready'] as BedState[]) keys.push(bedKey(bed, d, st));
  }
  for (const m of ['bundling_table', 'drying_bench', 'arrangement_table'] as StructureKind[]) {
    for (const d of facings) for (const st of ['idle', 'work0', 'work1', 'work2', 'work3', 'ready'] as MachineState[]) keys.push(machineKey(m, d, st));
  }
  for (const st of ['idle', 'receive0', 'receive1', 'receive2', 'receive3'] as const) keys.push(packingKey(st));
  for (const it of ['daisy', 'lavender', 'daisy_bundle', 'lavender_sachet', 'mixed_bouquet'] as ItemKind[]) keys.push(itemKey(it));
  keys.push('badge.blocked', 'badge.waiting', 'badge.ready', 'badge.wrong', 'tile.valid', 'tile.invalid', 'tile.select');
  keys.push('decor.stone.0', 'decor.tuft.0', 'decor.mushroom.0', 'decor.wildflower.0', 'decor.watering_can', 'decor.terracotta');
  keys.push('fx.sparkle', 'fx.petal.daisy', 'fx.petal.pink', 'fx.petal.lavender', 'fx.ring');
  return keys;
}

/** Which keys currently resolve to interim art (for KNOWN_ISSUES and the debug overlay). */
export function interimReport(): { total: number; interim: number; missing: string[] } {
  const keys = allSpriteKeys();
  let interim = 0;
  const missing: string[] = [];
  for (const k of keys) {
    const r = resolveSprite(k);
    if (!r) missing.push(k);
    else if (r.interim) interim++;
  }
  return { total: keys.length, interim, missing };
}
