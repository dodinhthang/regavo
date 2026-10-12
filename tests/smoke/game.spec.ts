import { test, expect, type Page } from '@playwright/test';

function observeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== 'http://127.0.0.1:4173') return;
    const type = response.headers()['content-type'] ?? '';
    if (response.status() >= 400) failures.push(`${url.pathname}: ${response.status()}`);
    if (/\.(png|webp|ico)$/.test(url.pathname) && !type.startsWith('image/'))
      failures.push(`${url.pathname}: invalid image MIME ${type}`);
    if (/\/worker-[^/]+\.js$/.test(url.pathname) && !/(java|ecma)script/.test(type))
      failures.push(`${url.pathname}: invalid Worker MIME ${type}`);
  });
  return failures;
}

test('production lobby paints every civilization and age without missing assets', async ({
  page,
}) => {
  const failures = observeFailures(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Regavo/);
  await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('img.game-logo')).toBeVisible();
  for (const [index, civ] of [
    'roman',
    'mongol',
    'persian',
    'tang',
    'ottoman',
    'daiviet',
  ].entries()) {
    await page.locator('.lobby-empires button').nth(index).click();
    for (let age = 1; age <= 3; age++) {
      await page
        .locator('.lobby-ages button')
        .nth(age - 1)
        .click();
      await expect(page.locator('.lobby-root')).toHaveAttribute('data-civ', civ);
      await expect(page.locator('.lobby-root')).toHaveAttribute('data-age', String(age));
      await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('.lobby-art canvas[role="img"]')).toHaveAttribute(
        'aria-label',
        new RegExp(`(?:age|đời) ${age}`, 'i'),
      );
      await expect(page.locator('.lobby-preview-note,.lobby-preview-status')).toHaveCount(0);
    }
  }
  expect(failures).toEqual([]);
});

test('Dai Viet match starts, its Worker ticks and exiting restores the lobby', async ({ page }) => {
  const failures = observeFailures(page);
  await page.goto('/');
  await page.locator('.lobby-empires button').nth(5).click();
  await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.lobby-start').click();
  await expect(page.locator('.game-view')).toHaveAttribute('data-civ', 'daiviet');
  await expect(page.locator('.battle-canvas canvas')).toBeVisible();
  await expect(page.locator('.game-view .loading')).toHaveCount(0);
  await expect(page.locator('.game-bar')).toContainText(/0:0[1-9]|0:[1-5]\d/);
  await page.locator('.game-brand').click();
  await page.getByRole('button', { name: /Back to home|Về màn hình đầu/ }).click();
  await page.getByRole('button', { name: /Exit without saving|Thoát không lưu/ }).click();
  await expect(page.locator('.lobby-root')).toBeVisible();
  expect(failures).toEqual([]);
});

test('workshop survives a direct hash URL and loads civilization models', async ({ page }) => {
  const failures = observeFailures(page);
  await page.goto('/#workshop');
  await expect(page.locator('.workshop')).toBeVisible();
  await page.locator('.workshop-civs button').nth(5).click();
  await expect(page.locator('.workshop')).toHaveAttribute('data-civ', 'daiviet');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.workshop canvas').first()).toBeVisible();
  await page
    .getByRole('button', { name: /Home|Trang chủ/ })
    .first()
    .click();
  await expect(page.locator('.lobby-root')).toBeVisible();
  expect(failures).toEqual([]);
});
