import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, callApi, createApiClient, setCsrfToken } from '@/lib/api/client';

function jsonResponse(status: number, body: unknown, requestId = 'req-header-id') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

// openapi-fetch captures globalThis.fetch when the client is created, so stub it first.
function clientReturning(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { client: createApiClient('http://api.test'), fetchMock };
}

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCsrfToken(undefined);
  });

  it('sends the CSRF token on state-changing requests only', async () => {
    setCsrfToken('csrf-token-value');
    const ok = () =>
      jsonResponse(200, { success: true, data: { accepted: true }, meta: { requestId: 'r' } });
    const fetchMock = vi.fn(() => Promise.resolve(ok()));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient('http://api.test');

    await callApi(() => client.POST('/api/v1/auth/logout'));
    await callApi(() => client.GET('/api/v1/health/live'));

    const [post, get] = fetchMock.mock.calls.map((call) => (call as unknown as [Request])[0]);
    expect(post?.headers.get('x-csrf-token')).toBe('csrf-token-value');
    expect(get?.headers.get('x-csrf-token')).toBeNull();
  });

  it('returns envelope data on success and sends cookies', async () => {
    const { client, fetchMock } = clientReturning(
      jsonResponse(200, { success: true, data: { status: 'ok' }, meta: { requestId: 'r1' } }),
    );

    await expect(callApi(() => client.GET('/api/v1/health/live'))).resolves.toEqual({
      status: 'ok',
    });

    const request = (fetchMock.mock.calls[0] as unknown as [Request])[0];
    expect(request.url).toBe('http://api.test/api/v1/health/live');
    expect(request.credentials).toBe('include');
  });

  it('throws ApiClientError with the backend code, details and request ID', async () => {
    const { client } = clientReturning(
      jsonResponse(503, {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'The service is temporarily unavailable.',
          details: [{ message: 'redis is down', component: 'redis', status: 'down' }],
          requestId: 'req-body-id',
        },
      }),
    );

    const error = await callApi(() => client.GET('/api/v1/health/ready')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
      requestId: 'req-body-id',
      details: [{ component: 'redis', status: 'down' }],
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    const { client } = clientReturning(new TypeError('Failed to fetch'));

    await expect(callApi(() => client.GET('/api/v1/health/live'))).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: undefined,
    });
  });

  it('rejects responses that are not CivicEye envelopes', async () => {
    const { client } = clientReturning(jsonResponse(502, { message: 'Bad gateway' }));

    await expect(callApi(() => client.GET('/api/v1/health/live'))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
      requestId: 'req-header-id',
    });
  });
});
