import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

for (const [country, language] of [
  ['VN', 'vi'],
  ['CN', 'zh-CN'],
  ['FR', 'en'],
  ['', 'en'],
] as const) {
  test(`country ${country || 'unavailable'} selects ${language} with an English browser`, async ({
    page,
  }) => {
    await page.route('http://127.0.0.1:4173/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        '<html lang="vi">',
        `<html lang="vi" data-cf-country="${country}">`,
      );
      await route.fulfill({ response, body });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('.lobby-root')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('regavo-language'))).toBeNull();
    if (country === 'VN') {
      await page.locator('.language-select [role="combobox"]').click();
      await page.getByRole('option', { name: 'English' }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('html')).toHaveAttribute('data-cf-country', 'VN');
      expect(await page.evaluate(() => localStorage.getItem('regavo-language'))).toBe('en');
    }
  });
}
