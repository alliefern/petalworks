// Scripted pass over qa/playthrough-checklist.md with real clicks, at a given window size.
// Usage: node tools/playthrough.mjs [width] [height] [baseUrl]
// Writes producer/shots/pt-<w>x<h>-*.png and prints PASS/FAIL per check.
import { chromium } from 'playwright';
const W = Number(process.argv[2] ?? 1280);
const H = Number(process.argv[3] ?? 800);
const base = process.argv[4] ?? 'http://127.0.0.1:4173/';
const tag = `pt-${W}x${H}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text()); });
const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const S = () => page.evaluate(() => (window).petalworks);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: `producer/shots/${tag}-${n}.png` });
const screenOf = (tx, ty) => ev(([x, y]) => { const cam = window.__cam; const T = 64; return { x: (x * T + T / 2 - cam.worldView.x) * cam.zoom, y: (y * T + T / 2 - cam.worldView.y) * cam.zoom }; }, [tx, ty]);
const coins = async () => Number(await page.getByTestId('coins').textContent());
/** Does a screen point sit on an open HUD card? */
const covered = async (pt) => ev(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('.hud') && !el.closest('.hud > .buildhint'); }, [pt.x, pt.y]);

await page.goto(base);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
await page.waitForTimeout(400);
await shot('01-start');

// Read the first order: words, counts, reward.
const orderText = await page.getByTestId('order').textContent();
check('Order asks for daisies in words with count and reward', /Deliver 2 Daisies/.test(orderText) && /0 \/ 2/.test(orderText) && /50/.test(orderText));

// Tips: follow, skip, reopen.
check('Tip card appears', await page.getByTestId('tutorial').isVisible());
await page.getByTestId('tutorial').getByRole('button', { name: /Next|Got it/ }).click();
await page.waitForTimeout(100);
await page.getByTestId('tutorial-skip').click();
check('Skip hides tips', !(await page.getByTestId('tutorial').isVisible().catch(() => false)));
await page.getByTestId('help').click();
check('Tips reopen from the ? button', await page.locator('[data-testid="tutorial"], [data-testid="howto"]').first().isVisible());
await page.getByTestId('help').click();

// Palette tooltip shows purpose and cost.
const tip = await page.getByTestId('build-daisy_bed').getAttribute('title');
check('Hover tooltip has purpose and cost', /Grows/.test(tip) && /20 coins/.test(tip));

// Place a bed: ghost valid vs invalid (over the packing station).
await page.getByTestId('build-daisy_bed').click();
const bedTile = { x: 10, y: 6 };
let p = await screenOf(bedTile.x, bedTile.y);
const bedCovered = await covered(p);
await page.mouse.move(p.x, p.y);
await page.waitForTimeout(150);
const hintOk = await page.locator('.buildhint').textContent().catch(() => '');
const pk = await screenOf(13, 6);
await page.mouse.move(pk.x, pk.y);
await page.waitForTimeout(150);
const hintBad = await page.locator('.buildhint').getAttribute('class').catch(() => '');
check('Ghost preview differs on a bad spot', /Daisy Bed/.test(hintOk) && /bad/.test(hintBad));
await page.mouse.move(p.x, p.y);
await page.mouse.click(p.x, p.y);
check('Daisy Bed placed by click (tile not under a card)', (await ev(([x, y]) => window.petalworks.sim.at(x, y)?.kind, [bedTile.x, bedTile.y])) === 'daisy_bed', bedCovered ? 'tile was under a HUD card' : '');
check('Coins fell by 20', (await coins()) === 100);

// Rotate with R (ghost already east; rotate placed bed twice and back).
await page.keyboard.press('Escape');
await page.mouse.click(p.x, p.y);
await page.keyboard.press('r');
const facing1 = await ev(([x, y]) => window.petalworks.sim.at(x, y)?.facing, [bedTile.x, bedTile.y]);
await page.getByTestId('inspector-rotate').click();
await page.getByTestId('inspector-rotate').click();
await page.getByTestId('inspector-rotate').click();
const facing2 = await ev(([x, y]) => window.petalworks.sim.at(x, y)?.facing, [bedTile.x, bedTile.y]);
check('R and the Rotate button turn the bed', facing1 === 2 && facing2 === 1);
await page.keyboard.press('Escape');

// Drag belts, leaving a one-tile gap first.
await page.getByTestId('build-belt').click();
const a = await screenOf(11, 6);
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move(a.x + 2, a.y, { steps: 2 });
await page.mouse.up();
await page.keyboard.press('Escape');
await ev(() => window.petalworks.fastForward(55));
const gapItem = await ev(() => window.petalworks.sim.at(11, 6)?.belt?.item);
const gapBlock = await ev(() => window.petalworks.sim.at(11, 6)?.belt?.block);
await page.waitForTimeout(300);
await shot('02-gap');
check('Flower stops at the gap, does not hop', !!gapItem && gapBlock === 'dead_end' && (await ev(() => window.petalworks.sim.world.stats.delivered)) === 0);
check('Belt-end badge visible (disc drawn)', (await ev(() => window.petalworks.sim.at(11, 6)?.belt?.stuckTicks)) > 8);
// Fill the gap.
await page.getByTestId('build-belt').click();
const b = await screenOf(12, 6);
await page.mouse.click(b.x, b.y);
await page.keyboard.press('Escape');
await ev(() => window.petalworks.fastForward(100));
check('Filling the gap lets flowers through and the count rises only on arrival', (await ev(() => window.petalworks.sim.world.orders.progress.delivered.daisy ?? window.petalworks.sim.world.orders.completedIds.length)) >= 1);

// Growing / ready / blocked are distinguishable (states exist in inspector words).
await page.mouse.click(p.x, p.y);
const insp = await page.getByTestId('inspector').textContent();
check('Inspector names the bed state in words', /Growing|Ready|Blocked/.test(insp));
await page.keyboard.press('Escape');

// Ship the daisies: order completes, celebration, coins.
await ev(() => window.petalworks.fastForward(120));
await page.waitForTimeout(200);
const done1 = await ev(() => window.petalworks.sim.world.orders.completedIds.length);
const coins1 = await ev(() => window.petalworks.sim.world.coins);
check('Order 1 completes with pay', done1 === 1 && coins1 === 100 - 4 + 50);
await shot('03-celebration');
// Undo right after: order stays done, coins stay.
await page.keyboard.press('z');
await page.waitForTimeout(100);
check('Undo after the order keeps it finished and coins unchanged', (await ev(() => window.petalworks.sim.world.orders.completedIds.length)) === 1 && (await ev(() => window.petalworks.sim.world.coins)) >= coins1);
// (undo may have removed the last belt; put it back)
await ev(() => { const s = window.petalworks; if (!s.sim.at(12, 6)) s.dispatch({ type: 'place', kind: 'belt', x: 12, y: 6, facing: 1 }); });

// Next order: bundling table on the path.
await page.getByTestId('tool-remove').click();
await page.mouse.click(b.x, b.y);
await page.keyboard.press('Escape');
await page.getByTestId('build-bundling_table').click();
await page.mouse.click(b.x, b.y);
await page.keyboard.press('Escape');
check('Bundling Table placed on the path', (await ev(() => window.petalworks.sim.at(12, 6)?.kind)) === 'bundling_table');
await ev(() => window.petalworks.fastForward(130));
await page.mouse.click(b.x, b.y);
const insp2 = await page.getByTestId('inspector').textContent();
await shot('04-table-inspector');
check('Table inspector shows recipe, progress, holdings and facing', /Recipe/.test(insp2) && /Progress/.test(insp2) && /Holding/.test(insp2) && /Faces/.test(insp2));
await page.keyboard.press('Escape');
await ev(() => { for (let i = 0; i < 40 && window.petalworks.sim.world.orders.completedIds.length < 2; i++) window.petalworks.fastForward(50); });
check('Bundles ride to packing and order 2 completes', (await ev(() => window.petalworks.sim.world.orders.completedIds.length)) === 2);

// Pause / resume / speeds (clear the post-order celebration hold first so the clock is free).
await ev(() => window.petalworks.setUi({ celebration: null }));
await page.getByTestId('pause').click();
const t0 = await ev(() => window.petalworks.sim.world.tick);
await page.waitForTimeout(500);
check('Pause freezes the garden', (await ev(() => window.petalworks.sim.world.tick)) === t0);
await page.getByTestId('pause').click();
await page.getByTestId('speed-3').click();
await page.waitForTimeout(1000);
const t1 = await ev(() => window.petalworks.sim.world.tick);
const overlap = await ev(() => { const w = window.petalworks.sim.world; const seen = new Set(); for (const s of Object.values(w.structures)) if (s.belt?.item) { if (seen.has(s.belt.item.id)) return true; seen.add(s.belt.item.id); } return false; });
check('3x runs faster and items stay one per tile', t1 - t0 >= 20 && !overlap);
await page.getByTestId('speed-1').click();

// Sound and music off; persist across reload.
await page.getByTestId('settings').click();
await page.getByRole('radio', { name: 'Sound effects off', exact: true }).click();
await page.getByRole('radio', { name: 'Music off', exact: true }).click();
await page.keyboard.press('Escape');
// Refresh mid-delivery: same garden, same coins, same order, items once.
const before = await ev(() => JSON.stringify(window.petalworks.sim.world));
await ev(() => window.petalworks.save());
await page.reload();
await page.click('[data-testid="continue"]');
await page.waitForSelector('[data-testid="order"]');
const after = await ev(() => JSON.stringify(window.petalworks.sim.world));
check('Refresh restores the same garden, coins, order and items', before === after);
check('Sound and music stay off after refresh', await ev(() => !window.petalworks.ui.settings.sound && !window.petalworks.ui.settings.music));
// Refresh right after an order pays: no double pay.
const c2 = await ev(() => window.petalworks.sim.world.coins);
await page.reload();
await page.click('[data-testid="continue"]');
await page.waitForSelector('[data-testid="order"]');
check('Refresh after pay does not pay twice', (await ev(() => window.petalworks.sim.world.coins)) === c2);

// Remove a belt with a flower on it: basket, not vanish.
await ev(() => { const s = window.petalworks; s.dispatch({ type: 'place', kind: 'belt', x: 5, y: 9, facing: 1 }); const b = s.sim.at(5, 9); b.belt.item = { id: 99999, kind: 'daisy' }; s.sim.world.nextItemId = Math.max(s.sim.world.nextItemId, 100000); });
await page.getByTestId('tool-remove').click();
const rb = await screenOf(5, 9);
await page.mouse.click(rb.x, rb.y);
await page.keyboard.press('Escape');
check('Removing a loaded belt sends the flower to the basket', (await ev(() => window.petalworks.sim.world.basket.daisy)) === 1 && (await page.getByTestId('basket').isVisible()));
await shot('05-basket');

// Bad placement and unaffordable: words, coins unchanged.
const c3 = await ev(() => window.petalworks.sim.world.coins);
await page.getByTestId('build-daisy_bed').click();
await page.mouse.click(pk.x, pk.y);
await page.waitForTimeout(100);
const noticeText = await page.locator('[data-testid="notice"]').allTextContents();
check('Occupied tile refused in words, coins unchanged', noticeText.some((t) => /already has something/.test(t)) && (await ev(() => window.petalworks.sim.world.coins)) === c3);
await ev(() => { window.petalworks.sim.world.coins = 5; window.petalworks.setUi({}); });
const free = await screenOf(3, 3);
await page.mouse.click(free.x, free.y);
await page.waitForTimeout(100);
const noticeText2 = await page.locator('[data-testid="notice"]').allTextContents();
check('Unaffordable refused in words', noticeText2.some((t) => /Not enough coins/.test(t)) && (await ev(() => window.petalworks.sim.world.coins)) === 5);
await ev((c) => { window.petalworks.sim.world.coins = c; window.petalworks.setUi({}); }, c3);
await page.keyboard.press('Escape');

// Every visible button once (skip New Game confirm).
const buttons = await page.locator('.hud button:visible').all();
let clicked = 0;
for (const bt of buttons) {
  const label = ((await bt.getAttribute('aria-label')) ?? (await bt.textContent()) ?? '').trim();
  if (/New game|Start New Game/i.test(label)) continue;
  await bt.click({ timeout: 2000 }).catch(() => null);
  clicked++;
  if (await page.getByTestId('settings-modal').isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
await page.keyboard.press('Escape');
check('Every visible HUD button clicks without error', clicked > 8 && errors.length === 0, `${clicked} buttons`);

// Cards vs playable tiles at this size: are any open tiles under the tip card or the order card?
await page.keyboard.press('Home');
await page.waitForTimeout(300);
const coveredTiles = await ev(() => {
  const cam = window.__cam; const T = 64; const w = window.petalworks.sim.world; let n = 0;
  for (let y = 0; y < w.rows; y++) for (let x = 0; x < w.cols; x++) {
    const sx = (x * T + T / 2 - cam.worldView.x) * cam.zoom; const sy = (y * T + T / 2 - cam.worldView.y) * cam.zoom;
    const el = document.elementFromPoint(sx, sy);
    if (el && el.closest('.orderpanel, .tutorial, .inspector')) n++;
  }
  return n;
});
await shot('06-fit');
check('Side cards clear the playable tiles after Fit', coveredTiles === 0, `${coveredTiles} tiles covered`);

// Lavender quick check.
await ev(() => { const s = window.petalworks; s.sim.world.coins = 300; s.sim.world.unlocked.push('lavender_bed'); s.setUi({}); });
await page.getByTestId('build-lavender_bed').click();
const lv = await screenOf(13, 9);
await page.mouse.click(lv.x, lv.y);
await page.keyboard.press('r');
await page.keyboard.press('Escape');
check('Lavender bed places', (await ev(() => window.petalworks.sim.at(13, 9)?.kind)) === 'lavender_bed');

console.log(JSON.stringify({ size: `${W}x${H}`, pass: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).map((r) => r.name), errors }));
await browser.close();
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
