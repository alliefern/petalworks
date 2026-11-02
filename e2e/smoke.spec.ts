import { expect, test, type Page } from '@playwright/test';

/**
 * Browser smoke test: a fresh game played through real clicks for order 1, the
 * remaining orders driven through the public action API plus fast-forward, a reload
 * mid-transport, a completed save reloading into the sandbox, and a corrupted save.
 */

// The store is exposed on window.petalworks for this harness (see src/app/store.ts).

async function startFresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="title"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
  await expect(page.getByTestId('continue')).toHaveCount(0);
  await page.click('[data-testid="new-game"]');
  await page.waitForSelector('[data-testid="order"]');
}

test.describe('Petalworks smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => {
      throw new Error('page error: ' + e.message);
    });
  });

  test('fresh game: build order 1 with the mouse, finish all six orders, reload, sandbox', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await startFresh(page);
    await expect(page.getByTestId('coins')).toHaveText('120');
    await expect(page.getByTestId('tutorial')).toBeVisible();

    // Place a Daisy Bed by clicking the palette, then the garden, using the camera to find tiles.
    const screenOf = async (tx: number, ty: number) =>
      page.evaluate(
        ([x, y]) => {
          const cam = (window as any).__cam as { worldView: { x: number; y: number }; zoom: number };
          const T = 64;
          const wx = x * T + T / 2;
          const wy = y * T + T / 2;
          return { x: (wx - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom };
        },
        [tx, ty],
      );
    // Expose the camera through the store's scene (set up by the app for tests).
    await page.waitForFunction(() => !!(window as any).__cam);

    await page.click('[data-testid="build-daisy_bed"]');
    const bedPos = await screenOf(10, 6);
    await page.mouse.click(bedPos.x, bedPos.y);
    await expect(page.getByTestId('coins')).toHaveText('100');
    expect(await page.evaluate(() => (window as any).petalworks.sim.at(10, 6)?.kind)).toBe('daisy_bed');

    // Drag belts from (11,6) to (12,6) into the pre-placed Packing Station at (13,6).
    await page.click('[data-testid="build-belt"]');
    const a = await screenOf(11, 6);
    const b = await screenOf(12, 6);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => [(window as any).petalworks.sim.at(11, 6)?.kind, (window as any).petalworks.sim.at(12, 6)?.kind])).toEqual(['belt', 'belt']);
    await expect(page.getByTestId('coins')).toHaveText('96');

    // Escape cancels the tool; right-click would too.
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).petalworks.ui.tool.type)).toBe('select');

    // Select the bed and read the inspector.
    await page.mouse.click(bedPos.x, bedPos.y);
    await expect(page.getByTestId('inspector')).toContainText('Daisy Bed');

    // Let it run: order 1 completes from real deliveries.
    await page.evaluate(() => (window as any).petalworks.fastForward(150));
    await expect(page.getByTestId('coins')).toHaveText(String(96 + 50));
    await expect(page.getByTestId('order')).toContainText('Order 2 of 6');

    // Reload mid-transport: same garden, same coins, same order, items once.
    await page.evaluate(() => (window as any).petalworks.fastForward(43));
    // Snapshot and save in one page call so no sim tick can land between them.
    const before = await page.evaluate(() => {
      (window as any).petalworks.save();
      return JSON.stringify((window as any).petalworks.sim.world);
    });
    await page.reload();
    await page.waitForSelector('[data-testid="continue"]');
    await page.click('[data-testid="continue"]');
    await page.waitForSelector('[data-testid="order"]');
    const after = await page.evaluate(() => JSON.stringify((window as any).petalworks.sim.world));
    expect(after).toBe(before);

    // Finish the remaining orders through the action API (chains are tested in Vitest; this checks the app wiring).
    await page.evaluate(() => {
      const s = (window as any).petalworks;
      const px = 13;
      const py = 6;
      s.dispatch({ type: 'remove', id: s.sim.at(12, 6).id });
      s.dispatch({ type: 'remove', id: s.sim.at(11, 6).id });
      s.dispatch({ type: 'remove', id: s.sim.at(10, 6).id });
      s.dispatch({ type: 'place', kind: 'daisy_bed', x: px - 3, y: py, facing: 1 });
      s.dispatch({ type: 'place', kind: 'belt', x: px - 2, y: py, facing: 1 });
      s.dispatch({ type: 'place', kind: 'bundling_table', x: px - 1, y: py, facing: 1 });
    });
    const until = async (pred: string, max: number) => {
      await page.evaluate(
        ([p, m]) => {
          const s = (window as any).petalworks;
          const fn = new Function('s', 'return ' + p) as (s: unknown) => boolean;
          for (let i = 0; i < m && !fn(s); i += 50) s.fastForward(50);
        },
        [pred, max] as [string, number],
      );
    };
    await until("s.sim.world.orders.activeId === 'order4'", 5000);
    await expect(page.getByTestId('order')).toContainText('Order 4 of 6');
    await page.evaluate(() => {
      const s = (window as any).petalworks;
      s.dispatch({ type: 'place', kind: 'lavender_bed', x: 13, y: 9, facing: 0 });
      s.dispatch({ type: 'place', kind: 'belt', x: 13, y: 8, facing: 0 });
      s.dispatch({ type: 'place', kind: 'belt', x: 13, y: 7, facing: 0 });
    });
    await until("s.sim.world.orders.activeId === 'order5'", 3000);
    await page.evaluate(() => {
      const s = (window as any).petalworks;
      s.dispatch({ type: 'remove', id: s.sim.at(13, 8).id });
      s.dispatch({ type: 'place', kind: 'drying_bench', x: 13, y: 8, facing: 0 });
    });
    await until("s.sim.world.orders.activeId === 'order6'", 4000);
    await page.evaluate(() => {
      const s = (window as any).petalworks;
      s.dispatch({ type: 'remove', id: s.sim.at(13, 7).id });
      s.dispatch({ type: 'place', kind: 'arrangement_table', x: 13, y: 7, facing: 0 });
      s.dispatch({ type: 'rotate', id: s.sim.at(12, 6).id, facing: 2 });
      s.dispatch({ type: 'place', kind: 'belt', x: 12, y: 7, facing: 1 });
    });
    await until('s.sim.world.orders.activeId === null', 9000);
    await expect(page.getByTestId('completion')).toBeVisible();
    await page.click('[data-testid="completion-close"]');
    await expect(page.getByTestId('order-sandbox')).toBeVisible();
    // Every tool is unlocked in the sandbox and deliveries sell.
    await expect(page.getByTestId('build-arrangement_table')).toBeVisible();
    const coins = await page.evaluate(() => (window as any).petalworks.sim.world.coins);
    await page.evaluate(() => (window as any).petalworks.fastForward(400));
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.coins)).toBeGreaterThan(coins);

    // Completed save reloads into the sandbox without replaying the ending.
    await page.evaluate(() => (window as any).petalworks.save());
    await page.reload();
    await page.click('[data-testid="continue"]');
    await expect(page.getByTestId('order-sandbox')).toBeVisible();
    await expect(page.getByTestId('completion')).toHaveCount(0);
    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('settings persist, pause holds the sim, keyboard builds', async ({ page }) => {
    await startFresh(page);
    await page.click('[data-testid="settings"]');
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    // Sound off, music off, reduced motion on; Esc closes.
    await page.getByRole('radio', { name: 'Sound effects off', exact: true }).click();
    await page.getByRole('radio', { name: 'Music off', exact: true }).click();
    await page.getByRole('radio', { name: 'Reduced motion on', exact: true }).click();
    // Volume sliders: set both, then the top-bar speaker mutes without touching them.
    await page.getByTestId('music-volume').fill('40');
    await page.getByTestId('sfx-volume').fill('25');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).toHaveCount(0);
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('mute').click();
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('mute')).toHaveAccessibleName(/Sound off/);
    await page.reload();
    await page.click('[data-testid="continue"]');
    expect(await page.evaluate(() => (window as any).petalworks.ui.settings)).toMatchObject({ sound: false, music: false, reducedMotion: true, muted: true, musicVolume: 40, sfxVolume: 25 });
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'false');
    // M toggles the speaker back on and keeps the levels.
    await page.keyboard.press('m');
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).petalworks.ui.settings)).toMatchObject({ muted: false, musicVolume: 40, sfxVolume: 25 });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-reduced-motion'))).toBe('true');

    // Pause freezes the tick counter.
    await page.click('[data-testid="pause"]');
    const t0 = await page.evaluate(() => (window as any).petalworks.sim.world.tick);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.tick)).toBe(t0);
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.tick)).toBeGreaterThan(t0);

    // Keyboard: focus the garden, move the cursor, place a bed with Enter, rotate with R, undo with Z.
    await page.click('[data-testid="build-daisy_bed"]');
    await page.focus('.world');
    await page.keyboard.press('ArrowRight');
    const cursor = await page.evaluate(() => (window as any).petalworks.ui.cursor);
    expect(cursor).toBeTruthy();
    await page.keyboard.press('r');
    expect(await page.evaluate(() => (window as any).petalworks.ui.buildFacing)).toBe(2);
    await page.keyboard.press('Enter');
    const placed = await page.evaluate(() => {
      const c = (window as any).petalworks.ui.cursor;
      return (window as any).petalworks.sim.at(c.x, c.y)?.kind;
    });
    expect(placed).toBe('daisy_bed');
    await page.keyboard.press('Escape');
    await page.keyboard.press('z');
    expect(
      await page.evaluate(() => {
        const c = (window as any).petalworks.ui.cursor;
        return (window as any).petalworks.sim.at(c.x, c.y);
      }),
    ).toBeNull();
    await expect(page.getByTestId('coins')).toHaveText('120');
  });

  test('a corrupted save offers a new game instead of crashing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('petalworks.save', '{"schemaVersion":2,"world":"nope"'));
    await page.reload();
    await page.waitForSelector('[data-testid="title"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
    // The title shows Continue (a save exists); choosing it reports the problem and offers New Game.
    await page.click('[data-testid="continue"]');
    await expect(page.locator('.problem')).toBeVisible();
    await expect(page.getByTestId('continue')).toHaveCount(0);
    await page.click('[data-testid="new-game"]');
    await expect(page.getByTestId('order')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('petalworks.save.backup'))).toContain('nope');
  });

  test('New Game asks first; cancel keeps the garden, confirm starts over (plan test 57)', async ({ page }) => {
    await startFresh(page);
    // A distinctive garden: a belt and spent coins.
    await page.evaluate(() => {
      const s = (window as any).petalworks;
      s.dispatch({ type: 'place_belt_path', tiles: [4, 5, 6].map((x) => ({ x, y: 5 })) });
      s.save();
    });
    const coins = await page.evaluate(() => (window as any).petalworks.sim.world.coins);
    await page.click('[data-testid="settings"]');
    await page.getByTestId('settings-new-game').click();
    // Plain-language confirmation, then cancel.
    await expect(page.getByTestId('settings-modal')).toContainText(/erases your saved garden/i);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).petalworks.sim.at(5, 5)?.kind)).toBe('belt');
    await page.reload();
    await page.click('[data-testid="continue"]');
    await page.waitForSelector('[data-testid="order"]');
    expect(await page.evaluate(() => (window as any).petalworks.sim.at(5, 5)?.kind)).toBe('belt');
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.coins)).toBe(coins);
    // Confirm: order 1, starting coins, empty yard, tips offered again.
    await page.click('[data-testid="settings"]');
    await page.getByTestId('settings-new-game').click();
    await page.getByTestId('settings-new-game-confirm').click();
    await expect(page.getByTestId('order')).toContainText('Deliver 2 Daisies');
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.coins)).toBe(120);
    expect(await page.evaluate(() => (window as any).petalworks.sim.at(5, 5))).toBeNull();
    await expect(page.getByTestId('tutorial')).toBeVisible();
    // A reload shows the new game, not the old one.
    await page.reload();
    await page.click('[data-testid="continue"]');
    await page.waitForSelector('[data-testid="order"]');
    expect(await page.evaluate(() => (window as any).petalworks.sim.at(5, 5))).toBeNull();
    expect(await page.evaluate(() => (window as any).petalworks.sim.world.coins)).toBe(120);
  });

  test('a save from a newer version explains itself and offers a new game (plan test 56)', async ({ page }) => {
    await startFresh(page);
    await page.evaluate(() => (window as any).petalworks.save());
    // Back on the title screen (no game running, so nothing autosaves over the edit).
    await page.goto('/');
    await page.waitForSelector('[data-testid="title"]');
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('petalworks.save')!);
      raw.schemaVersion = 9999;
      localStorage.setItem('petalworks.save', JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForSelector('[data-testid="title"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'));
    await page.click('[data-testid="continue"]');
    await expect(page.locator('.problem')).toBeVisible();
    await expect(page.locator('.problem')).not.toContainText(/JSON|schema|undefined/);
    await page.click('[data-testid="new-game"]');
    await expect(page.getByTestId('order')).toBeVisible();
    // The unreadable save was kept as a backup rather than deleted.
    expect(await page.evaluate(() => localStorage.getItem('petalworks.save.backup'))).toContain('9999');
  });

  test('the Open Plot label stays on screen and clear of the side cards', async ({ page }) => {
    await startFresh(page);
    await page.evaluate(async () => {
      (window as any).petalworks.sim.world.expansionUnlocked = true;
      await document.fonts.ready;
    });
    const sizes = [
      { width: 1024, height: 640 },
      { width: 1280, height: 800 },
      { width: 1366, height: 768 },
    ];
    for (const size of sizes) {
      await page.setViewportSize(size);
      await settleGarden(page, size);
      await expectLockedLabelClear(page, size, 'resize');
      await page.keyboard.press('Home');
      await settleGarden(page, size);
      await expectLockedLabelClear(page, size, 'fit');
    }
  });
});

async function settleGarden(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.waitForFunction(
    (viewport) => {
      const cam = (window as any).__cam;
      return !!cam && Math.abs(cam.width - viewport.width) < 2 && Math.abs(cam.height - viewport.height) < 2;
    },
    size,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
      }),
  );
}

interface LabelReport {
  visible: boolean;
  text: string;
  anchorOnScreen: boolean;
  anchorX: number;
  anchorY: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

async function lockedLabelReport(page: Page, size: { width: number; height: number }): Promise<LabelReport | null> {
  return page.evaluate((viewport) => {
    const cam = (window as any).__cam;
    const t = cam?.scene?.lockedText?.[0];
    if (!t) return null;
    const zoom = cam.zoom || 1;
    const homeX = (t.getData('homeX') as number | undefined) ?? t.x;
    const homeY = (t.getData('homeY') as number | undefined) ?? t.y;
    const ax = (homeX - cam.worldView.x) * zoom;
    const ay = (homeY - cam.worldView.y) * zoom;
    const cx = (t.x - cam.worldView.x) * zoom;
    const cy = (t.y - cam.worldView.y) * zoom;
    const w = t.displayWidth * zoom;
    const h = t.displayHeight * zoom;
    return {
      visible: !!t.visible,
      text: String(t.text),
      anchorOnScreen: ax >= 0 && ay >= 0 && ax <= viewport.width && ay <= viewport.height,
      anchorX: ax,
      anchorY: ay,
      left: cx - w / 2,
      top: cy - h / 2,
      right: cx + w / 2,
      bottom: cy + h / 2,
    };
  }, size);
}

/** A shown label must sit fully inside the window and not under a HUD card. */
async function expectLockedLabelClear(page: Page, size: { width: number; height: number }, when: string): Promise<void> {
  await page.waitForFunction(() => ((window as any).__cam?.scene?.lockedText?.length ?? 0) > 0);
  const report = await lockedLabelReport(page, size);
  expect(report, `${when} ${size.width}x${size.height}`).toBeTruthy();
  if (!report) return;
  const where = `${when} ${size.width}x${size.height} ${JSON.stringify(report)}`;
  if (!report.visible) {
    expect(report.anchorOnScreen, where).toBe(false);
    return;
  }
  expect(report.text, where).toContain('Open Plot');
  expect(report.text, where).toContain('100');
  expect(report.left, where).toBeGreaterThanOrEqual(-1);
  expect(report.top, where).toBeGreaterThanOrEqual(-1);
  expect(report.right, where).toBeLessThanOrEqual(size.width + 1);
  expect(report.bottom, where).toBeLessThanOrEqual(size.height + 1);
  const cards = await page.evaluate(() => {
    const found: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const sel of ['.orderpanel', '.tutorial', '.inspector', '.palette', '.topbar']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      found[sel] = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    }
    return found;
  });
  for (const [sel, card] of Object.entries(cards)) {
    const overlaps = report.left < card.x + card.w - 1 && report.right > card.x + 1 && report.top < card.y + card.h - 1 && report.bottom > card.y + 1;
    expect(overlaps, `${where} overlaps ${sel} ${JSON.stringify(card)}`).toBe(false);
  }
}
