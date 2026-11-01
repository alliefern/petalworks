/**
 * Asset manifest: semantic sprite keys -> built files. The game never references a file
 * name directly. `assets/art/<file>.png` is the source of truth (the art team and Allie
 * drop files in by name; a missing name falls back to `assets/interim/`). At build time
 * `tools/pack-art.mjs` turns those PNGs into WebP atlases plus single WebP files in
 * `src/generated/`, and this module reads only the generated output.
 * Facing variants fall back to the east-facing file plus a runtime rotation.
 * See docs/ASSET_SPECS.md for the full list.
 */
import type { Dir, ItemKind, StructureKind } from '../sim/types';
import atlasManifest from '../generated/atlas-manifest.json';

const SINGLES = import.meta.glob('../generated/webp/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SHEET_FILES = import.meta.glob('../generated/garden-*.{webp,json}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function lookup(table: Record<string, string>, file: string): string | undefined {
  for (const [path, url] of Object.entries(table)) {
    if (path.endsWith('/' + file)) return url;
  }
  return undefined;
}

export interface AtlasSheet {
  name: string;
  imageUrl: string;
  dataUrl: string;
  frames: number;
}

/** Atlas sheets to preload, with their built URLs. */
export function atlasSheets(): AtlasSheet[] {
  return atlasManifest.sheets.map((s) => ({
    name: s.name,
    imageUrl: lookup(SHEET_FILES, s.image) ?? '',
    dataUrl: lookup(SHEET_FILES, s.data) ?? '',
    frames: s.frames,
  }));
}

/** Which sheet holds a file stem, if any. */
export function atlasSheetFor(stem: string): string | undefined {
  return (atlasManifest.frames as Record<string, string>)[stem];
}

/** File stems whose art came from the interim fallback rather than assets/art. */
export const INTERIM_STEMS: string[] = atlasManifest.fromInterim;

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

function resolveStem(stem: string): { url: string; interim: boolean } | null {
  const url = lookup(SINGLES, stem + '.webp');
  if (!url) return null;
  return { url, interim: INTERIM_STEMS.includes(stem) };
}

/** East-facing stem for a facing key, used when the facing file is missing. */
export function eastFallbackKey(key: string): { key: string; angle: number } | null {
  const m = key.match(/^(bed|machine)\.([a-z_]+)\.([nesw])\.(.+)$/);
  if (!m) return null;
  const facing = m[3] as 'n' | 'e' | 's' | 'w';
  return { key: `${m[1]}.${m[2]}.e.${m[4]}`, angle: { n: -90, e: 0, s: 90, w: 180 }[facing] };
}

/**
 * Resolve a semantic key to a single built file (for <img> use and for sprites outside
 * the atlas). Facing keys fall back to the east file plus a rotation.
 */
export function resolveSprite(key: string): ResolvedSprite | null {
  const direct = resolveStem(keyToStem(key));
  if (direct) return { key, url: direct.url, angle: 0, interim: direct.interim };
  const fb = eastFallbackKey(key);
  if (fb) {
    const east = resolveStem(keyToStem(fb.key));
    if (east) return { key, url: east.url, angle: fb.angle, interim: east.interim };
  }
  return null;
}

/** `bed.daisy.e.ready` -> `bed_daisy_e_ready`; `belt.straight.3` -> `belt_straight_3`. */
export function keyToStem(key: string): string {
  return key.replace(/\./g, '_');
}

/** `bed.daisy.e.ready` -> `bed_daisy_e_ready.png` (the source file name in assets/art). */
export function keyToFile(key: string): string {
  return keyToStem(key) + '.png';
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

/** Every key the world scene draws. (`ground.locked` is not drawn; the closed plot is tinted lawn.) */
export function allSpriteKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 4; i++) keys.push(`ground.grass.${i}`);
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
