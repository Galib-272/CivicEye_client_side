import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, ok, user, WCAG_TAGS, type Handler } from './mock-api';

const PUBLIC_ID = 'CE-J91J-KA5S';
const NOTIFICATION_ID = '01960000-0000-7000-8000-000000000a51';

const signedIn = (
  platformRole: 'CITIZEN' | 'SUPER_ADMIN' = 'CITIZEN',
): Record<string, Handler> => ({
  'GET /auth/me': () =>
    ok({
      user: { ...user, platformRole },
      csrfToken: 'csrf',
      mfa: platformRole === 'SUPER_ADMIN' ? 'verified' : 'none',
    }),
  'GET /users/me/organizations': () => ok([]),
  'GET /work/memberships': () => ok([]),
});

test('the bell shows unread notifications and opening one marks it read', async ({ page }) => {
  let unread = 1;
  let marked: string | undefined;
  let allRead = false;
  const item = () => ({
    id: NOTIFICATION_ID,
    type: 'REPORT_ACCEPTED',
    reportPublicId: PUBLIC_ID,
    organizationId: null,
    assignmentId: null,
    path: `/reports/${PUBLIC_ID}`,
    read: unread === 0,
    createdAt: '2026-11-06T09:00:00.000Z',
  });
  await mockApi(page, {
    ...signedIn(),
    'GET /notifications/unread-count': () => ok({ count: unread }),
    'GET /notifications': () => ok([item()]),
    [`PATCH /notifications/${NOTIFICATION_ID}/read`]: () => {
      marked = NOTIFICATION_ID;
      unread = 0;
      return ok({ count: 0 });
    },
    'POST /notifications/read-all': () => {
      allRead = true;
      unread = 0;
      return ok({ count: 0 });
    },
    [`GET /reports/${PUBLIC_ID}`]: () => ok({ message: 'not needed' }),
  });

  await page.goto('/en/notifications');
  await expect(page.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible();
  await expect(page.getByText('Your report was accepted.')).toBeVisible();
  await expect(page.getByText(`Report ${PUBLIC_ID}`)).toBeVisible();
  await expect(page.getByText('Unread', { exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect.poll(() => allRead).toBe(true);
  await expect(page.getByRole('link', { name: 'Notifications, none unread' })).toBeVisible();

  unread = 1;
  await page.reload();
  await page.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/reports/${PUBLIC_ID}$`));
  expect(marked).toBe(NOTIFICATION_ID);
});

test('email choices can be changed on the account page', async ({ page }) => {
  let saved: unknown;
  await mockApi(page, {
    ...signedIn(),
    'GET /notifications/unread-count': () => ok({ count: 0 }),
    'GET /auth/mfa': () => ok({ enabled: false, required: false, backupCodesRemaining: 0 }),
    'GET /auth/sessions': () => ok([]),
    'GET /notifications/preferences': () =>
      ok({ emailMyReports: true, emailMyTasks: true, emailOrganization: true }),
    'PUT /notifications/preferences': (route) => {
      saved = route.request().postDataJSON();
      return ok(saved);
    },
  });
  await page.goto('/en/account');
  await page.getByLabel('Updates on my reports').uncheck();
  await expect
    .poll(() => saved)
    .toEqual({
      emailMyReports: false,
      emailMyTasks: true,
      emailOrganization: true,
    });
  await expect(page.getByText('Saved.')).toBeVisible();
});

test('Super Admins see failed deliveries and can retry them', async ({ page }) => {
  let retried: string | undefined;
  const EVENT_ID = '01960000-0000-7000-8000-000000000e01';
  await mockApi(page, {
    ...signedIn('SUPER_ADMIN'),
    'GET /notifications/unread-count': () => ok({ count: 0 }),
    'GET /admin/delivery-health': () =>
      ok({
        pendingEvents: 2,
        failedEvents: [
          {
            id: EVENT_ID,
            type: 'report.status_changed',
            attempts: 8,
            lastError: 'Database timeout',
            createdAt: '2026-11-06T09:00:00.000Z',
          },
        ],
        failedEmails: [],
      }),
    [`POST /admin/delivery-health/events/${EVENT_ID}/retry`]: () => {
      retried = EVENT_ID;
      return ok({ queued: true });
    },
  });
  await page.goto('/en/admin/delivery-health');
  await expect(page.getByRole('heading', { level: 1, name: 'Delivery health' })).toBeVisible();
  await expect(page.getByText('2 events waiting')).toBeVisible();
  await expect(page.getByText('Last error: Database timeout')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => retried).toBe(EVENT_ID);
});
