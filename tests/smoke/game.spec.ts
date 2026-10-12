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
  const artwork: string[] = [];
  const previewBytes: number[] = [];
  let transferred = 0;
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    transferred += Number(response.headers()['content-length'] ?? 0);
    if (path.startsWith('/art/')) artwork.push(path);
    if (path.startsWith('/art/preview-'))
      previewBytes.push(Number(response.headers()['content-length']));
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Regavo/);
  await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.lobby-art')).toHaveAttribute('data-preview', 'static');
  await page.waitForLoadState('networkidle');
  console.log(`Cold lobby: ${(transferred / 1048576).toFixed(2)} MiB of response Content-Length.`);
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
  expect(artwork.filter((path) => !/\/preview-|\/daiviet-v4-dragon-emblem-/.test(path))).toEqual(
    [],
  );
  expect(previewBytes.length).toBeGreaterThanOrEqual(18);
  expect(Math.max(...previewBytes)).toBeLessThan(2 * 1024 * 1024);
  console.log(
    `Lobby transfers: largest scene ${(Math.max(...previewBytes) / 1024).toFixed(0)} KiB; no sprite atlases downloaded.`,
  );
  expect(failures).toEqual([]);
});

test('a slow first selection cannot hold up the next civilization', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/art/preview-mongol-*', async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.locator('.lobby-empires button').nth(1).click();
    await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'true');
    await page.locator('.lobby-empires button').nth(4).click();
    await expect(page.locator('.lobby-art')).toHaveAttribute('aria-busy', 'false', {
      timeout: 3000,
    });
    await expect(page.locator('.lobby-art canvas[role="img"]')).toHaveAttribute(
      'aria-label',
      /Ottoman/i,
    );
  } finally {
    release();
  }
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
