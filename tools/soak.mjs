// Headless soak: runs the full six-order layout at 3x for N real seconds and reports errors.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const seconds = Number(process.argv[3] ?? 60);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text()); });
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
await page.evaluate(() => {
  const s = window.petalworks;
  s.sim.world.coins = 400;
  s.sim.world.unlocked = ['belt', 'daisy_bed', 'lavender_bed', 'bundling_table', 'drying_bench', 'arrangement_table'];
  // Open market so every product sells and nothing parks on a stock cap: a true long-run flow test.
  s.sim.world.orders = { activeId: null, offeredIds: [], completedIds: ['order1', 'order2', 'order3', 'order4', 'order5', 'order6'], progress: { orderId: null, delivered: {} } };
  s.sim.world.expansionUnlocked = true;
  s.ui.settings.seenCompletion = true;
  // Daisy line: two beds -> bundling -> arrangement -> packing(13,6)
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 7, y: 6, facing: 1 });
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 8, y: 4, facing: 2 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 8, y: 5 }, { x: 8, y: 6 }, { x: 9, y: 6 }] });
  s.dispatch({ type: 'place', kind: 'bundling_table', x: 10, y: 6, facing: 1 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 11, y: 6 }] });
  s.dispatch({ type: 'place', kind: 'arrangement_table', x: 12, y: 6, facing: 1 });
  s.dispatch({ type: 'place', kind: 'lavender_bed', x: 12, y: 10, facing: 0 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 12, y: 9 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(12, 9).id, facing: 0 });
  s.dispatch({ type: 'place', kind: 'drying_bench', x: 12, y: 8, facing: 0 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 12, y: 7 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(12, 7).id, facing: 0 });
  // A second daisy bed straight into packing from the north so raw daisies keep flowing too.
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 13, y: 4, facing: 2 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 13, y: 5 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(13, 5).id, facing: 2 });
  s.setSpeed(3);
});
const t0 = Date.now();
let lastTick = 0;
while (Date.now() - t0 < seconds * 1000) {
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const s = window.petalworks;
    const w = s.sim.world;
    const items = Object.values(w.structures).filter((x) => x.belt?.item).length;
    return { tick: w.tick, coins: w.coins, order: w.orders.activeId, done: w.orders.completedIds.length, items, delivered: w.stats.delivered };
  });
  if (info.tick === lastTick) errors.push('sim stalled at tick ' + info.tick);
  lastTick = info.tick;
  console.log(JSON.stringify(info));
  if (info.order === null && (await page.$('[data-testid="completion"]'))) await page.click('[data-testid="completion-close"]');
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `no runtime errors over ${seconds}s`);
await browser.close();
process.exit(errors.length ? 1 : 0);
