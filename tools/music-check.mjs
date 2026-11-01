// Renders the generated soundtrack offline in headless Chrome and checks levels and variety,
// mirroring Sugar Belt's scripts/music-check.mjs. Usage: node tools/music-check.mjs [seconds] [baseUrl]
import { chromium } from 'playwright';
const secs = Number(process.argv[2] ?? 90);
const base = process.argv[3] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(base);
await page.waitForFunction(() => window.petalworksAudio);
let fail = 0;
const dbfs = (x) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
for (const [seed, inten] of [[1234, 0.1], [98765, 0.7], [42, 1]]) {
  const r = await page.evaluate(([s, i, sec]) => window.petalworksAudio.renderMusic(sec, s, i), [seed, inten, secs]);
  const counts = r.kinds.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {});
  console.log(`seed ${seed} intensity ${inten}: ${r.bars} bars @ ${r.bpm} BPM, peak ${dbfs(r.peak)} dBFS, rms ${dbfs(r.rms)} dBFS, clipped ${r.clipped}, silent seconds ${r.silentSeconds}, sections`, counts);
  if (r.peak > 0.98 || r.clipped > 0) { console.log('FAIL clipping'); fail++; }
  if (r.rms < 0.01) { console.log('FAIL too quiet'); fail++; }
  if (r.silentSeconds > secs * 0.1) { console.log('FAIL long silences'); fail++; }
}
if (errs.length) { console.log('console errors:', errs); fail++; }
await browser.close();
console.log(fail ? 'Music check FAILED' : 'Music check passed');
process.exit(fail ? 1 : 0);
