// Builds a belt loop with all four corner types plus merges, screenshots it, and counts the
// Phaser images drawn on each belt tile (to catch a straight piece stacked on a corner).
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
const report = await page.evaluate(() => {
  const s = window.petalworks;
  s.sim.world.coins = 500;
  // Rings laid as one drag each, like a player would; the last tile is turned to close the loop.
  const dirBetween = (a, b) => (b.y < a.y ? 0 : b.x > a.x ? 1 : b.y > a.y ? 2 : 3);
  const ring = (x0, y0, x1, y1, cw) => {
    const t = [];
    for (let x = x0; x < x1; x++) t.push({ x, y: y0 });
    for (let y = y0; y < y1; y++) t.push({ x: x1, y });
    for (let x = x1; x > x0; x--) t.push({ x, y: y1 });
    for (let y = y1; y > y0; y--) t.push({ x: x0, y });
    return cw ? t : t.reverse();
  };
  for (const [tiles] of [[ring(6, 4, 9, 7, true)], [ring(11, 4, 14, 7, false)]]) {
    s.dispatch({ type: 'place_belt_path', tiles });
    const last = tiles[tiles.length - 1];
    s.dispatch({ type: 'rotate', id: s.sim.at(last.x, last.y).id, facing: dirBetween(last, tiles[0]) });
  }
  // A side merge into the first loop, and a belt rotated after placement, and a removed mid-line belt.
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 7, y: 2 }, { x: 7, y: 3 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(8, 4).id });
  s.dispatch({ type: 'rotate', id: s.sim.at(8, 4).id, facing: 1 });
  s.dispatch({ type: 'remove', id: s.sim.at(12, 7).id });
  s.fastForward(5);
  s.drainEvents();
  return Object.values(s.sim.world.structures).filter((b) => b.kind === 'belt').map((b) => ({ x: b.x, y: b.y, facing: b.facing }));
});
await page.keyboard.press('Home');
await page.waitForTimeout(500);
await page.evaluate(() => { const c = window.__cam; c.setZoom(1.6); c.centerOn(10 * 64, 5.5 * 64); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'producer/shots/18-belt-loop.png' });
// Count images per belt tile on the display list (main belt sprites only: 64 px tile-sized, atlas belt frames).
const counts = await page.evaluate((belts) => {
  const scene = window.__scene;
  const out = [];
  for (const b of belts) {
    const cx = b.x * 64 + 32;
    const cy = b.y * 64 + 32;
    const imgs = scene.children.list.filter((o) => o.type === 'Image' && o.visible && Math.abs(o.x - cx) < 1 && Math.abs(o.y - cy) < 1 && typeof o.frame?.name === 'string' && o.frame.name.startsWith('belt_'));
    out.push({ x: b.x, y: b.y, facing: b.facing, pieces: imgs.map((o) => o.frame.name.replace(/_\d+$/, '') + '@' + Math.round(o.angle)), sizes: imgs.map((o) => Math.round(o.displayWidth) + 'x' + Math.round(o.displayHeight)) });
  }
  return out;
}, report);
// Exactly one piece per tile, and every piece (end caps too) is exactly one tile on screen.
const bad = counts.filter((c) => c.pieces.filter((p) => !p.startsWith('belt_end')).length !== 1 || c.sizes.some((sz) => sz !== '64x64'));
for (const c of counts) console.log(`(${c.x},${c.y}) f${c.facing}: ${c.pieces.join(' + ')} [${c.sizes.join(' ')}]`);
console.log(bad.length ? `FAIL ${bad.length} belt tiles draw more or fewer than one piece, or a piece that is not one tile` : 'PASS every belt tile draws exactly one one-tile piece');
await browser.close();
process.exit(bad.length ? 1 : 0);
