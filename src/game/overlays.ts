import Phaser from 'phaser';
import { COLORS, TILE } from './constants';

/**
 * Code-drawn accessibility overlays (docs/design/ACCESSIBILITY.md §1): ink glyphs on cream
 * discs for status, ink-stroked tile rings with distinct shapes, and the ink exit arrow.
 * Drawn at 2× and shown at 1× so edges stay crisp when zoomed.
 */
export const DISC_SIZE = 28;
const SS = 2;

export function makeOverlayTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('disc.blocked')) return;
  const g = scene.add.graphics();
  const disc = (key: string, glyph: (g: Phaser.GameObjects.Graphics, c: number) => void) => {
    const size = DISC_SIZE * SS;
    const c = size / 2;
    g.clear();
    g.fillStyle(COLORS.cream, 1);
    g.fillCircle(c, c, c - 2 * SS);
    g.lineStyle(2 * SS, COLORS.ink, 1);
    g.strokeCircle(c, c, c - 2 * SS);
    g.lineStyle(3 * SS, COLORS.ink, 1);
    g.fillStyle(COLORS.ink, 1);
    glyph(g, c);
    g.generateTexture(key, size, size);
  };
  // "!"
  disc('disc.blocked', (g, c) => {
    g.fillRoundedRect(c - 1.6 * SS, c - 8 * SS, 3.2 * SS, 9.5 * SS, 1.5 * SS);
    g.fillCircle(c, c + 6 * SS, 2 * SS);
  });
  // "×"
  disc('disc.wrong', (g, c) => {
    g.beginPath();
    g.moveTo(c - 6 * SS, c - 6 * SS);
    g.lineTo(c + 6 * SS, c + 6 * SS);
    g.moveTo(c + 6 * SS, c - 6 * SS);
    g.lineTo(c - 6 * SS, c + 6 * SS);
    g.strokePath();
  });
  // check mark
  disc('disc.ready', (g, c) => {
    g.beginPath();
    g.moveTo(c - 7 * SS, c + 0.5 * SS);
    g.lineTo(c - 2 * SS, c + 5.5 * SS);
    g.lineTo(c + 7.5 * SS, c - 5 * SS);
    g.strokePath();
  });
  // "…"
  disc('disc.waiting', (g, c) => {
    for (const dx of [-6, 0, 6]) g.fillCircle(c + dx * SS, c + 1 * SS, 2 * SS);
  });

  const ring = (key: string, draw: (g: Phaser.GameObjects.Graphics, s: number) => void) => {
    const s = TILE * SS;
    g.clear();
    draw(g, s);
    g.generateTexture(key, s, s);
  };
  const brackets = (g: Phaser.GameObjects.Graphics, s: number, len: number, width: number) => {
    g.lineStyle(width, COLORS.ink, 1);
    const i = 3 * SS;
    for (const [x, y, sx, sy] of [
      [i, i, 1, 1],
      [s - i, i, -1, 1],
      [i, s - i, 1, -1],
      [s - i, s - i, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(x, y + sy * len);
      g.lineTo(x, y);
      g.lineTo(x + sx * len, y);
      g.strokePath();
    }
  };
  // Valid: four open ink brackets over a cream ring with an ink hairline, so the ring
  // still reads on grass in grayscale (sage on sage vanished).
  ring('ring.valid', (g, s) => {
    g.lineStyle(4 * SS, COLORS.cream, 0.95);
    g.strokeRoundedRect(4 * SS, 4 * SS, s - 8 * SS, s - 8 * SS, 10 * SS);
    g.lineStyle(1.5 * SS, COLORS.ink, 0.7);
    g.strokeRoundedRect(4 * SS, 4 * SS, s - 8 * SS, s - 8 * SS, 10 * SS);
    brackets(g, s, 14 * SS, 3 * SS);
  });
  // Invalid: the same brackets plus an ink X over a coral ring.
  ring('ring.invalid', (g, s) => {
    g.lineStyle(4 * SS, COLORS.coral, 0.9);
    g.strokeRoundedRect(4 * SS, 4 * SS, s - 8 * SS, s - 8 * SS, 10 * SS);
    brackets(g, s, 14 * SS, 2.5 * SS);
    g.lineStyle(3 * SS, COLORS.ink, 0.9);
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.3);
    g.lineTo(s * 0.7, s * 0.7);
    g.moveTo(s * 0.7, s * 0.3);
    g.lineTo(s * 0.3, s * 0.7);
    g.strokePath();
  });
  // Selected: thick solid ink corner ticks over a honey ring.
  ring('ring.select', (g, s) => {
    g.lineStyle(4 * SS, COLORS.honey, 1);
    g.strokeRoundedRect(3 * SS, 3 * SS, s - 6 * SS, s - 6 * SS, 10 * SS);
    brackets(g, s, 18 * SS, 5 * SS);
  });
  // Keyboard cursor: dashed-looking ink ring (short ticks on each side) so it differs from selection.
  ring('ring.cursor', (g, s) => {
    g.lineStyle(3 * SS, COLORS.ink, 0.95);
    const m = 5 * SS;
    const seg = 10 * SS;
    for (const t of [0.2, 0.5, 0.8]) {
      const p = m + (s - 2 * m) * t;
      g.beginPath();
      g.moveTo(p - seg / 2, m);
      g.lineTo(p + seg / 2, m);
      g.moveTo(p - seg / 2, s - m);
      g.lineTo(p + seg / 2, s - m);
      g.moveTo(m, p - seg / 2);
      g.lineTo(m, p + seg / 2);
      g.moveTo(s - m, p - seg / 2);
      g.lineTo(s - m, p + seg / 2);
      g.strokePath();
    }
    brackets(g, s, 12 * SS, 3 * SS);
  });

  // Exit arrow: 10×8 CSS px ink arrow pointing east, with a cream halo for grass.
  g.clear();
  const aw = 14 * SS;
  const ah = 12 * SS;
  g.fillStyle(COLORS.cream, 0.9);
  g.fillTriangle(0, 0, aw, ah / 2, 0, ah);
  g.fillStyle(COLORS.ink, 1);
  g.fillTriangle(2 * SS, 2 * SS, aw - 2 * SS, ah / 2, 2 * SS, ah - 2 * SS);
  g.generateTexture('arrow.exit', aw, ah);

  g.destroy();
}
