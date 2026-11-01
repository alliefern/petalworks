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
    const before = await page.evaluate(() => JSON.stringify((window as any).petalworks.sim.world));
    await page.evaluate(() => (window as any).petalworks.save());
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
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).toHaveCount(0);
    await page.reload();
    await page.click('[data-testid="continue"]');
    expect(await page.evaluate(() => (window as any).petalworks.ui.settings)).toMatchObject({ sound: false, music: false, reducedMotion: true });
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
});
