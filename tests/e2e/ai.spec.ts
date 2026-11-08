import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, ok, user, WCAG_TAGS, type Handler } from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';
const PUBLIC_ID = 'CE-J91J-KA5S';
const BASE = `/organizations/${ORG_ID}/reports`;
const PHOTO_1 = '01960000-0000-7000-8000-0000000000d1';
const PHOTO_2 = '01960000-0000-7000-8000-0000000000d2';
const PREDICTION_1 = '01960000-0000-7000-8000-0000000000e1';
const PREDICTION_2 = '01960000-0000-7000-8000-0000000000e2';
const PHOTO_URL = 'http://127.0.0.1:4999/storage/photo.jpg';
// A 1x1 grey JPEG, enough for the browser to lay the photo out.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

const CATEGORY = {
  id: '01960000-0000-7000-8000-0000000000c2',
  slug: 'pothole',
  nameEn: 'Pothole',
  nameBn: 'রাস্তার গর্ত',
};

const report = {
  publicId: PUBLIC_ID,
  title: 'Deep pothole near the bus stop',
  description: 'The pothole has grown over the last week and floods when it rains.',
  category: CATEGORY,
  status: 'SUBMITTED',
  latitude: 23.86,
  longitude: 90.37,
  locationAccuracyM: 12,
  locationDescription: null,
  visibility: 'PUBLIC',
  routing: 'ROUTED',
  organizationId: ORG_ID,
  organizationName: 'Dhaka North City Corporation',
  version: 1,
  submittedAt: '2026-11-04T06:00:00.000Z',
  updatedAt: '2026-11-04T06:00:00.000Z',
  photos: [
    { id: PHOTO_1, thumbnailUrl: PHOTO_URL, displayUrl: PHOTO_URL },
    { id: PHOTO_2, thumbnailUrl: PHOTO_URL, displayUrl: PHOTO_URL },
  ],
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
  },
};

const prediction = (overrides: Record<string, unknown>) => ({
  id: PREDICTION_1,
  mediaId: PHOTO_1,
  photoPosition: 0,
  status: 'SUCCEEDED',
  modelVersion: 'road-damage-2026.11.08',
  label: 'pothole',
  confidence: 0.91,
  uncertain: false,
  probabilities: { pothole: 0.91, crack: 0.04, asphalt_damage: 0.03, no_damage: 0.02 },
  detections: [{ box: [0.1, 0.2, 0.5, 0.6], score: 0.88 }],
  warnings: [],
  errorCode: null,
  createdAt: '2026-11-04T06:00:05.000Z',
  completedAt: '2026-11-04T06:00:06.000Z',
  suggestedCategories: [CATEGORY],
  review: null,
  ...overrides,
});

const uncertainDark = prediction({
  id: PREDICTION_2,
  mediaId: PHOTO_2,
  photoPosition: 1,
  label: 'crack',
  confidence: 0.48,
  uncertain: true,
  detections: [],
  warnings: ['too_dark'],
  suggestedCategories: [],
});

function workspace(
  ai: () => unknown,
  extra: Record<string, Handler> = {},
): Record<string, Handler> {
  return {
    'GET /auth/me': () => ok({ user, csrfToken: 'csrf', mfa: 'none' }),
    'GET /users/me/organizations': () => ok([]),
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
    [`GET ${BASE}/${PUBLIC_ID}`]: () => ok(report),
    [`GET ${BASE}/${PUBLIC_ID}/ai`]: () => ok(ai()),
    [`GET ${BASE}/${PUBLIC_ID}/history`]: () => ok([]),
    [`GET ${BASE}/${PUBLIC_ID}/notes`]: () => ok([]),
    [`GET ${BASE}/${PUBLIC_ID}/updates`]: () => ok([]),
    [`GET ${BASE}/${PUBLIC_ID}/duplicates`]: () => ok([]),
    ...extra,
  };
}

async function setUp(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
  await page.route(PHOTO_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG }),
  );
}

test.beforeEach(async ({ page }) => setUp(page));

test('a reviewer sees advisory AI suggestions with boxes and warnings', async ({ page }) => {
  await mockApi(
    page,
    workspace(() => ({ enabled: true, predictions: [prediction({}), uncertainDark] })),
  );
  await page.goto(`/en${BASE}/${PUBLIC_ID}`);

  const panel = page.getByRole('region', { name: 'AI suggestion' });
  await expect(panel.getByText('Advisory only.', { exact: false })).toBeVisible();
  const [first, second] = [
    panel.getByTestId('ai-prediction').nth(0),
    panel.getByTestId('ai-prediction').nth(1),
  ];
  await expect(first.getByText('Likely: Pothole')).toBeVisible();
  await expect(first.getByText('Model score 91%')).toBeVisible();
  await expect(first.getByTestId('ai-box')).toHaveCount(1);
  await expect(first.getByText('Matching categories: Pothole.', { exact: false })).toBeVisible();
  await expect(first.getByText('Model road-damage-2026.11.08')).toBeVisible();

  // Uncertain suggestions are not worded as an answer.
  await expect(second.getByText('Uncertain', { exact: true })).toBeVisible();
  await expect(second.getByText('Its best guess is Crack', { exact: false })).toBeVisible();
  await expect(second.getByText('The photo is very dark.')).toBeVisible();
  await expect(second.getByTestId('ai-box')).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('a reviewer agrees with one suggestion and corrects another', async ({ page }) => {
  const reviews: Array<{ id: string; body: unknown }> = [];
  let predictions: Array<Record<string, unknown>> = [prediction({}), uncertainDark];
  await mockApi(
    page,
    workspace(
      () => ({ enabled: true, predictions }),
      Object.fromEntries(
        [PREDICTION_1, PREDICTION_2].map((id) => [
          `POST ${BASE}/${PUBLIC_ID}/ai/${id}/review`,
          (route) => {
            const body = route.request().postDataJSON() as {
              action: string;
              correctedLabel?: string;
            };
            reviews.push({ id, body });
            predictions = predictions.map((p) =>
              p.id === id
                ? {
                    ...p,
                    review: {
                      action: body.action,
                      correctedLabel: body.correctedLabel ?? null,
                      reviewedAt: '2026-11-04T07:00:00.000Z',
                    },
                  }
                : p,
            );
            return ok({ enabled: true, predictions });
          },
        ]),
      ),
    ),
  );
  await page.goto(`/en${BASE}/${PUBLIC_ID}`);
  const cards = page.getByTestId('ai-prediction');

  await cards.nth(0).getByRole('button', { name: 'AI is right' }).click();
  await expect(cards.nth(0).getByText('You marked this suggestion as right.')).toBeVisible();

  await cards.nth(1).getByRole('button', { name: 'AI is wrong' }).click();
  await cards.nth(1).getByLabel('The photo actually shows').selectOption({ label: 'Pothole' });
  await cards.nth(1).getByRole('button', { name: 'Save correction' }).click();
  await expect(
    cards.nth(1).getByText('You corrected this suggestion: the photo shows Pothole.'),
  ).toBeVisible();

  expect(reviews).toEqual([
    { id: PREDICTION_1, body: { action: 'ACCEPTED' } },
    { id: PREDICTION_2, body: { action: 'CORRECTED', correctedLabel: 'pothole' } },
  ]);
});

test('the panel is in Bangla, and says so when the AI is off', async ({ page }) => {
  await mockApi(
    page,
    workspace(() => ({ enabled: false, predictions: [prediction({})] })),
  );
  await page.goto(`/bn${BASE}/${PUBLIC_ID}`);
  const panel = page.getByRole('region', { name: 'এআই পরামর্শ' });
  await expect(panel.getByText('সম্ভবত: গর্ত')).toBeVisible();
  await expect(panel.getByText('এআই বিশ্লেষণ বন্ধ আছে।', { exact: false })).toBeVisible();
});

test('there is no AI panel when the AI is off and nothing was analysed', async ({ page }) => {
  await mockApi(
    page,
    workspace(() => ({ enabled: false, predictions: [] })),
  );
  await page.goto(`/en${BASE}/${PUBLIC_ID}`);
  await expect(page.getByRole('heading', { name: 'Deep pothole near the bus stop' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI suggestion' })).toHaveCount(0);
});
