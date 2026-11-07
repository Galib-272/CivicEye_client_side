import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, ok, signedOut, user, WCAG_TAGS, type Handler } from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const PUBLIC_ID = 'CE-J91J-KA5S';
const ORIGINAL_ID = 'CE-AB12-CD34';
const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  parentId: null,
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
  descriptionEn: null,
  descriptionBn: null,
  isActive: true,
  displayOrder: 10,
  duplicateRadiusM: 30,
};

const signedIn: Record<string, Handler> = {
  'GET /auth/me': () => ok({ user, csrfToken: 'csrf', mfa: 'none' }),
  'GET /users/me/organizations': () => ok([]),
  'GET /work/memberships': () => ok([]),
  'GET /notifications/unread-count': () => ok({ count: 0 }),
};

async function blockMapTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
}
test.beforeEach(async ({ page }) => blockMapTiles(page));

test('the public map counts the reports in view and passes accessibility checks', async ({
  page,
}) => {
  let requested: URLSearchParams | undefined;
  await mockApi(page, {
    ...signedOut,
    'GET /categories': () => ok([CATEGORY]),
    'GET /map/reports': (route) => {
      requested = new URL(route.request().url()).searchParams;
      return ok({
        reports: [
          {
            publicId: PUBLIC_ID,
            title: 'Deep pothole near the bus stop',
            status: 'SUBMITTED',
            categoryId: CATEGORY.id,
            latitude: 23.794,
            longitude: 90.407,
            submittedAt: '2026-11-06T06:00:00.000Z',
          },
          {
            publicId: ORIGINAL_ID,
            title: 'Broken streetlight',
            status: 'RESOLVED',
            categoryId: CATEGORY.id,
            latitude: 23.8,
            longitude: 90.41,
            submittedAt: '2026-11-05T06:00:00.000Z',
          },
        ],
        truncated: false,
      });
    },
  });
  await page.goto('/en/map');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Map of reported issues' }),
  ).toBeVisible();
  await expect(page.getByText('2 reports in this view.')).toBeVisible();
  await expect(page.getByText('Work in progress')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show as a list' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel('Category').selectOption({ label: 'Pothole' });
  await expect.poll(() => requested?.get('categoryId')).toBe(CATEGORY.id);
  expect(Number(requested?.get('maxLng')) - Number(requested?.get('minLng'))).toBeLessThanOrEqual(
    3,
  );
});

test('the report form says who will receive the report and shows nearby reports', async ({
  page,
}) => {
  await mockApi(page, {
    ...signedIn,
    'GET /categories': () => ok([CATEGORY]),
    'POST /locations/organization-match': () =>
      ok([{ id: ORG_ID, name: 'Dhaka North City Corporation' }]),
    'GET /map/nearby': () =>
      ok([
        {
          publicId: ORIGINAL_ID,
          title: 'Pothole at the same bus stop',
          status: 'UNDER_REVIEW',
          distanceM: 20,
          submittedAt: '2026-11-05T06:00:00.000Z',
        },
      ]),
  });
  await page.goto('/en/reports/new');
  await page.getByLabel('Category').selectOption({ label: 'Pothole' });
  await page.getByText('Or enter coordinates.').click();
  await page.getByLabel('Latitude').fill('23.79412');
  await page.getByLabel('Latitude').blur();
  await page.getByLabel('Longitude').fill('90.40731');
  await page.getByLabel('Longitude').blur();
  await expect(
    page.getByText('This report will go to: Dhaka North City Corporation'),
  ).toBeVisible();
  await expect(page.getByText('Already reported nearby?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pothole at the same bus stop' })).toBeVisible();
  await expect(page.getByText('20 m away')).toBeVisible();
});

test('a reviewer links a report to its original', async ({ page }) => {
  let linked: unknown;
  let ifMatch: string | undefined;
  const workspace = (status: string, markDuplicate: boolean) => ({
    publicId: PUBLIC_ID,
    title: 'Deep pothole near the bus stop',
    description: 'The pothole floods when it rains.',
    category: CATEGORY,
    status,
    latitude: 23.86,
    longitude: 90.37,
    locationAccuracyM: null,
    locationDescription: null,
    visibility: 'PUBLIC',
    routing: 'ROUTED',
    organizationId: ORG_ID,
    organizationName: 'Dhaka North City Corporation',
    version: 3,
    submittedAt: '2026-11-06T06:00:00.000Z',
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
      markDuplicate,
    },
  });
  let current = workspace('UNDER_REVIEW', true);
  const base = `/organizations/${ORG_ID}/reports/${PUBLIC_ID}`;
  await mockApi(page, {
    ...signedIn,
    [`GET /organizations/${ORG_ID}/overview`]: () => ok({ id: ORG_ID, categoryIds: [CATEGORY.id] }),
    'GET /categories': () => ok([CATEGORY]),
    [`GET ${base}`]: () => ok(current),
    [`GET ${base}/history`]: () => ok([]),
    [`GET ${base}/notes`]: () => ok([]),
    [`GET ${base}/updates`]: () => ok([]),
    [`GET ${base}/duplicates`]: () =>
      ok([
        {
          publicId: ORIGINAL_ID,
          title: 'Pothole at the same bus stop',
          status: 'ACCEPTED',
          category: CATEGORY,
          distanceM: 18,
          submittedAt: '2026-11-05T06:00:00.000Z',
          photos: [],
        },
      ]),
    [`POST ${base}/mark-duplicate`]: (route) => {
      linked = route.request().postDataJSON();
      ifMatch = route.request().headers()['if-match'];
      current = workspace('DUPLICATE', false);
      return ok(current);
    },
  });
  await page.goto(`/en${base}`);
  await expect(page.getByRole('heading', { name: 'Possible duplicates' })).toBeVisible();
  await expect(page.getByText('18 m away')).toBeVisible();
  await page.getByText('Decide', { exact: true }).click();
  const mark = page.getByRole('button', { name: 'Mark this report as a duplicate of it' });
  await expect(mark).toBeDisabled(); // a reason is required
  await page.getByLabel('Reason').fill('Same pothole, reported twice from the bus stop.');
  await mark.click();
  await expect(page.getByText('Duplicate', { exact: true }).first()).toBeVisible();
  expect(linked).toEqual({
    canonicalPublicId: ORIGINAL_ID,
    reason: 'Same pothole, reported twice from the bus stop.',
  });
  expect(ifMatch).toBe('3');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the citizen sees which report theirs was linked to', async ({ page }) => {
  await mockApi(page, {
    ...signedIn,
    [`GET /reports/${PUBLIC_ID}`]: () =>
      ok({
        publicId: PUBLIC_ID,
        title: 'Deep pothole near the bus stop',
        description: 'The pothole floods when it rains.',
        category: CATEGORY,
        status: 'DUPLICATE',
        latitude: 23.86,
        longitude: 90.37,
        locationDescription: null,
        organizationName: 'Dhaka North City Corporation',
        photoCount: 1,
        submittedAt: '2026-11-06T06:00:00.000Z',
        updatedAt: '2026-11-06T07:00:00.000Z',
        visibility: 'PUBLIC',
        locationAccuracyM: null,
        routing: 'ROUTED',
        version: 4,
        canEdit: false,
        canWithdraw: false,
        canProvideInformation: false,
        informationRequest: null,
        rejection: null,
        photos: [],
        completion: null,
        canGiveFeedback: false,
        duplicateOf: { publicId: ORIGINAL_ID },
        feedback: null,
      }),
    [`GET /reports/${PUBLIC_ID}/history`]: () => ok([]),
    [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
  });
  await page.goto(`/en/reports/${PUBLIC_ID}`);
  await expect(page.getByText('Linked to an existing report')).toBeVisible();
  await expect(page.getByRole('link', { name: ORIGINAL_ID })).toHaveAttribute(
    'href',
    `/en/reports/${ORIGINAL_ID}`,
  );
});
