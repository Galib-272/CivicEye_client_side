import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fail, mockApi, ok, signedOut, user, WCAG_TAGS, type Handler } from './mock-api';

const PUBLIC_ID = 'CE-J91J-KA5S';
const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
};

// A 1×1 PNG; the mocked server "accepts" it like the real one would after its checks.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const signedIn = (
  overrides: Partial<typeof user> = {},
  role = 'CITIZEN',
): Record<string, Handler> => ({
  'GET /auth/me': () =>
    ok({
      user: { ...user, platformRole: role, ...overrides },
      csrfToken: 'csrf',
      mfa: role === 'SUPER_ADMIN' ? 'verified' : 'none',
    }),
  'GET /users/me/organizations': () => ok([]),
});

const publicReport = {
  publicId: PUBLIC_ID,
  title: 'Deep pothole near the bus stop',
  description: 'The pothole has grown over the last week and floods when it rains.',
  category: CATEGORY,
  status: 'SUBMITTED',
  latitude: 23.794,
  longitude: 90.407,
  locationDescription: 'Opposite the Banani Road 11 bridge',
  organizationName: null,
  photoCount: 2,
  submittedAt: '2026-11-04T06:00:00.000Z',
  updatedAt: '2026-11-04T06:00:00.000Z',
};

const ownReport = {
  ...publicReport,
  latitude: 23.79412,
  longitude: 90.40731,
  visibility: 'PUBLIC',
  locationAccuracyM: 12,
  routing: 'UNROUTED',
  version: 3,
  canEdit: true,
  canWithdraw: true,
  canProvideInformation: false,
  informationRequest: null,
  rejection: null,
  photos: [],
};

const history = [
  {
    fromStatus: null,
    toStatus: 'SUBMITTED',
    publicMessage: null,
    reason: null,
    createdAt: '2026-11-04T06:00:00.000Z',
  },
];

/** Keeps tests offline and deterministic: no map tiles from the internet. */
async function blockMapTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
}

test.beforeEach(async ({ page }) => blockMapTiles(page));

test.describe('reports', () => {
  test('the public list shows reports without reporters and passes accessibility checks', async ({
    page,
  }) => {
    await mockApi(page, {
      ...signedOut,
      'GET /categories': () =>
        ok([
          {
            ...CATEGORY,
            parentId: null,
            descriptionEn: null,
            descriptionBn: null,
            isActive: true,
            displayOrder: 10,
          },
        ]),
      'GET /reports': () => ok([publicReport]),
    });
    await page.goto('/en/reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Reported issues' })).toBeVisible();
    await expect(page.getByRole('link', { name: publicReport.title })).toBeVisible();
    await expect(page.getByText('2 photos')).toBeVisible();
    await expect(page.getByText(user.name)).toHaveCount(0);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('a public report shows an approximate location and no photos', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      [`GET /reports/${PUBLIC_ID}`]: () => ok(publicReport),
      [`GET /reports/${PUBLIC_ID}/history`]: () => ok(history),
      [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
    });
    await page.goto(`/en/reports/${PUBLIC_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: publicReport.title })).toBeVisible();
    await expect(page.getByText('Approximate location (about 100 m)')).toBeVisible();
    await expect(page.getByText('Photos are only visible to the reporter')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit report' })).toHaveCount(0);
  });

  test('a missing or private report shows not found', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      [`GET /reports/${PUBLIC_ID}`]: () => fail(404, 'NOT_FOUND'),
    });
    await page.goto(`/en/reports/${PUBLIC_ID}`);
    await expect(page.getByText('This report was not found, or it is not public.')).toBeVisible();
  });

  test('signed-out visitors are sent to sign in before reporting', async ({ page }) => {
    await mockApi(page, signedOut);
    await page.goto('/en/reports/new');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Freports%2Fnew/);
  });

  test('citizens must verify their email before reporting', async ({ page }) => {
    await mockApi(page, signedIn({ emailVerified: false }));
    await page.goto('/en/reports/new');
    await expect(page.getByText('Please verify your email address first.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit report' })).toHaveCount(0);
  });

  test('a citizen can submit a report with a photo and typed coordinates', async ({ page }) => {
    let submitted: { body: Record<string, unknown>; key: string | null } | undefined;
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
    await mockApi(page, {
      ...signedIn(),
      'GET /categories': () =>
        ok([
          {
            ...CATEGORY,
            parentId: null,
            descriptionEn: null,
            descriptionBn: null,
            isActive: true,
            displayOrder: 10,
          },
        ]),
      'POST /media/upload-intent': () =>
        ok({
          mediaId: '01960000-0000-7000-8000-0000000000f1',
          uploadUrl: 'http://127.0.0.1:4999/storage/uploads/photo',
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          expiresAt: '2026-11-04T06:05:00.000Z',
        }),
      'POST /media/01960000-0000-7000-8000-0000000000f1/confirm': () =>
        ok({
          id: '01960000-0000-7000-8000-0000000000f1',
          status: 'PROCESSED',
          rejectionReason: null,
          displayUrl: null,
          thumbnailUrl: null,
        }),
      'POST /reports': (route) => {
        submitted = {
          body: route.request().postDataJSON() as Record<string, unknown>,
          key: route.request().headers()['idempotency-key'] ?? null,
        };
        return ok(ownReport, 201);
      },
      [`GET /reports/${PUBLIC_ID}`]: () => ok(ownReport),
      [`GET /reports/${PUBLIC_ID}/history`]: () => ok(history),
      [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
    });

    await page.goto('/en/reports/new');
    await expect(page.getByText('CivicEye is not an emergency service.')).toBeVisible();

    // Submitting empty shows what is missing.
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText('Place the pin on the map.')).toBeVisible();

    await page.getByLabel('Category').selectOption({ label: 'Pothole' });
    await page.getByLabel('Short title').fill(publicReport.title);
    await page.getByLabel('Description', { exact: true }).fill(publicReport.description);
    await page
      .locator('#report-photos')
      .setInputFiles({ name: 'pothole.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();

    await page.getByText('Or enter coordinates.').click();
    await page.getByLabel('Latitude').fill('23.79412');
    await page.getByLabel('Latitude').blur();
    await page.getByLabel('Longitude').fill('90.40731');
    await page.getByLabel('Longitude').blur();
    await expect(page.getByText('Pin at 23.79412, 90.40731')).toBeVisible();

    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/reports/${PUBLIC_ID}$`));
    await expect(page.getByRole('heading', { level: 1, name: publicReport.title })).toBeVisible();
    await expect(page.getByText('a CivicEye administrator will assign it')).toBeVisible();

    expect(submitted?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(submitted?.body).toMatchObject({
      categoryId: CATEGORY.id,
      latitude: 23.79412,
      longitude: 90.40731,
      visibility: 'PUBLIC',
      mediaIds: ['01960000-0000-7000-8000-0000000000f1'],
    });
  });

  test('the reporter can edit with the current version and withdraw', async ({ page }) => {
    let ifMatch: string | undefined;
    let withdrawal: unknown;
    let current: Record<string, unknown> = ownReport;
    await mockApi(page, {
      ...signedIn(),
      [`GET /reports/${PUBLIC_ID}`]: () => ok(current),
      [`GET /reports/${PUBLIC_ID}/history`]: () => ok(history),
      [`GET /reports/${PUBLIC_ID}/updates`]: () => ok([]),
      [`PATCH /reports/${PUBLIC_ID}`]: (route) => {
        ifMatch = route.request().headers()['if-match'];
        current = { ...ownReport, title: 'Very deep pothole near the bus stop', version: 4 };
        return ok(current);
      },
      [`POST /reports/${PUBLIC_ID}/withdraw`]: (route) => {
        withdrawal = route.request().postDataJSON();
        current = { ...current, status: 'WITHDRAWN', canEdit: false, canWithdraw: false };
        return ok(current);
      },
    });
    await page.goto(`/en/reports/${PUBLIC_ID}`);
    await expect(
      page.getByText('Exact location (visible to you and the organization)'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Edit report' }).click();
    await page.getByLabel('Short title').fill('Very deep pothole near the bus stop');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Changes saved.')).toBeVisible();
    expect(ifMatch).toBe('3');

    await page.getByLabel('Why are you withdrawing it?').fill('It was fixed this morning.');
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await expect(page.getByText('The report was withdrawn.')).toBeVisible();
    expect(withdrawal).toEqual({ reason: 'It was fixed this morning.' });
  });

  test('Super Admins assign unrouted reports with a reason', async ({ page }) => {
    let routed: unknown;
    const waiting = [
      {
        publicId: PUBLIC_ID,
        title: publicReport.title,
        category: CATEGORY,
        status: 'SUBMITTED',
        routing: 'UNROUTED',
        candidates: [],
        note: null,
        latitude: 23.79412,
        longitude: 90.40731,
        locationDescription: null,
        submittedAt: '2026-11-04T06:00:00.000Z',
      },
    ];
    await mockApi(page, {
      ...signedIn({}, 'SUPER_ADMIN'),
      'GET /admin/reports/triage': () => ok(waiting),
      'GET /organizations': () => ok([{ id: ORG_ID, name: 'Dhaka North City Corporation' }]),
      [`POST /admin/reports/${PUBLIC_ID}/route`]: (route) => {
        routed = route.request().postDataJSON();
        waiting.length = 0;
        return ok({ publicId: PUBLIC_ID });
      },
    });
    await page.goto('/en/admin/reports/triage');
    await expect(page.getByText('No organization covers this point.')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    await page.getByLabel('Organization').selectOption({ label: 'Dhaka North City Corporation' });
    await page.getByLabel('Reason').fill('Inside the DNCC ward boundary.');
    await page.getByRole('button', { name: 'Assign' }).click();
    await expect(page.getByText('No reports are waiting.')).toBeVisible();
    expect(routed).toEqual({ organizationId: ORG_ID, reason: 'Inside the DNCC ward boundary.' });
  });
});
