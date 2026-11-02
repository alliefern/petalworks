// Measures HUD layout reads per frame and frame rate while the closed field (Open Plot preview) is showing.
// Usage: node tools/framecost.mjs [baseUrl]
// Counts HUD layout reads per second and the average frame time while the closed field (Open Plot preview) is showing.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2] ?? 'http://127.0.0.1:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
await page.evaluate(() => { const s = window.petalworks; s.sim.world.expansionUnlocked = true; s.drainEvents(); });
await page.keyboard.press('Home');
await page.waitForTimeout(800);
const r = await page.evaluate(() => new Promise((resolve) => {
  let rects = 0, styles = 0;
  const gbcr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { rects++; return gbcr.call(this); };
  const gcs = window.getComputedStyle;
  window.getComputedStyle = function (...a) { styles++; return gcs.apply(window, a); };
  let frames = 0; const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else { const secs = (performance.now() - t0) / 1000; Element.prototype.getBoundingClientRect = gbcr; window.getComputedStyle = gcs; resolve({ rectsPerSec: +(rects / secs).toFixed(1), stylesPerSec: +(styles / secs).toFixed(1), fps: +(frames / secs).toFixed(1), rectsPerFrame: +(rects / frames).toFixed(2) }); } };
  requestAnimationFrame(tick);
}));
console.log(JSON.stringify(r));
await browser.close();
