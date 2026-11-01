// Build-time art packer. Reads assets/art/*.png (source of truth, by file name; a missing
// file falls back to assets/interim/<same name>), and writes to src/generated/:
//   garden-N.webp + garden-N.json   Phaser JSON-hash atlases (frame name = file stem)
//   webp/<stem>.webp                single files for the React <img> icons and the title
//   atlas-manifest.json             sheets + stem -> sheet map
// Usage: node tools/pack-art.mjs [--quality 82]
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const ART = join(ROOT, 'assets/art');
const INTERIM = join(ROOT, 'assets/interim');
const OUT = join(ROOT, 'src/generated');
const qi = process.argv.indexOf('--quality');
const QUALITY = qi > 0 ? Number(process.argv[qi + 1]) : 82;
const SHEET = 2048;
const PAD = 2; // extruded border on every frame so linear filtering never samples a neighbour
/** Stems that never go in the atlas (used only through <img> in React). */
const SINGLE_ONLY = (stem) => stem.startsWith('ui_');
/** Preloaded but never drawn; see PetalScene.rebuildGround. */
const SKIP_ATLAS = new Set(['ground_locked']);

const stems = new Map(); // stem -> absolute path
const list = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : []);
for (const f of list(INTERIM)) stems.set(f.slice(0, -4), join(INTERIM, f));
for (const f of list(ART)) stems.set(f.slice(0, -4), join(ART, f));
const fromInterim = [...stems].filter(([, p]) => p.startsWith(INTERIM)).map(([s]) => s);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'webp'), { recursive: true });

// Load, dedupe identical pixels, and measure.
const images = [];
const byHash = new Map();
for (const [stem, path] of [...stems].sort(([a], [b]) => a.localeCompare(b))) {
  const buf = readFileSync(path);
  const hash = createHash('sha1').update(buf).digest('hex');
  const meta = await sharp(buf).metadata();
  const entry = { stem, path, buf, hash, w: meta.width, h: meta.height };
  images.push(entry);
  if (!byHash.has(hash)) byHash.set(hash, entry);
}

// Singles (every stem) for <img> use.
let singlesBytes = 0;
for (const img of images) {
  const out = await sharp(img.buf).webp({ quality: QUALITY, effort: 4 }).toBuffer();
  writeFileSync(join(OUT, 'webp', img.stem + '.webp'), out);
  singlesBytes += out.length;
}

// Atlas: unique pixels only, shelf-packed by height.
const unique = [...byHash.values()].filter((e) => !SINGLE_ONLY(e.stem) && !SKIP_ATLAS.has(e.stem));
unique.sort((a, b) => b.h - a.h || b.w - a.w || a.stem.localeCompare(b.stem));
const sheets = [];
const place = (e) => {
  const fw = e.w + PAD * 2;
  const fh = e.h + PAD * 2;
  for (const s of sheets) {
    for (const shelf of s.shelves) {
      if (shelf.h >= fh && shelf.x + fw <= SHEET) {
        const pos = { sheet: s, x: shelf.x, y: shelf.y };
        shelf.x += fw;
        return pos;
      }
    }
    const nextY = s.shelves.length ? s.shelves[s.shelves.length - 1].y + s.shelves[s.shelves.length - 1].h : 0;
    if (nextY + fh <= SHEET) {
      const shelf = { x: fw, y: nextY, h: fh };
      s.shelves.push(shelf);
      return { sheet: s, x: 0, y: nextY };
    }
  }
  const s = { index: sheets.length, shelves: [{ x: fw, y: 0, h: fh }], frames: [], usedH: 0 };
  sheets.push(s);
  return { sheet: s, x: 0, y: 0 };
};
for (const e of unique) {
  const p = place(e);
  p.sheet.frames.push({ e, x: p.x, y: p.y });
  p.sheet.usedH = Math.max(p.sheet.usedH, p.y + e.h + PAD * 2);
}

const manifest = { quality: QUALITY, sheets: [], frames: {}, fromInterim };
let atlasBytes = 0;
for (const s of sheets) {
  const height = Math.min(SHEET, Math.ceil(s.usedH / 64) * 64);
  const composites = [];
  const frames = {};
  for (const { e, x, y } of s.frames) {
    const extruded = await sharp(e.buf).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).png().toBuffer();
    composites.push({ input: extruded, left: x, top: y });
    const rect = { x: x + PAD, y: y + PAD, w: e.w, h: e.h };
    // Every stem with these pixels points at the same rect.
    for (const img of images) {
      if (img.hash === e.hash && !SINGLE_ONLY(img.stem) && !SKIP_ATLAS.has(img.stem)) {
        frames[img.stem] = { frame: rect, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: e.w, h: e.h }, sourceSize: { w: e.w, h: e.h } };
        manifest.frames[img.stem] = `garden-${s.index}`;
      }
    }
  }
  const png = await sharp({ create: { width: SHEET, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
  const webp = await sharp(png).webp({ quality: QUALITY, effort: 5, alphaQuality: 95 }).toBuffer();
  writeFileSync(join(OUT, `garden-${s.index}.webp`), webp);
  writeFileSync(join(OUT, `garden-${s.index}.json`), JSON.stringify({ frames, meta: { image: `garden-${s.index}.webp`, size: { w: SHEET, h: height }, scale: '1' } }));
  manifest.sheets.push({ name: `garden-${s.index}`, image: `garden-${s.index}.webp`, data: `garden-${s.index}.json`, width: SHEET, height, frames: Object.keys(frames).length });
  atlasBytes += webp.length;
}
writeFileSync(join(OUT, 'atlas-manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(OUT, '.gitkeep'), '');

const srcBytes = images.reduce((a, e) => a + e.buf.length, 0);
console.log(
  `pack-art: ${images.length} files (${fromInterim.length} from interim), ${unique.length} unique atlas frames in ${sheets.length} sheet(s); ` +
    `png ${(srcBytes / 1e6).toFixed(2)} MB -> atlas ${(atlasBytes / 1e6).toFixed(2)} MB + singles ${(singlesBytes / 1e6).toFixed(2)} MB (q${QUALITY})`,
);
