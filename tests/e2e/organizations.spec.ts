import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  alertWithText,
  fail,
  mockApi,
  ok,
  signedOut,
  user,
  WCAG_TAGS,
  type Handler,
} from './mock-api';

const ORG_ID = '01960000-0000-7000-8000-0000000000b1';

const signedInAs = (platformRole: 'CITIZEN' | 'SUPER_ADMIN'): Record<string, Handler> => ({
  'GET /auth/me': () =>
    ok({
      user: { ...user, platformRole },
      csrfToken: 'csrf',
      mfa: platformRole === 'SUPER_ADMIN' ? 'verified' : 'none',
    }),
  'GET /users/me/organizations': () => ok([]),
  'GET /auth/mfa': () => ok({ enabled: false, required: false, backupCodesRemaining: 0 }),
  'GET /auth/sessions': () => ok([]),
});

const categories = [
  {
    id: '01960000-0000-7000-8000-0000000000c1',
    slug: 'road-damage',
    parentId: null,
    nameEn: 'Road damage',
    nameBn: 'সড়কের ক্ষতি',
    descriptionEn: null,
    descriptionBn: null,
    isActive: true,
    displayOrder: 10,
  },
  {
    id: '01960000-0000-7000-8000-0000000000c2',
    slug: 'pothole',
    parentId: '01960000-0000-7000-8000-0000000000c1',
    nameEn: 'Pothole',
    nameBn: 'রাস্তার গর্ত',
    descriptionEn: null,
    descriptionBn: null,
    isActive: true,
    displayOrder: 10,
  },
];

const overview = (myRole: 'ORG_ADMIN' | 'WORKER') => ({
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
  memberCount: 1,
  categoryIds: ['01960000-0000-7000-8000-0000000000c2'],
  myRole,
  createdAt: '2026-11-04T06:00:00.000Z',
});

const square = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [90.3, 23.75],
        [90.5, 23.75],
        [90.5, 23.95],
        [90.3, 23.95],
        [90.3, 23.75],
      ],
    ],
  ],
};

const workspace = (myRole: 'ORG_ADMIN' | 'WORKER'): Record<string, Handler> => ({
  ...signedInAs('CITIZEN'),
  [`GET /organizations/${ORG_ID}/overview`]: () => ok(overview(myRole)),
  [`GET /organizations/${ORG_ID}/members`]: () =>
    ok([
      {
        id: '01960000-0000-7000-8000-0000000000d1',
        userId: user.id,
        name: user.name,
        email: user.email,
        role: myRole === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'WORKER',
        joinedAt: '2026-11-04T06:00:00.000Z',
      },
    ]),
  [`GET /organizations/${ORG_ID}/invitations`]: () => ok([]),
  [`GET /organizations/${ORG_ID}/service-areas`]: () =>
    ok([
      {
        id: '01960000-0000-7000-8000-0000000000e1',
        organizationId: ORG_ID,
        name: 'North wards',
        areaSqKm: 452.3,
        pointCount: 5,
        isActive: true,
        createdAt: '2026-11-04T06:00:00.000Z',
        previewGeoJson: square,
      },
    ]),
  'GET /categories': () => ok(categories),
});

test.describe('organization pages', () => {
  test('admin pages show a permission-denied message to citizens', async ({ page }) => {
    await mockApi(page, signedInAs('CITIZEN'));
    await page.goto('/en/admin/organizations');
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('Super Admins can create an organization and see it listed', async ({ page }) => {
    let created: unknown;
    const organizations: unknown[] = [];
    await mockApi(page, {
      ...signedInAs('SUPER_ADMIN'),
      'GET /admin/organizations': () => ok(organizations),
      'GET /admin/service-areas/overlaps': () => ok([]),
      'POST /admin/organizations': (route) => {
        created = route.request().postDataJSON();
        const { myRole: _role, categoryIds: _ids, ...item } = overview('ORG_ADMIN');
        organizations.push({ ...item, verificationState: 'UNVERIFIED', memberCount: 0 });
        return ok(
          { ...overview('ORG_ADMIN'), verificationContact: null, verificationHistory: [] },
          201,
        );
      },
    });
    await page.goto('/en/admin/organizations');
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

    await page.getByLabel('Organization name').fill('Dhaka North City Corporation');
    await page.getByLabel('Official email domain').fill('dncc.gov.bd');
    await page.getByRole('button', { name: 'Create organization' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Organization created.' }),
    ).toBeVisible();
    expect(created).toEqual({
      name: 'Dhaka North City Corporation',
      officialEmailDomain: 'dncc.gov.bd',
      type: 'CITY_CORPORATION',
    });
    await expect(
      page.getByRole('link', { name: 'Manage: Dhaka North City Corporation' }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Org Admins manage their workspace; the only admin cannot be removed', async ({ page }) => {
    await mockApi(page, workspace('ORG_ADMIN'));
    await page.goto(`/en/organizations/${ORG_ID}`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Dhaka North City Corporation' }),
    ).toBeVisible();
    await expect(page.getByText('Your role: Administrator')).toBeVisible();
    await expect(page.getByRole('button', { name: `Remove ${user.name}` })).toBeDisabled();
    await expect(page.getByText('The only administrator cannot be removed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invite someone' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Pothole' })).toBeChecked();
    await expect(page.getByRole('img', { name: 'Outline of North wards' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('workers see the workspace read-only', async ({ page }) => {
    await mockApi(page, workspace('WORKER'));
    await page.goto(`/bn/organizations/${ORG_ID}`);
    await expect(page.getByText('আপনার ভূমিকা: কর্মী')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'কাউকে আমন্ত্রণ জানান' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByText('রাস্তার গর্ত')).toBeVisible();
  });

  test('non-members get a not-found message', async ({ page }) => {
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      [`GET /organizations/${ORG_ID}/overview`]: () => fail(404, 'NOT_FOUND'),
    });
    await page.goto(`/en/organizations/${ORG_ID}`);
    await expect(alertWithText(page, 'not found or you do not have access')).toBeVisible();
  });

  test('an invitation asks signed-out visitors to sign in first', async ({ page }) => {
    await mockApi(page, signedOut);
    await page.goto('/en/invitations/accept#token=abcdefghijklmnopqrstuvwxyz0123');
    await expect(
      page.getByText('Sign in with the email address the invitation was sent to'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' }).last()).toHaveAttribute(
      'href',
      '/en/sign-in?next=%2Finvitations%2Faccept',
    );
    expect(new URL(page.url()).hash).toBe('');
  });

  test('signed-in invitees accept and can open the organization', async ({ page }) => {
    let sentToken: unknown;
    await mockApi(page, {
      ...signedInAs('CITIZEN'),
      'POST /invitations/accept': (route) => {
        sentToken = (route.request().postDataJSON() as { token: string }).token;
        return ok({
          organizationId: ORG_ID,
          organizationName: 'Dhaka North City Corporation',
          role: 'ORG_REVIEWER',
        });
      },
    });
    await page.goto('/en/invitations/accept#token=abcdefghijklmnopqrstuvwxyz0123');
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(page.getByRole('status')).toContainText(
      'You joined Dhaka North City Corporation as Reviewer.',
    );
    expect(sentToken).toBe('abcdefghijklmnopqrstuvwxyz0123');
    await expect(page.getByRole('link', { name: 'Open the organization' })).toHaveAttribute(
      'href',
      `/en/organizations/${ORG_ID}`,
    );
  });

  test('the verification contact confirms without an account', async ({ page }) => {
    await mockApi(page, {
      ...signedOut,
      'POST /organization-contacts/confirm': () =>
        ok({ organizationName: 'Dhaka North City Corporation' }),
    });
    await page.goto('/en/organization-contact/confirm#token=abcdefghijklmnopqrstuvwxyz0123');
    await expect(page.getByRole('status')).toContainText(
      'confirmed that Dhaka North City Corporation is using CivicEye',
    );
    expect(new URL(page.url()).hash).toBe('');
  });
});
