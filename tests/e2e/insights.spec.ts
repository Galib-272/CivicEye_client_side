import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, ok, user, WCAG_TAGS, type Handler } from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const CASE_ID = '01960000-0000-7000-8000-0000000000f1';
const PUBLIC_ID = 'CE-J91J-KA5S';
const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
};

const signedInAs = (platformRole: 'CITIZEN' | 'SUPER_ADMIN'): Record<string, Handler> => ({
  'GET /auth/me': () =>
    ok({
      user: { ...user, platformRole },
      csrfToken: 'csrf',
      mfa: platformRole === 'SUPER_ADMIN' ? 'verified' : 'none',
    }),
  'GET /users/me/organizations': () => ok([]),
  'GET /work/memberships': () => ok([]),
});

const duration = (count: number, median: number) => ({
  count,
  medianHours: count ? median : null,
  p90Hours: count ? median * 2 : null,
  meanHours: count ? median * 1.2 : null,
  enoughData: count >= 5,
});

const weeks = Array.from({ length: 12 }, (_, i) => ({
  weekStart: new Date(Date.UTC(2026, 7, 17 + i * 7)).toISOString().slice(0, 10),
  received: i % 4,
  resolved: i % 3,
  submitted: i % 5,
  newUsers: i % 2,
}));

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
});

test('a citizen sees their own dashboard', async ({ page }) => {
  await mockApi(page, {
    ...signedInAs('CITIZEN'),
    'GET /users/me/dashboard': () =>
      ok({
        total: 4,
        open: 2,
        resolved: 1,
        byStatus: { SUBMITTED: 2, RESOLVED: 1, REJECTED: 1 },
        unreadNotifications: 3,
        recentActivity: [
          {
            reportPublicId: PUBLIC_ID,
            reportTitle: 'Deep pothole near the bus stop',
            status: 'RESOLVED',
            at: '2026-11-07T06:00:00.000Z',
          },
        ],
      }),
  });
  await page.goto('/en/dashboard');
  await expect(page.getByRole('heading', { name: 'My dashboard' })).toBeVisible();
  const reports = page.getByRole('region', { name: 'My reports' });
  await expect(reports.getByText('Unread notifications')).toBeVisible();
  await expect(reports.getByRole('link', { name: 'Deep pothole near the bus stop' })).toBeVisible();
  // No worker section for someone who is not a worker.
  await expect(page.getByRole('region', { name: 'My tasks' })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('an organization dashboard flags thin data and refetches for a new range', async ({
  page,
}) => {
  const queries: string[] = [];
  await mockApi(page, {
    ...signedInAs('CITIZEN'),
    [`GET /organizations/${ORG_ID}/analytics`]: (route) => {
      queries.push(new URL(route.request().url()).search);
      return ok({
        range: { from: '2026-10-10', to: '2026-11-08' },
        backlog: {
          awaitingReview: 4,
          waitingForCitizen: 1,
          accepted: 2,
          inProgress: 3,
          awaitingVerification: 1,
          byStatus: { SUBMITTED: 4, ASSIGNED: 3 },
        },
        volume: { received: 12, accepted: 8, rejected: 2, resolved: 6 },
        times: {
          review: duration(10, 5.5),
          resolution: duration(3, 40),
          assignment: duration(0, 0),
          completion: duration(6, 3),
        },
        workers: [
          {
            userId: '01960000-0000-7000-8000-0000000000a9',
            name: 'Jamal Uddin',
            available: false,
            pending: 1,
            active: 2,
            awaitingVerification: 0,
            verifiedInRange: 4,
          },
        ],
        categories: [{ ...CATEGORY, count: 12 }],
        areas: [
          { id: '01960000-0000-7000-8000-0000000000a1', name: 'Ward 1', count: 10 },
          { id: null, name: 'outside', count: 2 },
        ],
        trend: weeks,
      });
    },
  });
  await page.goto(`/en/organizations/${ORG_ID}/analytics`);
  await expect(page.getByRole('heading', { name: 'Organization dashboard' })).toBeVisible();
  await expect(page.getByText('Too few cases to judge performance.')).toHaveCount(1);
  await expect(page.getByText('No cases yet.')).toBeVisible();
  await expect(page.getByText('Outside your areas')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /Jamal Uddin/ })).toContainText('unavailable');

  await page.getByLabel('From', { exact: true }).fill('2026-09-01');
  await page.getByLabel('To', { exact: true }).fill('2026-09-30');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect.poll(() => queries.at(-1)).toBe('?from=2026-09-01&to=2026-09-30');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

const caseDetail = (overrides: Record<string, unknown> = {}) => ({
  id: CASE_ID,
  targetType: 'REPORT',
  status: 'OPEN',
  flagCount: 2,
  escalated: true,
  reasons: ['PERSONAL_INFORMATION'],
  createdAt: '2026-11-07T06:00:00.000Z',
  updatedAt: '2026-11-07T06:00:00.000Z',
  closedAt: null,
  report: {
    publicId: PUBLIC_ID,
    title: 'Deep pothole near the bus stop',
    description: 'Faces of children are visible in the photo.',
    status: 'SUBMITTED',
    visibility: 'PUBLIC',
    hiddenFromPublic: false,
    organizationName: 'Dhaka North City Corporation',
    citizen: { id: user.id, name: 'Rahima Akter', status: 'ACTIVE' },
  },
  publicUpdate: null,
  flags: [
    {
      reason: 'PERSONAL_INFORMATION',
      details: 'Children’s faces are visible.',
      source: 'user',
      reporterName: 'Karim',
      organizationName: null,
      createdAt: '2026-11-07T06:00:00.000Z',
    },
  ],
  actions: [],
  allowedActions: [
    'START_REVIEW',
    'HIDE_REPORT',
    'REQUEST_CORRECTION',
    'WARN_USER',
    'SUSPEND_USER',
    'RESOLVE',
    'DISMISS',
  ],
  ...overrides,
});

test('a Super Admin works through the moderation queue', async ({ page }) => {
  const decisions: unknown[] = [];
  await mockApi(page, {
    ...signedInAs('SUPER_ADMIN'),
    'GET /admin/moderation/cases': () =>
      ok([
        {
          id: CASE_ID,
          targetType: 'REPORT',
          status: 'OPEN',
          flagCount: 2,
          escalated: true,
          reasons: ['PERSONAL_INFORMATION'],
          report: { publicId: PUBLIC_ID, title: 'Deep pothole near the bus stop' },
          createdAt: '2026-11-07T06:00:00.000Z',
          updatedAt: '2026-11-07T06:00:00.000Z',
        },
      ]),
    [`GET /admin/moderation/cases/${CASE_ID}`]: () => ok(caseDetail()),
    [`POST /admin/moderation/cases/${CASE_ID}/actions`]: (route) => {
      const body = route.request().postDataJSON() as { kind: string; reason: string };
      decisions.push(body);
      return ok(
        caseDetail({
          status: 'UNDER_REVIEW',
          report: { ...caseDetail().report, hiddenFromPublic: true },
          actions: [
            {
              ...body,
              message: null,
              actorName: 'Super Admin',
              createdAt: '2026-11-07T07:00:00.000Z',
            },
          ],
          allowedActions: [
            'RESTORE_REPORT',
            'REQUEST_CORRECTION',
            'WARN_USER',
            'SUSPEND_USER',
            'RESOLVE',
            'DISMISS',
          ],
        }),
      );
    },
  });
  await page.goto('/en/admin/moderation');
  await expect(page.getByText('Escalated by an organization')).toBeVisible();
  await page.getByRole('link', { name: `${PUBLIC_ID} · Deep pothole near the bus stop` }).click();

  await expect(page.getByRole('heading', { name: `Case: ${PUBLIC_ID}` })).toBeVisible();
  await expect(page.getByText('Children’s faces are visible.')).toBeVisible();

  await page
    .getByLabel('Decision', { exact: true })
    .selectOption({ label: "Suspend the citizen's account" });
  await expect(
    page.getByText('Flags or the AI alone are never enough.', { exact: false }),
  ).toBeVisible();

  await page.getByLabel('Decision', { exact: true }).selectOption({ label: 'Warn the citizen' });
  await expect(page.getByLabel('Message to the citizen')).toBeVisible();

  await page
    .getByLabel('Decision', { exact: true })
    .selectOption({ label: 'Hide the report from the public' });
  await expect(page.getByLabel('Message to the citizen')).toHaveCount(0);
  await page
    .getByLabel('Reason (recorded, not shown to the citizen)')
    .fill('Children’s faces are visible.');
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(page.getByText('Done.')).toBeVisible();
  await expect(page.getByText('Hidden from the public').first()).toBeVisible();
  expect(decisions).toEqual([{ kind: 'HIDE_REPORT', reason: 'Children’s faces are visible.' }]);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

const publicReport = {
  publicId: PUBLIC_ID,
  title: 'Deep pothole near the bus stop',
  description: 'The pothole has grown over the last week.',
  category: CATEGORY,
  status: 'SUBMITTED',
  latitude: 23.794,
  longitude: 90.407,
  locationDescription: null,
  organizationName: null,
  photoCount: 1,
  submittedAt: '2026-11-04T06:00:00.000Z',
  updatedAt: '2026-11-04T06:00:00.000Z',
};

async function reportPage(page: Page, report: unknown, extra: Record<string, Handler> = {}) {
  await mockApi(page, {
    ...signedInAs('CITIZEN'),
    [`GET /reports/${PUBLIC_ID}`]: () => ok(report),
    [`GET /reports/${PUBLIC_ID}/history`]: () => ok([]),
    [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
    ...extra,
  });
  await page.goto(`/en/reports/${PUBLIC_ID}`);
}

test('a signed-in visitor reports a problem with a public report', async ({ page }) => {
  let flag: unknown;
  await reportPage(page, publicReport, {
    [`POST /reports/${PUBLIC_ID}/flags`]: (route) => {
      flag = route.request().postDataJSON();
      return ok({ received: true }, 201);
    },
  });
  await page.getByText('Report a problem with this report').click();
  await page.getByLabel('What is wrong?').selectOption({ label: 'Something else' });
  await page.getByLabel('Details', { exact: true }).fill('This photo is from a different city.');
  await page.getByRole('button', { name: 'Send to moderators' }).click();
  await expect(page.getByText('Thank you. A moderator will look at it.')).toBeVisible();
  expect(flag).toEqual({ reason: 'OTHER', details: 'This photo is from a different city.' });
});

test('the citizen sees why their report was hidden and what to correct', async ({ page }) => {
  await reportPage(page, {
    ...publicReport,
    visibility: 'PUBLIC',
    locationAccuracyM: null,
    routing: 'UNROUTED',
    version: 1,
    canEdit: false,
    canWithdraw: true,
    canProvideInformation: false,
    informationRequest: null,
    rejection: null,
    photos: [],
    completion: null,
    canGiveFeedback: false,
    duplicateOf: null,
    feedback: null,
    moderation: {
      hiddenFromPublic: true,
      notices: [
        {
          kind: 'REQUEST_CORRECTION',
          message: 'Please submit again with a photo that does not show faces.',
          createdAt: '2026-11-07T07:00:00.000Z',
        },
        { kind: 'HIDE_REPORT', message: null, createdAt: '2026-11-07T06:59:00.000Z' },
      ],
    },
  });
  await expect(
    page.getByText('A moderator has hidden this report from the public.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText('Please submit again with a photo that does not show faces.'),
  ).toBeVisible();
  // Nobody flags their own report.
  await expect(page.getByText('Report a problem with this report')).toHaveCount(0);
});

test('a Super Admin filters the audit log', async ({ page }) => {
  const queries: string[] = [];
  await mockApi(page, {
    ...signedInAs('SUPER_ADMIN'),
    'GET /admin/audit/actions': () => ok(['moderation.hide_report', 'report.submitted']),
    'GET /admin/audit': (route) => {
      queries.push(new URL(route.request().url()).search);
      return ok([
        {
          id: '01960000-0000-7000-8000-0000000000e9',
          action: 'moderation.hide_report',
          result: 'SUCCESS',
          actor: { id: user.id, name: 'Super Admin', email: 'root@civiceye.test' },
          targetType: 'moderation_case',
          targetId: CASE_ID,
          reason: 'Faces are visible.',
          metadata: { reportId: 'x' },
          ipAddress: '127.0.0.1',
          requestId: 'req-1',
          createdAt: '2026-11-07T07:00:00.000Z',
        },
      ]);
    },
  });
  await page.goto('/en/admin/audit');
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await expect(page.getByText('Reason: Faces are visible.')).toBeVisible();
  await page.getByLabel('Action').selectOption('moderation.hide_report');
  await expect.poll(() => queries.at(-1)).toContain('action=moderation.hide_report');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the platform dashboard is in Bangla too', async ({ page }) => {
  await mockApi(page, {
    ...signedInAs('SUPER_ADMIN'),
    'GET /admin/analytics': () =>
      ok({
        range: { from: '2026-10-10', to: '2026-11-08' },
        users: { total: 120, byStatus: { ACTIVE: 118, SUSPENDED: 2 }, newInRange: 14 },
        organizations: { total: 5, active: 5, verified: 4 },
        reports: {
          total: 300,
          submittedInRange: 40,
          inTriage: 3,
          byStatus: { SUBMITTED: 10, RESOLVED: 200 },
          byCategory: [{ ...CATEGORY, count: 25 }],
        },
        organizationPerformance: [
          {
            organizationId: ORG_ID,
            name: 'Dhaka North City Corporation',
            received: 30,
            resolved: 12,
            backlog: 9,
            resolution: duration(12, 52.5),
          },
        ],
        geography: [
          { id: ORG_ID, name: 'Dhaka North City Corporation', count: 30 },
          { id: null, name: 'none', count: 3 },
        ],
        activity: weeks,
        moderation: { byStatus: { OPEN: 2, RESOLVED: 5 }, flagsInRange: 9 },
      }),
  });
  await page.goto('/bn/admin/analytics');
  await expect(page.getByRole('heading', { name: 'প্ল্যাটফর্ম ড্যাশবোর্ড' })).toBeVisible();
  await expect(page.getByText('কোনো প্রতিষ্ঠানের আওতায় নেই')).toBeVisible();
  await expect(
    page
      .getByRole('link', { name: 'মডারেশন (২টি চলমান)' })
      .or(page.getByRole('link', { name: 'মডারেশন (2টি চলমান)' })),
  ).toBeVisible();
});
