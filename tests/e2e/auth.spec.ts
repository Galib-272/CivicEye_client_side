import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { alertWithText, fail, mockApi, ok, signedOut, user, WCAG_TAGS } from './mock-api';

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
