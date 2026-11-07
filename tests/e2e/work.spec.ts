import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, ok, user, WCAG_TAGS, type Handler } from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const ASSIGNMENT_ID = '01960000-0000-7000-8000-0000000000a1';
const WORKER_ID = '01960000-0000-7000-8000-0000000000e1';
const MEDIA_ID = '01960000-0000-7000-8000-0000000000f1';
const PUBLIC_ID = 'CE-J91J-KA5S';
const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
};
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const signedIn: Record<string, Handler> = {
  'GET /auth/me': () => ok({ user, csrfToken: 'csrf', mfa: 'none' }),
  'GET /users/me/organizations': () => ok([]),
  'GET /work/memberships': () =>
    ok([
      { organizationId: ORG_ID, organizationName: 'Dhaka North City Corporation', available: true },
    ]),
};

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: ASSIGNMENT_ID,
  workerId: WORKER_ID,
  workerName: 'Jamal Worker',
  state: 'PENDING',
  note: 'Bring traffic cones.',
  assignedAt: '2026-11-06T06:00:00.000Z',
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  endedAt: null,
  endReason: null,
  events: [
    {
      kind: 'ASSIGNED',
      message: 'Bring traffic cones.',
      photos: [],
      actorName: 'Karim Reviewer',
      createdAt: '2026-11-06T06:00:00.000Z',
    },
  ],
  submissions: [],
  ...overrides,
});

const task = (state: string, actions: Record<string, boolean>) => ({
  assignment: assignment({ state }),
  organizationId: ORG_ID,
  organizationName: 'Dhaka North City Corporation',
  report: {
    publicId: PUBLIC_ID,
    title: 'Deep pothole near the bus stop',
    description: 'The pothole floods when it rains.',
    category: CATEGORY,
    status: state === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ASSIGNED',
    latitude: 23.86,
    longitude: 90.37,
    locationDescription: 'Opposite the Banani Road 11 bridge',
    photos: [],
  },
  actions: {
    accept: false,
    decline: false,
    start: false,
    progress: false,
    returnTask: false,
    complete: false,
    ...actions,
  },
});

async function blockMapTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
}

/** Signed storage URL used by the mocked upload intent. */
async function mockStorage(page: Page) {
  await page.route('http://127.0.0.1:4999/storage/**', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': 'http://localhost:3100',
        'access-control-allow-methods': 'PUT',
        'access-control-allow-headers': 'content-type',
      },
    }),
  );
}

test.beforeEach(async ({ page }) => blockMapTiles(page));

test('a worker sees their tasks and can set availability', async ({ page }) => {
  let availability: unknown;
  await mockApi(page, {
    ...signedIn,
    'GET /work/tasks': () =>
      ok([
        {
          id: ASSIGNMENT_ID,
          state: 'PENDING',
          organizationName: 'Dhaka North City Corporation',
          publicId: PUBLIC_ID,
          title: 'Deep pothole near the bus stop',
          category: CATEGORY,
          reportStatus: 'ASSIGNED',
          locationDescription: null,
          assignedAt: '2026-11-06T06:00:00.000Z',
        },
      ]),
    [`PUT /work/memberships/${ORG_ID}/availability`]: (route) => {
      availability = route.request().postDataJSON();
      return ok([
        {
          organizationId: ORG_ID,
          organizationName: 'Dhaka North City Corporation',
          available: false,
        },
      ]);
    },
  });
  await page.goto('/en/work');
  await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My tasks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Deep pothole near the bus stop' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel('Available for new tasks at Dhaka North City Corporation').uncheck();
  await expect.poll(() => availability).toEqual({ available: false });
});

test('a worker accepts, starts and submits work with an after photo', async ({ page }) => {
  let current = task('PENDING', { accept: true, decline: true });
  let completed: unknown;
  let uploadPurpose: unknown;
  await mockStorage(page);
  await mockApi(page, {
    ...signedIn,
    [`GET /work/tasks/${ASSIGNMENT_ID}`]: () => ok(current),
    [`POST /work/tasks/${ASSIGNMENT_ID}/accept`]: () => {
      current = task('ACCEPTED', { start: true, decline: true });
      return ok(current);
    },
    [`POST /work/tasks/${ASSIGNMENT_ID}/start`]: () => {
      current = task('IN_PROGRESS', { progress: true, returnTask: true, complete: true });
      return ok(current);
    },
    'POST /media/upload-intent': (route) => {
      uploadPurpose = (route.request().postDataJSON() as { purpose: string }).purpose;
      return ok({
        mediaId: MEDIA_ID,
        uploadUrl: 'http://127.0.0.1:4999/storage/uploads/after',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        expiresAt: '2026-11-06T06:05:00.000Z',
      });
    },
    [`POST /media/${MEDIA_ID}/confirm`]: () =>
      ok({
        id: MEDIA_ID,
        status: 'PROCESSED',
        rejectionReason: null,
        displayUrl: null,
        thumbnailUrl: null,
      }),
    [`POST /work/tasks/${ASSIGNMENT_ID}/complete`]: (route) => {
      completed = route.request().postDataJSON();
      current = task('COMPLETED', {});
      return ok(current);
    },
  });

  await page.goto(`/en/work/${ASSIGNMENT_ID}`);
  await expect(page.getByText('Instructions: Bring traffic cones.')).toBeVisible();
  await expect(page.getByText(user.email)).toHaveCount(0);
  await page.getByRole('button', { name: 'Accept task' }).click();
  await page.getByRole('button', { name: 'Start work' }).click();

  await page.getByLabel('What was done?').fill('Filled and compacted the pothole.');
  const submit = page.getByRole('button', { name: 'Submit for verification' });
  await expect(submit).toBeDisabled(); // an after photo is required
  await page
    .locator('#after-photos')
    .setInputFiles({ name: 'after.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await submit.click();
  await expect(page.getByText('Waiting for verification').first()).toBeVisible();
  expect(uploadPurpose).toBe('WORK_PHOTO');
  expect(completed).toEqual({
    description: 'Filled and compacted the pothole.',
    mediaIds: [MEDIA_ID],
  });
});

const workspace = (
  overrides: Record<string, unknown> = {},
  actions: Record<string, boolean> = {},
) => ({
  publicId: PUBLIC_ID,
  title: 'Deep pothole near the bus stop',
  description: 'The pothole floods when it rains.',
  category: CATEGORY,
  status: 'ACCEPTED',
  latitude: 23.86,
  longitude: 90.37,
  locationAccuracyM: null,
  locationDescription: null,
  visibility: 'PUBLIC',
  routing: 'ROUTED',
  organizationId: ORG_ID,
  organizationName: 'Dhaka North City Corporation',
  version: 4,
  submittedAt: '2026-11-04T06:00:00.000Z',
  updatedAt: '2026-11-06T06:00:00.000Z',
  photos: [],
  informationRequests: [],
  rejection: null,
  assignments: [],
  feedback: [],
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
    ...actions,
  },
  ...overrides,
});

const reviewerApi = (
  current: () => unknown,
  extra: Record<string, Handler>,
): Record<string, Handler> => ({
  ...signedIn,
  'GET /work/memberships': () => ok([]),
  [`GET /organizations/${ORG_ID}/overview`]: () =>
    ok({
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
    }),
  'GET /categories': () => ok([]),
  [`GET /organizations/${ORG_ID}/reports/${PUBLIC_ID}`]: () => ok(current()),
  [`GET /organizations/${ORG_ID}/reports/${PUBLIC_ID}/history`]: () => ok([]),
  [`GET /organizations/${ORG_ID}/reports/${PUBLIC_ID}/notes`]: () => ok([]),
  [`GET /organizations/${ORG_ID}/reports/${PUBLIC_ID}/updates`]: () => ok([]),
  ...extra,
});

test('a reviewer assigns an available worker', async ({ page }) => {
  let current = workspace({}, { assign: true, transfer: true });
  let assigned: unknown;
  let ifMatch: string | undefined;
  await mockApi(
    page,
    reviewerApi(() => current, {
      [`GET /organizations/${ORG_ID}/reports/${PUBLIC_ID}/transfer-targets`]: () => ok([]),
      [`GET /organizations/${ORG_ID}/workers`]: () =>
        ok([
          { userId: WORKER_ID, name: 'Jamal Worker', available: true, activeTasks: 2 },
          {
            userId: '01960000-0000-7000-8000-0000000000e2',
            name: 'Rafiq Worker',
            available: false,
            activeTasks: 0,
          },
        ]),
      [`POST /organizations/${ORG_ID}/reports/${PUBLIC_ID}/assign`]: (route) => {
        assigned = route.request().postDataJSON();
        ifMatch = route.request().headers()['if-match'];
        current = workspace(
          { status: 'ASSIGNED', version: 5, assignments: [assignment()] },
          { reassign: true, cancelAssignment: true },
        );
        return ok(current);
      },
    }),
  );
  await page.goto(`/en/organizations/${ORG_ID}/reports/${PUBLIC_ID}`);
  await page.getByText('Assign a worker').click();
  await expect(page.getByRole('option', { name: 'Rafiq Worker · unavailable' })).toBeDisabled();
  await page
    .getByLabel('Worker', { exact: true })
    .selectOption({ label: 'Jamal Worker · 2 open tasks' });
  await page.getByLabel('Instructions for the worker (optional)').fill('Bring traffic cones.');
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByText('Jamal Worker · Waiting to be accepted')).toBeVisible();
  expect(assigned).toEqual({ workerId: WORKER_ID, note: 'Bring traffic cones.' });
  expect(ifMatch).toBe('4');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('a reviewer asks for more evidence', async ({ page }) => {
  let verified: unknown;
  const pending = assignment({
    state: 'COMPLETED',
    submissions: [
      {
        id: '01960000-0000-7000-8000-0000000000d1',
        description: 'Filled and compacted the pothole.',
        photos: [],
        createdAt: '2026-11-06T09:00:00.000Z',
        verification: null,
      },
    ],
  });
  let current = workspace(
    { status: 'PENDING_VERIFICATION', assignments: [pending] },
    { verify: true },
  );
  await mockApi(
    page,
    reviewerApi(() => current, {
      [`POST /organizations/${ORG_ID}/reports/${PUBLIC_ID}/verify`]: (route) => {
        verified = route.request().postDataJSON();
        current = workspace({
          status: 'IN_PROGRESS',
          assignments: [{ ...pending, state: 'IN_PROGRESS' }],
        });
        return ok(current);
      },
    }),
  );
  await page.goto(`/en/organizations/${ORG_ID}/reports/${PUBLIC_ID}`);
  await expect(page.getByRole('heading', { name: 'Verify the work' })).toBeVisible();
  await page.getByLabel('More evidence needed').check();
  const save = page.getByRole('button', { name: 'Save verification' });
  await expect(save).toBeDisabled(); // a reason is required
  await page.getByLabel('What is wrong or missing?').fill('Please add a street-level photo.');
  await save.click();
  await expect(page.getByRole('heading', { name: 'Verify the work' })).toHaveCount(0);
  expect(verified).toEqual({
    outcome: 'NEEDS_MORE_EVIDENCE',
    reason: 'Please add a street-level photo.',
  });
});

test('the citizen sees the fix and says whether it is fixed', async ({ page }) => {
  let feedback: unknown;
  const resolved = {
    publicId: PUBLIC_ID,
    title: 'Deep pothole near the bus stop',
    description: 'The pothole floods when it rains.',
    category: CATEGORY,
    status: 'RESOLVED',
    latitude: 23.86,
    longitude: 90.37,
    locationDescription: null,
    organizationName: 'Dhaka North City Corporation',
    photoCount: 1,
    submittedAt: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
    visibility: 'PUBLIC',
    locationAccuracyM: null,
    routing: 'ROUTED',
    version: 9,
    canEdit: false,
    canWithdraw: false,
    canProvideInformation: false,
    informationRequest: null,
    rejection: null,
    photos: [],
    completion: {
      description: 'Filled and compacted the pothole.',
      photos: [],
      resolvedAt: '2026-11-06T10:00:00.000Z',
    },
    canGiveFeedback: true,
    duplicateOf: null,
    feedback: null as { fixed: boolean; comment: string | null } | null,
  };
  let current = resolved;
  await mockApi(page, {
    ...signedIn,
    'GET /work/memberships': () => ok([]),
    [`GET /reports/${PUBLIC_ID}`]: () => ok(current),
    [`GET /reports/${PUBLIC_ID}/history`]: () => ok([]),
    [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
    [`POST /reports/${PUBLIC_ID}/feedback`]: (route) => {
      feedback = route.request().postDataJSON();
      current = {
        ...resolved,
        canGiveFeedback: false,
        duplicateOf: null,
        feedback: { fixed: false, comment: 'Water still pools.' },
      };
      return ok(current);
    },
  });
  await page.goto(`/en/reports/${PUBLIC_ID}`);
  await expect(page.getByRole('heading', { name: 'How it was fixed' })).toBeVisible();
  await expect(page.getByText('Filled and compacted the pothole.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
  await page.getByLabel('No, it is not fixed').check();
  await page.getByLabel('Comment (optional)').fill('Water still pools.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('You said: No, it is not fixed')).toBeVisible();
  expect(feedback).toEqual({ fixed: false, comment: 'Water still pools.' });
});
