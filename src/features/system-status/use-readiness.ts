import { useQuery } from '@tanstack/react-query';
import { ApiClientError, callApi, createApiClient } from '@/lib/api/client';
import type { components } from '@/types/api.generated';

export type ComponentState = 'up' | 'down' | 'unknown';
type ReadinessChecks = components['schemas']['ReadinessChecksDto'];

export interface Readiness {
  ready: boolean;
  checks: Record<keyof ReadinessChecks, ComponentState>;
  requestId?: string;
  apiReachable: boolean;
}

const UNKNOWN: Readiness['checks'] = { database: 'unknown', redis: 'unknown' };

/** Reads a dependency's state from the 503 error details returned by /health/ready. */
function checksFromError(error: ApiClientError): Readiness['checks'] {
  const checks = { ...UNKNOWN };
  for (const detail of error.details as Array<{ component?: unknown; status?: unknown }>) {
    if (
      (detail.component === 'database' || detail.component === 'redis') &&
      (detail.status === 'up' || detail.status === 'down')
    ) {
      checks[detail.component] = detail.status;
    }
  }
  return checks;
}

export async function fetchReadiness(client = createApiClient()): Promise<Readiness> {
  try {
    const data = await callApi(() => client.GET('/api/v1/health/ready'));
    return { ready: true, checks: data.checks, apiReachable: true };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'SERVICE_UNAVAILABLE') {
      return {
        ready: false,
        checks: checksFromError(error),
        requestId: error.requestId,
        apiReachable: true,
      };
    }
    if (error instanceof ApiClientError) {
      return {
        ready: false,
        checks: UNKNOWN,
        requestId: error.requestId,
        apiReachable: error.code !== 'NETWORK_ERROR',
      };
    }
    throw error;
  }
}

export function useReadiness() {
  return useQuery({
    queryKey: ['system', 'readiness'],
    queryFn: () => fetchReadiness(),
    staleTime: 0,
  });
}
