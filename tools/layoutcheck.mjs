// Responsive layout check from 1024x640 to 4K: after New Game (default framing) and after
// Fit (Home), no open yard tile may sit under a HUD card, the yard must be inside the window
// and centred in the free column between the side cards, and the HUD must scale up on wide
// screens. Saves producer/shots/19-responsive-<WxH>.png for each size.
// Usage: node tools/layoutcheck.mjs [baseUrl] [WxH,WxH,...]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const SIZES = (process.argv[3] ? process.argv[3].split(',') : ['1024x640', '1280x800', '1920x1080', '2560x1440', '3840x2160']).map((s) => s.split('x').map(Number));
const T = 64;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

for (const [vw, vh] of SIZES) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()));
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
  await page.click('[data-testid="new-game"]');
  await page.waitForSelector('[data-testid="order"]');
  await page.waitForTimeout(500);
  console.log(`${vw}x${vh}`);
  const uiScale = vw >= 3000 ? 1.6 : vw >= 2200 ? 1.3 : 1;

  // Where every open tile lands on screen, and what HUD element (if any) covers its centre.
  const survey = () => page.evaluate(([T]) => {
    const s = window.petalworks;
    const cam = window.__cam;
    const k = window.__k || 1;
    const w = s.sim.world;
    const out = { tiles: 0, covered: [], offscreen: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (let y = -2; y < w.rows + 2; y++) for (let x = -2; x < w.cols + 2; x++) {
      if (!s.sim.isOpen(x, y)) continue;
      out.tiles++;
      const sx = ((x * T + T / 2 - cam.worldView.x) * cam.zoom) / k;
      const sy = ((y * T + T / 2 - cam.worldView.y) * cam.zoom) / k;
      out.minX = Math.min(out.minX, sx); out.maxX = Math.max(out.maxX, sx); out.minY = Math.min(out.minY, sy); out.maxY = Math.max(out.maxY, sy);
      if (sx < 0 || sy < 0 || sx > innerWidth || sy > innerHeight) { out.offscreen++; continue; }
      const el = document.elementFromPoint(sx, sy);
      const hit = el && el.closest('.hud') && !el.closest('.buildhint') ? el.closest('.tutorial, .orderpanel, .inspector, .palette, .topbar, .card') : null;
      if (hit) { const cls = String(hit.className).split(' ').find((c) => /tutorial|orderpanel|inspector|palette|topbar/.test(c)) || String(hit.className).split(' ')[0]; out.covered.push(`${x},${y}:${cls}`); }
    }
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 1 ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
    out.cards = { tip: rect('.tutorial'), order: rect('.orderpanel'), topbar: rect('.topbar'), palette: rect('.palette') };
    out.tileCss = (T * cam.zoom) / k;
    return out;
  }, [T]);

  // 1. Default framing (the used area) is clear of the cards and on screen.
  let r = await survey();
  const used = await page.evaluate(() => { const s = window.petalworks; const st = Object.values(s.sim.world.structures)[0]; return st ? { x: st.x, y: st.y } : null; });
  check(r.covered.filter((c) => used && c.startsWith(`${used.x},${used.y}:`)).length === 0, `default framing: the Packing Station is not under a card`);
  check(r.tileCss >= 48 - 0.5, `default framing: tiles are ${r.tileCss.toFixed(1)} css px (at least 48)`);

  // 2. Fit the whole yard: nothing covered, everything on screen, centred in the free column.
  await page.keyboard.press('Home');
  await page.waitForTimeout(400);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  r = await survey();
  check(r.offscreen === 0, `after Fit: all ${r.tiles} open tiles are on screen`);
  // Side cards must never cover the yard. The top bar and the Build button may only touch it
  // when the window is too short to hold the whole yard at the 40 px tile floor.
  const atFloor = r.tileCss <= 40.5;
  const bySide = r.covered.filter((c) => /tutorial|orderpanel|inspector/.test(c));
  const byBars = r.covered.filter((c) => !/tutorial|orderpanel|inspector/.test(c));
  check(bySide.length === 0, `after Fit: no open tile under a side card${bySide.length ? ' (' + bySide.slice(0, 6).join(' ') + ')' : ''}`);
  if (byBars.length && atFloor) console.log(`  note ${byBars.length} tiles touch the top bar or Build button: window too short for the yard at the 40 px floor (${byBars.slice(0, 5).join(' ')})`);
  else check(byBars.length === 0, `after Fit: no open tile under the top bar or palette${byBars.length ? ' (' + byBars.slice(0, 6).join(' ') + ')' : ''}`);
  const left = r.cards.tip ? r.cards.tip.right : 0;
  const right = r.cards.order ? r.cards.order.left : vw;
  const colCentre = (left + right) / 2;
  const yardCentre = (r.minX + r.maxX) / 2;
  check(Math.abs(colCentre - yardCentre) <= Math.max(24, r.tileCss), `after Fit: yard centred in the free column (yard ${yardCentre.toFixed(0)}, column ${colCentre.toFixed(0)})`);
  check(r.tileCss >= 40 - 0.5, `after Fit: tiles are ${r.tileCss.toFixed(1)} css px (at least 40)`);

  // 3. HUD scale: the top bar grows with the window on wide screens.
  const barH = r.cards.topbar ? r.cards.topbar.bottom - r.cards.topbar.top : 0;
  check(barH >= 44 * uiScale && barH <= 80 * uiScale, `top bar is ${barH.toFixed(0)} css px tall for HUD scale ${uiScale}`);
  if (r.cards.order) check(r.cards.order.right <= vw && r.cards.order.left >= vw / 2, `order card fits inside the window on the right`);
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.screenshot({ path: `producer/shots/19-responsive-${vw}x${vh}.png` });
  await page.close();
}
await browser.close();
console.log(fails ? `FAIL ${fails} checks` : 'PASS layout holds from 1024x640 to 4K');
process.exit(fails ? 1 : 0);
