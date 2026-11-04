import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('landing page', () => {
  for (const { locale, heading } of [
    { locale: 'en', heading: /Report civic problems/ },
    { locale: 'bn', heading: /নাগরিক সমস্যার কথা জানান/ },
  ]) {
    test(`renders in ${locale} with the correct document language`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    });

    test(`has no detectable WCAG A/AA violations in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('redirects the root URL to a supported locale', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(en|bn)$/);
  });

  test('switches language from the header', async ({ page }) => {
    await page.goto('/en');
    await page
      .getByRole('navigation', { name: 'Language' })
      .getByRole('link', { name: 'বাংলা' })
      .click();
    await expect(page).toHaveURL(/\/bn$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  });

  test('offers a skip link as the first focusable element', async ({ page }) => {
    await page.goto('/en');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('sends baseline security headers', async ({ request }) => {
    const response = await request.get('/en');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});

test.describe('system status page', () => {
  test('reports the API as unreachable when it is not running', async ({ page }) => {
    await page.goto('/en/system-status');
    await expect(page.getByRole('heading', { level: 1, name: 'System status' })).toBeVisible();
    // Next.js renders its own (empty) route-announcer alert, so match ours by text.
    await expect(
      page.getByRole('alert').filter({ hasText: 'The API could not be reached.' }),
    ).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});

test('unknown pages show a localized not-found page', async ({ page }) => {
  const response = await page.goto('/en/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
