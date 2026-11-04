import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * The client repository has no backend in CI, so these tests answer API calls in the browser
 * with the documented response envelopes. Real end-to-end behaviour (sessions, emails,
 * permissions) is covered by the server repository's integration tests.
 */

const API = 'http://127.0.0.1:4999/api/v1';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Handler = (route: Route) => { status: number; body: unknown } | undefined;

const user = {
  id: '01960000-0000-7000-8000-000000000001',
  email: 'rahima@example.test',
  name: 'Rahima Akter',
  status: 'ACTIVE',
  platformRole: 'CITIZEN',
  preferredLocale: 'en',
  emailVerified: true,
};

function ok(data: unknown, status = 200) {
  return { status, body: { success: true, data, meta: { requestId: 'req-e2e' } } };
}

function fail(status: number, code: string, details: unknown[] = []) {
  return {
    status,
    body: { success: false, error: { code, message: code, details, requestId: 'req-e2e' } },
  };
}

/** Routes API calls to handlers keyed by "METHOD /path". Unhandled calls get 404. */
async function mockApi(page: Page, handlers: Record<string, Handler>) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const cors = {
      'access-control-allow-origin': 'http://localhost:3100',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, x-csrf-token, accept',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const key = `${request.method()} ${new URL(request.url()).pathname.replace('/api/v1', '')}`;
    const result = handlers[key]?.(route) ?? fail(404, 'NOT_FOUND');
    await route.fulfill({
      status: result.status,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(result.body),
    });
  });
}

/** Next.js renders its own (empty) route-announcer alert, so match our alerts by text. */
function alertWithText(page: Page, text: string) {
  return page.getByRole('alert').filter({ hasText: text });
}

const signedOut: Record<string, Handler> = { 'GET /auth/me': () => fail(401, 'UNAUTHENTICATED') };

test.describe('authentication pages', () => {
  test('signed-out visitors are sent from the account page to sign-in', async ({ page }) => {
    await mockApi(page, signedOut);
    await page.goto('/en/account');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Faccount$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('shows a translated error for wrong credentials', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      'POST /auth/login': () => fail(401, 'INVALID_CREDENTIALS'),
    });
    await page.goto('/bn/sign-in');
    await page.getByLabel('ইমেইল ঠিকানা').fill('rahima@example.test');
    await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill('wrong password here');
    await page.getByRole('button', { name: 'সাইন ইন' }).click();
    await expect(alertWithText(page, 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।')).toBeVisible();
  });

  test('validates fields before calling the API', async ({ page }) => {
    let called = false;
    await mockApi(page, {
      ...signedOut,
      'POST /auth/login': () => {
        called = true;
        return fail(500, 'INTERNAL_ERROR');
      },
    });
    await page.goto('/en/sign-in');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
  });

  test('sends users with two-factor enabled to the code challenge', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      'POST /auth/login': () => ok({ user, csrfToken: 'csrf', mfa: 'pending' }),
    });
    await page.goto('/en/sign-in');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/two-factor$/);
  });

  test('shows password policy errors from the server next to the field', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      'POST /auth/register': () =>
        fail(400, 'VALIDATION_ERROR', [
          { field: 'password', code: 'PASSWORD_TOO_COMMON', message: 'x' },
        ]),
    });
    await page.goto('/en/register');
    await page.getByLabel('Full name').fill('Rahima Akter');
    await page.getByLabel('Email address').fill('rahima@example.test');
    await page.getByLabel('Password', { exact: true }).fill('password1234');
    await page.getByLabel('Repeat password').fill('password1234');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This password is too common or easy to guess.')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  });

  test('confirms registration without revealing whether the email exists', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      'POST /auth/register': () => ok({ accepted: true }, 202),
    });
    await page.goto('/en/register');
    await page.getByLabel('Full name').fill('Rahima Akter');
    await page.getByLabel('Email address').fill('rahima@example.test');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple');
    await page.getByLabel('Repeat password').fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('status')).toContainText('If this email address can be used');
  });

  test('verifies the email and removes the token from the address bar', async ({ page }) => {
    let sentToken: unknown;
    await mockApi(page, {
      ...signedOut,
      'POST /auth/verify-email': (route) => {
        sentToken = (route.request().postDataJSON() as { token: string }).token;
        return ok({ accepted: true });
      },
    });
    await page.goto('/en/verify-email#token=abcdefghijklmnopqrstuvwxyz0123');
    await expect(page.getByRole('status')).toHaveText('Your email address is verified.');
    expect(sentToken).toBe('abcdefghijklmnopqrstuvwxyz0123');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('explains an incomplete reset link', async ({ page }) => {
    await mockApi(page, signedOut);
    await page.goto('/en/reset-password');
    await expect(alertWithText(page, 'This link is incomplete.')).toBeVisible();
  });

  test('shows account settings to a signed-in user', async ({ page }) => {
    await mockApi(page, {
      'GET /auth/me': () =>
        ok({ user: { ...user, emailVerified: false }, csrfToken: 'c', mfa: 'none' }),
      'GET /auth/mfa': () => ok({ enabled: false, required: false, backupCodesRemaining: 0 }),
      'GET /auth/sessions': () =>
        ok([
          {
            id: '01960000-0000-7000-8000-0000000000a1',
            current: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/150.0 Safari/537.36',
            createdAt: '2026-11-04T06:00:00.000Z',
            lastSeenAt: '2026-11-04T06:10:00.000Z',
          },
        ]),
    });
    await page.goto('/en/account');
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    await expect(page.getByText('Your email address is not verified yet.')).toBeVisible();
    await expect(page.getByText('Chrome · macOS — This device')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Set up two-factor authentication' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Account' }).getByRole('button', { name: 'Sign out' }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const path of [
    '/en/sign-in',
    '/bn/sign-in',
    '/en/register',
    '/bn/register',
    '/en/forgot-password',
  ]) {
    test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
      await mockApi(page, signedOut);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
