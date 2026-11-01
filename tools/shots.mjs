// Headless screenshots for the producer. Usage: node tools/shots.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
mkdirSync('producer/shots', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(base);
await page.waitForSelector('[data-testid="title"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
await page.waitForTimeout(600);
await page.screenshot({ path: 'producer/shots/00-title.png' });
await page.click('[data-testid="new-game"]');
await page.waitForSelector('[data-testid="order"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'producer/shots/01-fresh-garden.png' });

// Build a representative daisy chain through the real action API, then let it run.
await page.evaluate(() => {
  const s = window.petalworks;
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 7, y: 6, facing: 1 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 12, y: 7 }, { x: 12, y: 6 }] });
  s.fastForward(75);
  s.drainEvents();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'producer/shots/02-first-chain.png' });

await page.evaluate(() => {
  const s = window.petalworks;
  s.fastForward(60);
  s.drainEvents();
  const bed = Object.values(s.sim.world.structures).find((x) => x.kind === 'daisy_bed');
  s.select(bed.id);
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'producer/shots/03-inspector.png' });

// Everything unlocked: full palette, all machines, a blocked bed with its status disc, keyboard cursor.
await page.evaluate(() => {
  const s = window.petalworks;
  s.select(null);
  s.sim.world.coins = 500;
  s.sim.world.unlocked = ['belt', 'daisy_bed', 'lavender_bed', 'bundling_table', 'drying_bench', 'arrangement_table'];
  s.sim.world.expansionUnlocked = true;
  for (const st of Object.values(s.sim.world.structures)) if (st.kind !== 'packing_station') s.dispatch({ type: 'remove', id: st.id });
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 7, y: 6, facing: 1 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 8, y: 6 }, { x: 9, y: 6 }] });
  s.dispatch({ type: 'place', kind: 'bundling_table', x: 10, y: 6, facing: 1 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 11, y: 6 }] });
  s.dispatch({ type: 'place', kind: 'arrangement_table', x: 12, y: 6, facing: 1 });
  s.dispatch({ type: 'place', kind: 'lavender_bed', x: 12, y: 10, facing: 0 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 12, y: 9 }, { x: 12, y: 8 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(12, 8).id, facing: 0 });
  s.dispatch({ type: 'remove', id: s.sim.at(12, 8).id });
  s.dispatch({ type: 'place', kind: 'drying_bench', x: 12, y: 8, facing: 0 });
  s.dispatch({ type: 'place_belt_path', tiles: [{ x: 12, y: 7 }] });
  s.dispatch({ type: 'rotate', id: s.sim.at(12, 7).id, facing: 0 });
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 3, y: 2, facing: 1 }); // faces grass: shows the blocked disc
  s.fastForward(320);
  s.drainEvents();
  s.setUi({ cursor: { x: 5, y: 9 } });
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'producer/shots/04-all-machines.png' });

// Celebration beat: complete order 1 from a fresh layout and catch the card.
await page.evaluate(() => {
  const s = window.petalworks;
  for (const st of Object.values(s.sim.world.structures)) if (st.kind !== 'packing_station') s.dispatch({ type: 'remove', id: st.id });
  s.sim.world.stock = {};
  s.dispatch({ type: 'place', kind: 'daisy_bed', x: 11, y: 6, facing: 1 });
  s.dispatch({ type: 'place', kind: 'belt', x: 12, y: 6, facing: 1 });
  s.setUi({ notices: [] });
  s.fastForward(95);
  s.drainEvents();
});
await page.waitForTimeout(350);
await page.screenshot({ path: 'producer/shots/09-order-complete.png' });
await page.waitForTimeout(3200);
await page.evaluate(() => window.petalworks.setTool({ type: 'build', kind: 'daisy_bed' }));
await page.mouse.move(640, 330);
await page.waitForTimeout(300);
await page.screenshot({ path: 'producer/shots/05-build-ghost.png' });

await page.evaluate(() => {
  window.petalworks.setTool({ type: 'select' });
  window.petalworks.setUi({ settingsOpen: true });
});
await page.waitForTimeout(200);
await page.screenshot({ path: 'producer/shots/06-settings.png' });

await page.evaluate(() => window.petalworks.setUi({ settingsOpen: false }));
await page.setViewportSize({ width: 1366, height: 768 });
await page.evaluate(() => window.petalworks.setUi({ cursor: null }));
await page.keyboard.press('Home');
await page.waitForTimeout(400);
await page.screenshot({ path: 'producer/shots/07-laptop-1366x768.png' });
await page.setViewportSize({ width: 1280, height: 800 });
await page.keyboard.press('Home');
await page.waitForTimeout(400);
await page.screenshot({ path: 'producer/shots/08-laptop-1280x800.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no runtime errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
