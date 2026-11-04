import createClient from 'openapi-fetch';
import type { components, paths } from '@/types/api.generated';
import { parsePublicEnv } from '@/lib/env';

export type ApiErrorBody = components['schemas']['ApiErrorDto'];
export type ErrorCode = components['schemas']['ErrorCode'];

/**
 * Error raised for any failed API call. `code` is the stable backend error code; network
 * failures use NETWORK_ERROR. Display `requestId` to users so support can trace the request.
 */
export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    message: string,
    readonly status: number | undefined,
    readonly requestId: string | undefined,
    readonly details: ApiErrorBody['error']['details'] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function isErrorEnvelope(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { error?: { code?: unknown } }).error?.code === 'string'
  );
}

export function createApiClient(baseUrl: string = parsePublicEnv().NEXT_PUBLIC_API_URL) {
  return createClient<paths>({
    baseUrl,
    // Session cookies (Phase 2) are sent to the API origin.
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
}

/**
 * Converts an openapi-fetch result into the envelope's data, throwing ApiClientError for
 * error envelopes and unexpected bodies. Never trusts a response that is not an envelope.
 */
export function unwrap<T>(result: {
  data?: { success: true; data: T };
  error?: unknown;
  response: Response;
}): T {
  const requestId = result.response.headers.get('x-request-id') ?? undefined;

  if (result.data !== undefined) {
    if (result.data.success !== true) {
      throw new ApiClientError(
        'INVALID_RESPONSE',
        'Unexpected API response.',
        result.response.status,
        requestId,
      );
    }
    return result.data.data;
  }

  if (isErrorEnvelope(result.error)) {
    const { code, message, details, requestId: bodyRequestId } = result.error.error;
    throw new ApiClientError(
      code,
      message,
      result.response.status,
      bodyRequestId ?? requestId,
      details,
    );
  }

  throw new ApiClientError(
    'INVALID_RESPONSE',
    'Unexpected API response.',
    result.response.status,
    requestId,
  );
}

/** Wraps fetch failures (offline, DNS, CORS) so callers handle a single error type. */
export async function callApi<T>(
  request: () => Promise<{
    data?: { success: true; data: T };
    error?: unknown;
    response: Response;
  }>,
): Promise<T> {
  let result: Awaited<ReturnType<typeof request>>;
  try {
    result = await request();
  } catch {
    throw new ApiClientError(
      'NETWORK_ERROR',
      'The API could not be reached.',
      undefined,
      undefined,
    );
  }
  return unwrap(result);
}
