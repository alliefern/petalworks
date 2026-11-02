// Scripted pass over qa/accessibility-checklist.md against the built game.
// Usage: node tools/a11ycheck.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };
const section = (t) => console.log(`\n## ${t}`);

async function fresh(viewport, dsf = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()));
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
  return { ctx, page, errors };
}
const startGame = async (page) => { await page.click('[data-testid="new-game"]'); await page.waitForSelector('[data-testid="order"]'); await page.waitForTimeout(300); };
const ev = (page, fn, arg) => page.evaluate(fn, arg);

// Contrast of a text element against the first painted ancestor background.
const CONTRAST_FN = (sel) => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return { L: 0.2126 * r + 0.7152 * g + 0.0722 * b, a: m.length > 3 ? m[3] : 1 }; };
  const el = document.querySelector(sel); if (!el) return null;
  const fg = getComputedStyle(el).color;
  let node = el, bg = null;
  while (node && node !== document.documentElement) { const b = getComputedStyle(node).backgroundColor; const l = lum(b); if (l.a > 0.85) { bg = b; break; } node = node.parentElement; }
  if (!bg) return { sel, fg, bg: null, ratio: 0 };
  const a = lum(fg).L, b = lum(bg).L; const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return { sel, fg, bg, ratio: Math.round(ratio * 100) / 100, darkOnLight: a < b, size: parseFloat(getComputedStyle(el).fontSize) };
};

// ---------------------------------------------------------------- 1366x768 main pass
{
  const { ctx, page, errors } = await fresh({ width: 1366, height: 768 });
  section('Sound: silence until the first gesture (1366x768)');
  await page.waitForTimeout(800);
  check(await ev(page, () => window.petalworksAudio.audio.unlocked !== true), 'audio context is not created before the first click or key');
  await startGame(page);
  check(await ev(page, () => window.petalworksAudio.audio.unlocked === true), 'audio unlocks on the first click');

  section('State and contrast (1366x768)');
  const contrastSels = ['[data-testid="coins"]', '.orderpanel .title', '.orderpanel .customer', '.req .count', '.tutorial p', '.topbar .btn span'];
  for (const sel of contrastSels) {
    const r = await ev(page, CONTRAST_FN, sel);
    check(r && r.ratio >= 4.5 && r.darkOnLight, `${sel}: ${r ? `${r.fg} on ${r.bg} = ${r.ratio}:1, ${r.size}px` : 'missing'} (dark ink on cream, at least 4.5:1)`);
  }
  // Select the packing station for the inspector; then a blocked, ready and waiting structure.
  const pk = await ev(page, () => { const s = window.petalworks; const st = Object.values(s.sim.world.structures).find((x) => x.kind === 'packing_station'); s.select(st.id); return st.id; });
  await page.waitForTimeout(100);
  for (const sel of ['.inspector h3', '.inspector .blurb', '.inspector .row', '.inspector .label']) {
    const r = await ev(page, CONTRAST_FN, sel);
    check(r && r.ratio >= 4.5 && r.darkOnLight, `${sel}: ${r ? `${r.ratio}:1, ${r.size}px` : 'missing'}`);
  }
  // Blocked bed: a bed with nothing connected; let it grow and block.
  const bedId = await ev(page, () => { const s = window.petalworks; s.sim.world.coins = 1000; const r = s.dispatch({ type: 'place', kind: 'daisy_bed', x: 4, y: 4, facing: 1 }); s.fastForward(400); s.drainEvents(); s.select(r.ids[0]); return r.ids[0]; });
  await page.waitForTimeout(150);
  const blockedText = await ev(page, () => document.querySelector('.inspector')?.textContent || '');
  check(/Blocked/i.test(blockedText) && /(belt|connect|exit|full|nowhere|output|ends)/i.test(blockedText), `blocked bed: inspector says Blocked and why ("${blockedText.slice(0, 120).replace(/\s+/g, ' ')}")`);
  const badge = await ev(page, (id) => { const v = window.__scene.views.get(id); return { disc: v.disc.visible && v.disc.texture.key, pennant: v.pennant.visible && (v.pennant.frame?.name || v.pennant.texture.key) }; }, bedId);
  check(badge.disc === 'disc.blocked' && /blocked/.test(String(badge.pennant)), `blocked bed shows the ink ! disc and the blocked badge (${badge.disc}, ${badge.pennant})`);
  const labels = await ev(page, () => window.petalworks.ui.blockedLabels.length);
  check(labels === 1, `one blocked label beside the bed, not a banner (${labels})`);
  const notices = await ev(page, () => document.querySelectorAll('[data-testid="notice"]').length);
  check(notices <= 2, `no repeating toasts while it stays blocked (${notices} on screen)`);
  check(/right/.test(blockedText), 'inspector says the exit direction in words (right)');
  // Waiting machine: bundling table with one daisy.
  const tblId = await ev(page, () => { const s = window.petalworks; if (!s.sim.world.unlocked.includes('bundling_table')) s.sim.world.unlocked.push('bundling_table'); const r = s.dispatch({ type: 'place', kind: 'bundling_table', x: 8, y: 8, facing: 1 }); const t = s.sim.world.structures[r.ids[0]]; t.processor.inputs.push({ id: s.sim.world.nextItemId++, kind: 'daisy' }); s.drainEvents(); s.select(r.ids[0]); return r.ids[0]; });
  await page.waitForTimeout(150);
  const waitingText = await ev(page, () => document.querySelector('.inspector')?.textContent || '');
  check(/Waiting|Needs|more/i.test(waitingText) && /daisy|daisies/i.test(waitingText), `waiting machine: inspector names what is missing ("${waitingText.slice(0, 100).replace(/\s+/g, ' ')}")`);
  const wbadge = await ev(page, (id) => { window.petalworks.fastForward(5); window.petalworks.drainEvents(); const v = window.__scene.views.get(id); return v.disc.visible && v.disc.texture.key; }, tblId);
  check(wbadge === 'disc.waiting', `waiting machine shows the ink … disc (${wbadge})`);
  // Ready bed.
  await ev(page, (id) => { const s = window.petalworks; const b = s.sim.world.structures[id]; if (!b.producer.output) b.producer.output = { id: s.sim.world.nextItemId++, kind: 'daisy' }; b.producer.blockedTicks = 0; s.drainEvents(); s.select(id); }, bedId);
  await page.waitForTimeout(150);
  const rText = await ev(page, (id) => { window.petalworks.select(id); return { sel: window.petalworks.ui.selectedId, text: document.querySelector('.inspector')?.textContent || '' }; }, bedId);
  check(/Ready/i.test(rText.text), `ready bed: inspector says Ready (selected ${rText.sel}: "${rText.text.slice(0, 80).replace(/\s+/g, ' ')}")`);
  if (errors.length) console.log('  page errors so far: ' + errors.join(' | '));
  // Distinct textures for the four states and the three placement shapes.
  const tex = await ev(page, () => { const t = window.__scene.textures; const keys = ['disc.blocked', 'disc.wrong', 'disc.ready', 'disc.waiting', 'ring.valid', 'ring.invalid', 'ring.select']; const out = {}; for (const k of keys) { if (!t.exists(k)) { out[k] = null; continue; } const src = t.get(k).getSourceImage(); const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); out[k] = c.toDataURL().length + ':' + c.toDataURL().slice(-40); } return out; });
  const vals = Object.values(tex);
  check(vals.every(Boolean) && new Set(vals).size === vals.length, `blocked/wrong/ready/waiting discs and valid/invalid/select shapes are seven distinct drawings${vals.every(Boolean) ? '' : ' (missing: ' + Object.keys(tex).filter((k) => !tex[k]).join(', ') + ')'}`);
  // Locked grass refuses in words.
  const locked = await ev(page, () => { const s = window.petalworks; const w = s.sim.world; for (let y = -3; y < w.rows + 3; y++) for (let x = -3; x < w.cols + 3; x++) { const r = s.sim.canPlace('daisy_bed', x, y); if (r.error === 'locked_plot') return r.message; } return null; });
  check(!!locked && /closed/i.test(locked), `building on a closed plot says it is closed ("${locked}")`);
  const outside = await ev(page, () => window.petalworks.sim.canPlace('daisy_bed', -5, -5).message);
  check(/outside/i.test(outside), `building outside the garden says so ("${outside}")`);

  section('Reduced motion (1366x768)');
  await page.click('[data-testid="settings"]');
  const rmHelp = await page.locator('.setting', { hasText: 'Reduced motion' }).textContent();
  check(/keeps going|still runs|garden keeps/i.test(rmHelp), `settings has one Reduced motion toggle with the line that the garden keeps going ("${rmHelp.slice(0, 90)}")`);
  await page.getByRole('radio', { name: 'Reduced motion on', exact: true }).click();
  await page.keyboard.press('Escape');
  check((await ev(page, () => document.documentElement.getAttribute('data-reduced-motion'))) === 'true', 'reduced motion flag set on the document');
  // Items still move: build a belt run from the ready bed and watch progress.
  const moved = await ev(page, () => { const s = window.petalworks; s.dispatch({ type: 'place_belt_path', tiles: [5, 6, 7].map((x) => ({ x, y: 4 })) }); s.fastForward(30); s.drainEvents(); const belts = Object.values(s.sim.world.structures).filter((b) => b.kind === 'belt'); return belts.some((b) => b.belt.item); });
  check(moved, 'with reduced motion on, daisies still ride the belts');
  await page.waitForTimeout(400); // let the scene create the belt views and animate a few frames
  const chevron = await ev(page, () => { const s = window.petalworks; const b = Object.values(s.sim.world.structures).find((x) => x.kind === 'belt'); const v = window.__scene.views.get(b.id); return v ? v.beltSig.split('|')[0] : 'no view'; });
  check(chevron === '0', `belt chevrons hold still (frame ${chevron})`);
  await page.reload();
  await page.click('[data-testid="continue"]');
  await page.waitForSelector('[data-testid="order"]');
  check((await ev(page, () => document.documentElement.getAttribute('data-reduced-motion'))) === 'true', 'reduced motion survives a reload');
  await page.click('[data-testid="settings"]');
  await page.getByRole('radio', { name: 'Reduced motion off', exact: true }).click();
  await page.keyboard.press('Escape');

  section('Keyboard (1366x768)');
  // Tab order: start from the document and walk forward, noting focus rings.
  await ev(page, () => { document.activeElement?.blur(); window.focus(); });
  const reached = new Map();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const f = await ev(page, () => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { id: el.getAttribute('data-testid') || el.className || el.tagName, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }; });
    if (f) reached.set(f.id, f.ring);
  }
  const want = ['pause', 'speed-1', 'mute', 'undo', 'help', 'settings', 'build-daisy_bed'];
  for (const w of want) check(reached.has(w) && reached.get(w), `Tab reaches ${w} with a visible focus ring`);
  check([...reached.keys()].some((k) => /world/.test(String(k))), 'Tab reaches the garden');
  // Cursor keys and placement.
  await page.click('[data-testid="build-daisy_bed"]');
  await ev(page, () => document.querySelector('.world').focus());
  const c0 = await ev(page, () => { window.petalworks.setUi({ cursor: { x: 10, y: 10 } }); return window.petalworks.ui.cursor; });
  await page.keyboard.press('ArrowRight');
  const c1 = await ev(page, () => window.petalworks.ui.cursor);
  check(c1.x === c0.x + 1 && c1.y === c0.y, `arrow keys move the cursor (${c0.x},${c0.y} -> ${c1.x},${c1.y})`);
  await page.keyboard.press('r');
  const f1 = await ev(page, () => window.petalworks.ui.buildFacing);
  await page.keyboard.press('Shift+R');
  const f2 = await ev(page, () => window.petalworks.ui.buildFacing);
  check(f1 === 2 && f2 === 1, `R rotates and Shift+R rotates back (${f1}, ${f2})`);
  const coinsBefore = await ev(page, () => window.petalworks.sim.world.coins);
  await page.keyboard.press('Enter');
  const placed = await ev(page, (c) => window.petalworks.sim.at(c.x, c.y)?.kind, c1);
  check(placed === 'daisy_bed' && (await ev(page, () => window.petalworks.sim.world.coins)) === coinsBefore - 20, 'Enter places a bed at the cursor and charges once');
  await page.keyboard.press('Escape');
  check((await ev(page, () => window.petalworks.ui.tool.type)) === 'select', 'Esc disarms the tool');
  // Belt path from the keyboard, and Esc drops a path.
  await page.click('[data-testid="build-belt"]');
  await ev(page, () => { document.querySelector('.world').focus(); window.petalworks.setUi({ cursor: { x: 10, y: 6 } }); });
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const laid = await ev(page, () => [10, 11, 12].map((x) => window.petalworks.sim.at(x, 6)?.kind === 'belt'));
  check(laid.every(Boolean), `belt path laid from the keyboard: Enter, arrows, Enter (${laid.join(',')})`);
  const nBefore = await ev(page, () => Object.keys(window.petalworks.sim.world.structures).length);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  const nAfter = await ev(page, () => ({ n: Object.keys(window.petalworks.sim.world.structures).length, active: window.petalworks.ui.keyPathActive }));
  check(nAfter.n === nBefore && !nAfter.active, 'Esc drops a keyboard belt path without placing');
  // Select, X / Delete, Z.
  await page.keyboard.press('Escape');
  await ev(page, () => { window.petalworks.setTool({ type: 'select' }); window.petalworks.setUi({ cursor: { x: 11, y: 6 } }); document.querySelector('.world').focus(); });
  await page.keyboard.press('Enter');
  const insp = await ev(page, () => ({ sel: window.petalworks.ui.selectedId, text: document.querySelector('.inspector')?.textContent || '' }));
  check(insp.sel !== null && /Belt/i.test(insp.text) && /(up|right|down|left)/.test(insp.text), 'Enter selects a belt and the inspector shows status and facing in words');
  await page.keyboard.press('Delete');
  check((await ev(page, () => window.petalworks.sim.at(11, 6))) === null, 'Delete removes the selected structure');
  await page.keyboard.press('z');
  check((await ev(page, () => window.petalworks.sim.at(11, 6)?.kind)) === 'belt', 'Z undoes the removal');
  await page.keyboard.press('x');
  check((await ev(page, () => window.petalworks.ui.tool.type)) === 'remove', 'X arms the remove tool');
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  const paused = await ev(page, () => window.petalworks.ui.paused);
  await page.keyboard.press('p');
  const sp0 = await ev(page, () => window.petalworks.ui.speed);
  await page.keyboard.press('f');
  const sp1 = await ev(page, () => window.petalworks.ui.speed);
  check(paused && !(await ev(page, () => window.petalworks.ui.paused)) && sp1 !== sp0, `P pauses and resumes, F changes speed (${sp0} -> ${sp1})`);
  // Focus traps.
  await page.click('[data-testid="settings"]');
  let inside = true;
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); inside = inside && (await ev(page, () => !!document.activeElement?.closest('[data-testid="settings-modal"]'))); }
  check(inside, 'Settings traps focus while open');
  await page.getByTestId('settings-new-game').click();
  let inside2 = true;
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); inside2 = inside2 && (await ev(page, () => !!document.activeElement?.closest('[data-testid="settings-modal"]'))); }
  check(inside2, 'New Game confirm keeps focus in the dialog');
  await page.keyboard.press('Escape');
  check((await page.getByTestId('settings-modal').count()) === 0 && (await ev(page, () => window.petalworks.ui.screen)) === 'game', 'Esc returns to the garden without starting a new game');

  section('Sound settings (1366x768)');
  await page.click('[data-testid="settings"]');
  const words = await ev(page, () => [...document.querySelectorAll('.toggle button')].map((b) => b.textContent.trim()));
  check(words.filter((w) => w === 'On').length >= 3 && words.filter((w) => w === 'Off').length >= 3, 'each toggle shows On and Off in words');
  await page.getByRole('radio', { name: 'Sound effects off', exact: true }).click();
  await page.getByRole('radio', { name: 'Music off', exact: true }).click();
  await page.keyboard.press('Escape');
  const eng = await ev(page, () => { const a = window.petalworksAudio.audio; return { sound: a.sound, music: a.music, sfx: a.sfxTarget ? a.sfxTarget() : null }; });
  check(eng.sound === false && eng.music === false, 'Sound effects Off and Music Off are separate flags in the engine');
  await page.reload();
  await page.click('[data-testid="continue"]');
  await page.waitForSelector('[data-testid="order"]');
  const after = await ev(page, () => window.petalworks.ui.settings);
  check(after.sound === false && after.music === false, 'both choices survive a reload');
  await ev(page, () => window.petalworks.newGame());
  await page.waitForTimeout(200);
  const afterNew = await ev(page, () => window.petalworks.ui.settings);
  check(afterNew.sound === false && afterNew.music === false, 'both choices survive New Game');
  check(errors.length === 0, `no page errors in the 1366x768 pass${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------------------------------------------------------------- type and the laptop window
for (const [w, h] of [[1366, 768], [1280, 800]]) {
  const { ctx, page } = await fresh({ width: w, height: h });
  await startGame(page);
  section(`Type and the laptop window (${w}x${h})`);
  await ev(page, () => { const s = window.petalworks; const st = Object.values(s.sim.world.structures)[0]; s.select(st.id); });
  await page.waitForTimeout(100);
  const sizes = await ev(page, () => { const out = {}; for (const sel of ['.orderpanel .title', '.orderpanel .customer', '.orderpanel .note', '.req', '.orderpanel .progress-label', '.inspector .blurb', '.inspector .row', '.inspector .muted', '.inspector .why', '.tutorial p', '.topbar .btn']) { const el = document.querySelector(sel); if (el) out[sel] = parseFloat(getComputedStyle(el).fontSize); } return out; });
  for (const [sel, px] of Object.entries(sizes)) check(px >= 16, `${sel} is ${px}px (at least 16)`);
  const small = await ev(page, () => [...document.querySelectorAll('.hud button')].filter((b) => b.offsetParent !== null).map((b) => { const r = b.getBoundingClientRect(); return { id: b.getAttribute('data-testid') || b.getAttribute('aria-label') || b.textContent.trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((b) => b.w < 44 || b.h < 44));
  check(small.length === 0, `every visible button is at least 44x44${small.length ? ': ' + small.map((b) => `${b.id} ${b.w}x${b.h}`).join(', ') : ''}`);
  const wordless = await ev(page, () => [...document.querySelectorAll('.topbar button, .palette button')].filter((b) => b.offsetParent !== null && !b.textContent.trim() && !(b.getAttribute('aria-label') || '').trim()).length);
  check(wordless === 0, 'every top-bar and palette button has a visible word or a spoken label');
  const tile = await ev(page, () => (64 * window.__cam.zoom) / (window.__k || 1));
  check(tile >= 47.5, `default tiles are ${tile.toFixed(1)} css px with the build menu open (at least 48)`);
  await ctx.close();
}

// 200% browser zoom ~ half the CSS viewport at 2x.
{
  const { ctx, page } = await fresh({ width: 683, height: 384 }, 2);
  await startGame(page);
  section('200% browser zoom (1366x768 at 2x)');
  const r = await ev(page, () => { const o = document.querySelector('.orderpanel'); const t = document.querySelector('.topbar'); const kids = [...t.children].map((c) => c.getBoundingClientRect()); return { orderRight: o.getBoundingClientRect().right, orderClipped: o.scrollWidth > o.clientWidth + 1, orderText: document.querySelector('[data-testid="order"]').textContent, barMaxRight: Math.max(...kids.map((k) => k.right)), barRows: new Set(kids.map((k) => Math.round(k.top))).size, vw: innerWidth }; });
  check(r.orderRight <= r.vw + 1 && !r.orderClipped && /Deliver 2 Daisies/.test(r.orderText), `order sentence fully visible (right edge ${Math.round(r.orderRight)} of ${r.vw})`);
  check(r.barMaxRight <= r.vw + 1, `top bar wraps instead of clipping (rightmost ${Math.round(r.barMaxRight)} of ${r.vw}, ${r.barRows} row(s))`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nFAIL ${fails} checks` : '\nPASS accessibility checklist (scripted part)');
process.exit(fails ? 1 : 0);
