// Scripted check of the plot edge: with the expansion preview showing, every pixel just
// outside the lawn apron must already be mostly linen (a soft fade), and nothing but linen
// may show beyond the apron. Catches square grass/tint chunks poking past the smooth edge.
// Usage: node tools/plotcheck.mjs [baseUrl] [WxH] [shotName]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const [vw, vh] = (process.argv[3] ?? '1440x900').split('x').map(Number);
const shot = process.argv[4] ?? 'producer/shots/14-yard-outline.png';
const TILE = 64;

// Plot tiles straight from the data file (open + closed preview).
const src = readFileSync('src/sim/data/plots.ts', 'utf8');
const masks = [...src.matchAll(/const (\w+_MASK) = \[([\s\S]*?)\];/g)].map((m) => [m[1], [...m[2].matchAll(/'([.#]+)'/g)].map((r) => r[1])]);
const tiles = new Set();
for (const [, rows] of masks) rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && tiles.add(`${x},${y}`)));
const tileList = [...tiles].map((k) => k.split(',').map(Number));
// Chebyshev distance (in tiles) from a world point to the nearest plot tile square.
function dist(wx, wy) {
  let best = Infinity;
  for (const [tx, ty] of tileList) {
    const dx = Math.max(tx * TILE - wx, 0, wx - (tx + 1) * TILE);
    const dy = Math.max(ty * TILE - wy, 0, wy - (ty + 1) * TILE);
    const d = Math.max(dx, dy) / TILE;
    if (d < best) best = d;
  }
  return best;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
await page.evaluate(() => {
  const s = window.petalworks;
  s.sim.world.expansionUnlocked = true;
  s.drainEvents();
});
await page.keyboard.press('Home');
await page.waitForTimeout(600);
await page.screenshot({ path: shot });
// Now hide the HUD and read the bare canvas.
await page.addStyleTag({ content: '#app > *:not(#game), .hud, .topbar, .palette, .orderpanel, .tutorial, .inspector { visibility: hidden !important; }' });
await page.waitForTimeout(200);
const cam = await page.evaluate(() => ({ x: window.__cam.worldView.x, y: window.__cam.worldView.y, zoom: window.__cam.zoom }));
const png = await page.screenshot({ type: 'png' });
const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
const linen = [0xe3, 0xd9, 0xbf];
let apron = 0, apronBad = 0, outer = 0, outerBad = 0;
const badPts = [];
for (let py = 4; py < info.height - 4; py += 3) {
  for (let px = 4; px < info.width - 4; px += 3) {
    const wx = cam.x + px / cam.zoom;
    const wy = cam.y + py / cam.zoom;
    const d = dist(wx, wy);
    if (d < 0.85) continue;
    const i = (py * info.width + px) * info.channels;
    const diff = Math.max(Math.abs(data[i] - linen[0]), Math.abs(data[i + 1] - linen[1]), Math.abs(data[i + 2] - linen[2]));
    if (d < 0.98) {
      apron++;
      if (diff > 30) { apronBad++; badPts.length < 8 && badPts.push(`apron (${px},${py}) tile ${(wx / TILE).toFixed(1)},${(wy / TILE).toFixed(1)} rgb ${data[i]},${data[i + 1]},${data[i + 2]}`); }
    } else if (d > 2.7) {
      outer++;
      if (diff > 10) { outerBad++; badPts.length < 8 && badPts.push(`outer (${px},${py}) tile ${(wx / TILE).toFixed(1)},${(wy / TILE).toFixed(1)} rgb ${data[i]},${data[i + 1]},${data[i + 2]}`); }
    }
  }
}
await browser.close();
const apronRate = apronBad / Math.max(1, apron);
const outerRate = outerBad / Math.max(1, outer);
console.log(`${vw}x${vh}: apron samples ${apron}, not faded ${apronBad} (${(apronRate * 100).toFixed(1)}%); beyond-apron samples ${outer}, not linen ${outerBad} (${(outerRate * 100).toFixed(2)}%)`);
for (const b of badPts) console.log('  ' + b);
if (errors.length) console.log('page errors:', errors);
const ok = apronRate < 0.04 && outerRate < 0.005 && !errors.length;
console.log(ok ? 'PASS plot edge is smooth and faded' : 'FAIL plot edge shows hard chunks');
process.exit(ok ? 0 : 1);
