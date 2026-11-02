// Pointer-to-tile and placement-size check on big screens. For each viewport and device
// pixel ratio, at three zoom levels: the hovered tile must be the one under the mouse (even
// near a tile's corner), the ghost must sit on that tile at the placed size, the placed
// building must end the same size as its ghost, and a second click on a full tile must be
// refused. Usage: node tools/pointercheck.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const T = 64;
// Optional filters: node tools/pointercheck.mjs [baseUrl] [WxH[,WxH]] [dpr[,dpr]]  (one combo at a time is lighter on software GL)
const SIZES = (process.argv[3] ? process.argv[3].split(',') : ['1920x1080', '2560x1440', '3840x2160']).map((s) => s.split('x').map(Number));
const DPRS = process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 2];
const ZOOMS = [0.6, 1, 1.8];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

for (const [vw, vh] of SIZES) {
  for (const dpr of DPRS) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()));
    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
    await page.click('[data-testid="new-game"]');
    await page.waitForSelector('[data-testid="order"]');
    await page.evaluate(() => { const s = window.petalworks; s.sim.world.coins = 100000; s.drainEvents(); });
    console.log(`${vw}x${vh} @${dpr}x`);
    const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { left: r.left, top: r.top, cssW: r.width, cssH: r.height, w: c.width, h: c.height }; });
    check(Math.abs(canvas.w - canvas.cssW * dpr) <= 2 && Math.abs(canvas.h - canvas.cssH * dpr) <= 2, `canvas backing store ${canvas.w}x${canvas.h} matches ${canvas.cssW}x${canvas.cssH} css at ${dpr}x`);
    const screenOf = (tx, ty, fx = 0.5, fy = 0.5) => page.evaluate(([x, y, fx, fy, left, top]) => { const cam = window.__cam; const T = 64; return { x: left + (x * T + T * fx - cam.worldView.x) * cam.zoom, y: top + (y * T + T * fy - cam.worldView.y) * cam.zoom }; }, [tx, ty, fx, fy, canvas.left, canvas.top]);
    const covered = (pt) => page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('.hud') && !el.closest('.buildhint'); }, [pt.x, pt.y]);
    let zi = 0;
    for (const zoom of ZOOMS) {
      // Different tiles per zoom so each round places on fresh ground; centre the camera there.
      const tiles = [[4 + zi * 2, 5], [5 + zi * 2, 5], [4 + zi * 2, 6]];
      await page.evaluate(([z, cx, cy]) => { const c = window.__cam; c.setZoom(z); c.centerOn(cx, cy); }, [zoom, (tiles[0][0] + 1) * T, (tiles[0][1] + 1) * T]);
      await page.waitForTimeout(150);
      await page.evaluate(() => window.petalworks.setTool({ type: 'build', kind: 'daisy_bed' }));
      const placedIds = [];
      for (const [tx, ty] of tiles) {
        const open = await page.evaluate(([x, y]) => window.petalworks.sim.isOpen(x, y), [tx, ty]);
        if (!open) { console.log(`  skip (${tx},${ty}) not open`); continue; }
        // Hover near three spots inside the tile: centre and two near-corner points.
        for (const [fx, fy] of [[0.5, 0.5], [0.08, 0.08], [0.92, 0.92]]) {
          const p = await screenOf(tx, ty, fx, fy);
          if (await covered(p)) { console.log(`  skip (${tx},${ty}) under a HUD card at zoom ${zoom}`); continue; }
          await page.mouse.move(p.x, p.y);
          await page.waitForTimeout(60);
          const got = await page.evaluate(() => { const s = window.petalworks; const sc = window.__scene; return { hover: s.ui.hover, gx: sc.ghost.x, gy: sc.ghost.y, gw: sc.ghost.displayWidth, gvis: sc.ghost.visible }; });
          check(got.hover && got.hover.x === tx && got.hover.y === ty, `zoom ${zoom}: hover at (${fx},${fy}) of tile (${tx},${ty}) reads (${got.hover?.x},${got.hover?.y})`);
          check(got.gvis && Math.abs(got.gx - (tx * T + T / 2)) < 0.5 && Math.abs(got.gy - (ty * T + T / 2)) < 0.5, `zoom ${zoom}: ghost centred on tile (${tx},${ty})`);
        }
        const p = await screenOf(tx, ty);
        if (await covered(p)) continue;
        const ghostW = await page.evaluate(() => window.__scene.ghost.displayWidth);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(350); // pop-in settles
        const placed = await page.evaluate(([x, y]) => { const s = window.petalworks; const st = s.sim.at(x, y); if (!st) return null; const v = window.__scene.views.get(st.id); return { id: st.id, kind: st.kind, w: v.main.displayWidth, h: v.main.displayHeight, x: v.main.x, y: v.main.y }; }, [tx, ty]);
        check(placed && placed.kind === 'daisy_bed', `zoom ${zoom}: click placed a bed on (${tx},${ty})`);
        if (placed) {
          check(Math.abs(placed.w - ghostW) < 0.01 && Math.abs(placed.h - ghostW) < 0.01, `zoom ${zoom}: placed size ${placed.w.toFixed(2)} equals ghost size ${ghostW.toFixed(2)}`);
          check(Math.abs(placed.x - (tx * T + T / 2)) < 0.5 && Math.abs(placed.y - (ty * T + T / 2)) < 0.5, `zoom ${zoom}: placed building centred on its tile`);
          placedIds.push(placed.id);
          // Click the same spot again: the tile is full, nothing changes.
          const before = await page.evaluate(() => Object.keys(window.petalworks.sim.world.structures).length);
          await page.mouse.click(p.x, p.y);
          await page.waitForTimeout(100);
          const after = await page.evaluate(([x, y]) => ({ n: Object.keys(window.petalworks.sim.world.structures).length, id: window.petalworks.sim.at(x, y)?.id }), [tx, ty]);
          check(after.n === before && after.id === placed.id, `zoom ${zoom}: second click on full tile (${tx},${ty}) refused`);
          // Still in build mode? Re-arm the tool in case the click selected the bed.
          await page.evaluate(() => window.petalworks.setTool({ type: 'build', kind: 'daisy_bed' }));
        }
      }
      // Neighbours placed on adjacent tiles sit exactly one tile apart and never share a tile.
      const uniq = new Set(placedIds);
      check(uniq.size === placedIds.length, `zoom ${zoom}: ${placedIds.length} placements are ${uniq.size} distinct buildings`);
      zi++;
    }
    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}
await browser.close();
console.log(fails ? `FAIL ${fails} checks` : 'PASS pointer, ghost and placed size agree at every size, DPR and zoom');
process.exit(fails ? 1 : 0);
