import { expect, test } from '@playwright/test';

// The editor is one full-window GPU canvas (#op) with an a11y mirror and an
// error <pre>; the app logs its own boot markers (op-smoke:booting/ok).
// Console *warnings* (WebGL driver stalls) are normal in headless Chromium;
// only console errors and pageerrors count as failures here.
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

test('SMOKE-001 managed editor boots the canvas cleanly', async ({ page }) => {
  const errors = watchErrors(page);
  const logs = [];
  page.on('console', (msg) => { if (msg.type() === 'log') logs.push(msg.text()); });

  await page.goto(String(process.env.OPENPENCIL_SMOKE_EDITOR_URL), { waitUntil: 'load', timeout: 60000 });
  await expect(page).toHaveTitle('OpenPencil');
  await expect(page.locator('canvas#op')).toBeVisible({ timeout: 30000 });
  // The canvas UI's accessibility mirror must expose the primary regions.
  await expect(page.locator('#op-a11y-mirror [aria-label="Canvas"]')).toBeAttached();
  await expect(page.locator('#op-a11y-mirror [aria-label="Toolbar"]')).toBeAttached();
  await expect(page.locator('#op-a11y-mirror [aria-label="Layers"]')).toBeAttached();
  // The app's own boot success marker.
  await expect
    .poll(() => logs.some((line) => line.includes('op-smoke:ok')), { timeout: 30000 })
    .toBe(true);
  // The in-page error surface must stay empty on a clean boot.
  await expect(page.locator('#op-error')).toHaveText('');
  expect(errors, 'pageerror/console error').toEqual([]);
});

test('SMOKE-002 pointer interaction keeps the editor healthy', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(String(process.env.OPENPENCIL_SMOKE_EDITOR_URL), { waitUntil: 'load', timeout: 60000 });
  await expect(page.locator('canvas#op')).toBeVisible({ timeout: 30000 });

  // Exercise the editor's pointer handling: click, a drag across the canvas
  // (draw with the default tool), and a wheel zoom. None of these may crash
  // the wasm app or surface the in-page error pane.
  await page.mouse.click(640, 360);
  await page.mouse.move(500, 250);
  await page.mouse.down();
  await page.mouse.move(780, 470, { steps: 10 });
  await page.mouse.up();
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(1000);

  await expect(page.locator('canvas#op')).toBeVisible();
  await expect(page.locator('#op-error')).toHaveText('');
  expect(errors, 'pageerror/console error').toEqual([]);
});
