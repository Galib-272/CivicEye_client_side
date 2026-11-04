import type { Page, Route } from '@playwright/test';

/*
 * The client repository has no backend in CI, so browser tests answer API calls in the
 * browser with the documented response envelopes. Real end-to-end behaviour (sessions,
 * emails, permissions) is covered by the server repository's integration tests.
 */

export const API = 'http://127.0.0.1:4999/api/v1';
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export type Handler = (route: Route) => { status: number; body: unknown } | undefined;

export const user = {
  id: '01960000-0000-7000-8000-000000000001',
  email: 'rahima@example.test',
  name: 'Rahima Akter',
  status: 'ACTIVE',
  platformRole: 'CITIZEN',
  preferredLocale: 'en',
  emailVerified: true,
};

export function ok(data: unknown, status = 200) {
  return { status, body: { success: true, data, meta: { requestId: 'req-e2e' } } };
}

export function fail(status: number, code: string, details: unknown[] = []) {
  return {
    status,
    body: { success: false, error: { code, message: code, details, requestId: 'req-e2e' } },
  };
}

/** Routes API calls to handlers keyed by "METHOD /path". Unhandled calls get 404. */
export async function mockApi(page: Page, handlers: Record<string, Handler>) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const cors = {
      'access-control-allow-origin': 'http://localhost:3100',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers':
        'content-type, x-csrf-token, accept, idempotency-key, if-match',
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
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
export function alertWithText(page: Page, text: string) {
  return page.getByRole('alert').filter({ hasText: text });
}

export const signedOut: Record<string, Handler> = {
  'GET /auth/me': () => fail(401, 'UNAUTHENTICATED'),
};
