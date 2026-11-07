import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, ok, user, WCAG_TAGS, type Handler } from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const SOUTH_ID = '01960000-0000-7000-8000-0000000000b2';
const PUBLIC_ID = 'CE-J91J-KA5S';
const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
};
const BASE = `/organizations/${ORG_ID}/reports`;

const signedInAs = (platformRole: 'CITIZEN' | 'SUPER_ADMIN'): Record<string, Handler> => ({
  'GET /auth/me': () =>
    ok({
      user: { ...user, platformRole },
      csrfToken: 'csrf',
      mfa: platformRole === 'SUPER_ADMIN' ? 'verified' : 'none',
    }),
  'GET /users/me/organizations': () => ok([]),
});

const overview = {
  id: ORG_ID,
  name: 'Dhaka North City Corporation',
  type: 'CITY_CORPORATION',
  description: null,
  website: null,
  publicEmail: null,
  publicPhone: null,
  officialEmailDomain: 'dncc.gov.bd',
  verificationState: 'VERIFIED',
  isActive: true,
  memberCount: 3,
  categoryIds: [CATEGORY.id],
  myRole: 'ORG_REVIEWER',
  createdAt: '2026-11-04T06:00:00.000Z',
};

const workspaceReport = (overrides: Record<string, unknown> = {}) => ({
  publicId: PUBLIC_ID,
  title: 'Deep pothole near the bus stop',
  description: 'The pothole has grown over the last week and floods when it rains.',
  category: CATEGORY,
  status: 'SUBMITTED',
  latitude: 23.86,
  longitude: 90.37,
  locationAccuracyM: 12,
  locationDescription: 'Opposite the Banani Road 11 bridge',
  visibility: 'PUBLIC',
  routing: 'ROUTED',
  organizationId: ORG_ID,
  organizationName: 'Dhaka North City Corporation',
  version: 1,
  submittedAt: '2026-11-04T06:00:00.000Z',
  updatedAt: '2026-11-04T06:00:00.000Z',
  photos: [],
  informationRequests: [],
  rejection: null,
  assignments: [],
  feedback: [],
  actions: {
    startReview: true,
    requestInformation: false,
    accept: false,
    reject: false,
    transfer: true,
    assign: false,
    reassign: false,
    cancelAssignment: false,
    verify: false,
    reopen: false,
    close: false,
    markDuplicate: false,
  },
  ...overrides,
});

const historyEntry = {
  fromStatus: null,
  toStatus: 'SUBMITTED',
  actorContext: 'citizen',
  reason: null,
  publicMessage: null,
  createdAt: '2026-11-04T06:00:00.000Z',
};

async function blockMapTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
}

test.beforeEach(async ({ page }) => blockMapTiles(page));

test.describe('organization review', () => {
  test('the review queue lists reports by tab and passes accessibility checks', async ({
    page,
  }) => {
    let requestedTab: string | null = null;
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET ${BASE}/counts`]: () =>
        ok({ NEW: 1, UNDER_REVIEW: 0, NEEDS_INFORMATION: 2, ACCEPTED: 0, CLOSED: 0 }),
      [`GET ${BASE}`]: (route) => {
        requestedTab = new URL(route.request().url()).searchParams.get('tab');
        return ok([
          {
            publicId: PUBLIC_ID,
            title: 'Deep pothole near the bus stop',
            category: CATEGORY,
            status: 'SUBMITTED',
            locationDescription: null,
            photoCount: 2,
            submittedAt: '2026-11-04T06:00:00.000Z',
            updatedAt: '2026-11-04T06:00:00.000Z',
          },
        ]);
      },
    });
    await page.goto(`/en${BASE}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Reports to review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New (1)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Deep pothole near the bus stop' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Waiting for citizen (2)' }).click();
    await expect.poll(() => requestedTab).toBe('NEEDS_INFORMATION');
  });

  test('non-reviewers see a not-found message', async ({ page }) => {
    await mockApi(page, signedInAs('CITIZEN'));
    await page.goto(`/en${BASE}`);
    await expect(page.getByText(/not found/i)).toBeVisible();
  });

  test('a reviewer starts the review, asks for information and adds a note', async ({ page }) => {
    let current = workspaceReport();
    const ifMatch: string[] = [];
    let question: unknown;
    const notes: unknown[] = [];
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET /organizations/${ORG_ID}/overview`]: () => ok(overview),
      'GET /categories': () => ok([]),
      [`GET ${BASE}/${PUBLIC_ID}`]: () => ok(current),
      [`GET ${BASE}/${PUBLIC_ID}/history`]: () => ok([historyEntry]),
      [`GET ${BASE}/${PUBLIC_ID}/notes`]: () => ok(notes),
      [`GET ${BASE}/${PUBLIC_ID}/updates`]: () => ok([]),
      [`GET ${BASE}/${PUBLIC_ID}/transfer-targets`]: () => ok([]),
      [`POST ${BASE}/${PUBLIC_ID}/start-review`]: (route) => {
        ifMatch.push(route.request().headers()['if-match'] ?? '');
        current = workspaceReport({
          status: 'UNDER_REVIEW',
          version: 2,
          actions: {
            startReview: false,
            requestInformation: true,
            accept: true,
            reject: true,
            transfer: true,
            assign: false,
            reassign: false,
            cancelAssignment: false,
            verify: false,
            reopen: false,
            close: false,
            markDuplicate: false,
          },
        });
        return ok(current);
      },
      [`POST ${BASE}/${PUBLIC_ID}/request-information`]: (route) => {
        ifMatch.push(route.request().headers()['if-match'] ?? '');
        question = route.request().postDataJSON();
        current = workspaceReport({
          status: 'NEEDS_INFORMATION',
          version: 3,
          informationRequests: [
            {
              id: '01960000-0000-7000-8000-0000000000f9',
              message: 'Please add a photo showing how wide it is.',
              requestedAt: '2026-11-05T06:00:00.000Z',
              response: null,
            },
          ],
          actions: {
            startReview: false,
            requestInformation: false,
            accept: false,
            reject: false,
            transfer: true,
            assign: false,
            reassign: false,
            cancelAssignment: false,
            verify: false,
            reopen: false,
            close: false,
            markDuplicate: false,
          },
        });
        return ok(current);
      },
      [`POST ${BASE}/${PUBLIC_ID}/notes`]: (route) => {
        const { body } = route.request().postDataJSON() as { body: string };
        notes.push({
          id: '01960000-0000-7000-8000-0000000000e9',
          body,
          authorName: 'Karim Reviewer',
          organizationName: 'Dhaka North City Corporation',
          createdAt: '2026-11-05T07:00:00.000Z',
        });
        return ok(notes, 201);
      },
    });

    await page.goto(`/en${BASE}/${PUBLIC_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: current.title })).toBeVisible();
    await expect(page.getByText('The reporter is not shown.')).toBeVisible();
    await expect(page.getByText(user.email)).toHaveCount(0);

    await page.getByRole('button', { name: 'Start review' }).click();
    await page.getByText('Ask for more information').click();
    await page
      .getByLabel('Question for the citizen')
      .fill('Please add a photo showing how wide it is.');
    await page.getByRole('button', { name: 'Send question' }).click();
    await expect(page.getByText("Waiting for the citizen's answer.")).toBeVisible();
    expect(ifMatch).toEqual(['1', '2']);
    expect(question).toEqual({ message: 'Please add a photo showing how wide it is.' });

    await page.getByLabel('New note').fill('Third report on this road this month.');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByText('Third report on this road this month.')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('a reviewer transfers a report and loses access to it', async ({ page }) => {
    let transfer: unknown;
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET /organizations/${ORG_ID}/overview`]: () => ok(overview),
      'GET /categories': () => ok([]),
      [`GET ${BASE}/${PUBLIC_ID}`]: () => ok(workspaceReport()),
      [`GET ${BASE}/${PUBLIC_ID}/history`]: () => ok([historyEntry]),
      [`GET ${BASE}/${PUBLIC_ID}/notes`]: () => ok([]),
      [`GET ${BASE}/${PUBLIC_ID}/updates`]: () => ok([]),
      [`GET ${BASE}/${PUBLIC_ID}/transfer-targets`]: () =>
        ok([{ id: SOUTH_ID, name: 'Dhaka South City Corporation' }]),
      [`POST ${BASE}/${PUBLIC_ID}/transfer`]: (route) => {
        transfer = route.request().postDataJSON();
        return ok({ transferred: true });
      },
    });
    await page.goto(`/en${BASE}/${PUBLIC_ID}`);
    await page.getByText('Transfer', { exact: true }).click();
    await page.getByLabel('Send to').selectOption({ label: 'Dhaka South City Corporation' });
    await page.getByLabel('Reason for the transfer').fill('The road is in the southern ward.');
    await page.getByRole('button', { name: 'Transfer report' }).click();
    await expect(page.getByText('Your organization no longer has access to it.')).toBeVisible();
    expect(transfer).toEqual({
      toOrganizationId: SOUTH_ID,
      reason: 'The road is in the southern ward.',
    });
  });
});

test.describe('citizen side of review', () => {
  const ownReport = {
    publicId: PUBLIC_ID,
    title: 'Deep pothole near the bus stop',
    description: 'The pothole has grown over the last week and floods when it rains.',
    category: CATEGORY,
    status: 'NEEDS_INFORMATION',
    latitude: 23.86,
    longitude: 90.37,
    locationDescription: null,
    organizationName: 'Dhaka North City Corporation',
    photoCount: 1,
    submittedAt: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-05T06:00:00.000Z',
    visibility: 'PUBLIC',
    locationAccuracyM: null,
    routing: 'ROUTED',
    version: 3,
    canEdit: false,
    canWithdraw: true,
    canProvideInformation: true,
    informationRequest: {
      message: 'Please add a photo showing how wide it is.',
      requestedAt: '2026-11-05T06:00:00.000Z',
    },
    rejection: null,
    photos: [],
    completion: null,
    canGiveFeedback: false,
    duplicateOf: null,
    feedback: null,
  };

  test('the citizen answers an information request', async ({ page }) => {
    let answer: unknown;
    let current: Record<string, unknown> = ownReport;
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET /reports/${PUBLIC_ID}`]: () => ok(current),
      [`GET /reports/${PUBLIC_ID}/history`]: () => ok([]),
      [`GET /reports/${PUBLIC_ID}/updates`]: () =>
        ok([
          {
            id: '01960000-0000-7000-8000-0000000000d7',
            organizationName: 'Dhaka North City Corporation',
            body: 'Inspection planned for Thursday.',
            createdAt: '2026-11-05T08:00:00.000Z',
          },
        ]),
      [`POST /reports/${PUBLIC_ID}/additional-information`]: (route) => {
        answer = route.request().postDataJSON();
        current = {
          ...ownReport,
          status: 'UNDER_REVIEW',
          canProvideInformation: false,
          informationRequest: null,
        };
        return ok(current);
      },
    });
    await page.goto(`/en/reports/${PUBLIC_ID}`);
    await expect(page.getByRole('heading', { name: 'More information needed' })).toBeVisible();
    await expect(page.getByText('Please add a photo showing how wide it is.')).toBeVisible();
    await expect(page.getByText('Inspection planned for Thursday.')).toBeVisible();

    await page.getByLabel('Your answer').fill('It is about one metre wide.');
    await page.getByRole('button', { name: 'Send answer' }).click();
    await expect(page.getByText('Your answer was sent to the organization.')).toBeVisible();
    expect(answer).toEqual({ message: 'It is about one metre wide.', mediaIds: [] });
  });

  test('a rejected report shows the reason', async ({ page }) => {
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET /reports/${PUBLIC_ID}`]: () =>
        ok({
          ...ownReport,
          status: 'REJECTED',
          canWithdraw: false,
          canProvideInformation: false,
          informationRequest: null,
          rejection: {
            reason: 'ALREADY_FIXED',
            message: 'The pothole was filled last week.',
          },
        }),
      [`GET /reports/${PUBLIC_ID}/history`]: () => ok([]),
      [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
    });
    await page.goto(`/en/reports/${PUBLIC_ID}`);
    await expect(page.getByText('Reason: Already fixed')).toBeVisible();
    await expect(page.getByText('The pothole was filled last week.')).toBeVisible();
  });
});

test('a Super Admin can view any report and hide an update', async ({ page }) => {
  let hidden: unknown;
  let updates = [
    {
      id: '01960000-0000-7000-8000-0000000000d8',
      body: 'Abusive text posted by mistake.',
      authorName: 'Karim Reviewer',
      organizationName: 'Dhaka North City Corporation',
      createdAt: '2026-11-05T08:00:00.000Z',
      hidden: false,
      hiddenReason: null as string | null,
    },
  ];
  await mockApi(page, {
    ...signedInAs('SUPER_ADMIN'),
    [`GET /admin/reports/${PUBLIC_ID}`]: () =>
      ok(
        workspaceReport({
          actions: {
            startReview: false,
            requestInformation: false,
            accept: false,
            reject: false,
            transfer: false,
            assign: false,
            reassign: false,
            cancelAssignment: false,
            verify: false,
            reopen: false,
            close: false,
            markDuplicate: false,
          },
        }),
      ),
    [`GET /admin/reports/${PUBLIC_ID}/history`]: () => ok([historyEntry]),
    [`GET /admin/reports/${PUBLIC_ID}/notes`]: () => ok([]),
    [`GET /admin/reports/${PUBLIC_ID}/updates`]: () => ok(updates),
    [`POST /admin/reports/updates/${updates[0]?.id}/hide`]: (route) => {
      hidden = route.request().postDataJSON();
      updates = updates.map((update) => ({
        ...update,
        hidden: true,
        hiddenReason: 'Abusive language.',
      }));
      return ok({ hidden: true });
    },
  });
  await page.goto(`/en/admin/reports/${PUBLIC_ID}`);
  await expect(page.getByText('Each view is recorded in the audit log.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start review' })).toHaveCount(0);

  await page.getByText('Hide update').click();
  await page.getByLabel('Why hide this update?').fill('Abusive language.');
  await page.getByRole('button', { name: 'Hide this update' }).click();
  await expect(page.getByText('Hidden by an administrator: Abusive language.')).toBeVisible();
  expect(hidden).toEqual({ reason: 'Abusive language.' });
});
