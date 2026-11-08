import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : never;

export type Range = { from?: string; to?: string };
export type CitizenDashboard = Data<'MyDashboardsController_citizen_v1'>;
export type WorkerDashboard = Data<'MyDashboardsController_worker_v1'>;
export type OrganizationAnalytics = Data<'OrganizationAnalyticsController_organization_v1'>;
export type PlatformAnalytics = Data<'PlatformAnalyticsController_platform_v1'>;
export type Duration = OrganizationAnalytics['times']['review'];
export type CaseListItem = Data<'ModerationController_list_v1'>[number];
export type CaseDetail = Data<'ModerationController_detail_v1'>;
export type ActionKind = CaseDetail['allowedActions'][number];
export type FlagReason = CaseDetail['flags'][number]['reason'];
export type AuditEntry = Data<'AdminAuditController_list_v1'>[number];
export type AuditFilters = {
  action?: string;
  targetType?: string;
  result?: 'SUCCESS' | 'FAILURE';
  from?: string;
  to?: string;
  page: number;
};

/** Reads a paginated list: the items plus how many pages there are. */
async function paged<T>(
  request: () => Promise<{
    data?: { success: true; data: T[] };
    error?: unknown;
    response: Response;
  }>,
) {
  const result = await request();
  const items = await callApi(() => Promise.resolve(result));
  const meta = (result.data as { meta?: { total?: number; totalPages?: number } } | undefined)
    ?.meta;
  return { items, total: meta?.total ?? items.length, totalPages: meta?.totalPages ?? 1 };
}

const clean = (range: Range) => ({
  ...(range.from ? { from: range.from } : {}),
  ...(range.to ? { to: range.to } : {}),
});

// ─── Dashboards ───────────────────────────────────────────────────────────────

export function useCitizenDashboard() {
  return useQuery({
    queryKey: ['insights', 'me'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/users/me/dashboard')),
  });
}

export function useWorkerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ['insights', 'me', 'work'],
    enabled,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/users/me/work-dashboard')),
  });
}

export function useOrganizationAnalytics(organizationId: string, range: Range) {
  return useQuery({
    queryKey: ['insights', 'organization', organizationId, range],
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/analytics', {
          params: { path: { organizationId }, query: clean(range) },
        }),
      ),
  });
}

export function usePlatformAnalytics(range: Range) {
  return useQuery({
    queryKey: ['insights', 'platform', range],
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/admin/analytics', { params: { query: clean(range) } }),
      ),
  });
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export function useModerationCases(status: string, page: number) {
  return useQuery({
    queryKey: ['moderation', 'cases', status, page],
    placeholderData: keepPreviousData,
    queryFn: () =>
      paged(() =>
        apiClient().GET('/api/v1/admin/moderation/cases', {
          params: { query: { status: status as 'open', page, limit: 25 } },
        }),
      ),
  });
}

export function useModerationCase(caseId: string) {
  return useQuery({
    queryKey: ['moderation', 'case', caseId],
    retry: false,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/admin/moderation/cases/{caseId}', {
          params: { path: { caseId } },
        }),
      ),
  });
}

export function useModerationAction(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: ActionKind; reason: string; message?: string }) =>
      callApi(() =>
        apiClient().POST('/api/v1/admin/moderation/cases/{caseId}/actions', {
          params: { path: { caseId } },
          body,
        }),
      ),
    onSuccess: async (data) => {
      queryClient.setQueryData(['moderation', 'case', caseId], data);
      await queryClient.invalidateQueries({ queryKey: ['moderation', 'cases'] });
    },
  });
}

export function useFlag(publicId: string, updateId: string | null) {
  return useMutation({
    mutationFn: (body: { reason: FlagReason; details?: string }) =>
      callApi(() =>
        updateId
          ? apiClient().POST('/api/v1/reports/{publicId}/updates/{updateId}/flags', {
              params: { path: { publicId, updateId } },
              body,
            })
          : apiClient().POST('/api/v1/reports/{publicId}/flags', {
              params: { path: { publicId } },
              body,
            }),
      ),
  });
}

export function useEscalate(organizationId: string, publicId: string) {
  return useMutation({
    mutationFn: (body: { reason: FlagReason; details: string }) =>
      callApi(() =>
        apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/escalate', {
          params: { path: { organizationId, publicId } },
          body,
        }),
      ),
  });
}

// ─── Audit ────────────────────────────────────────────────────────────────────

const auditQuery = (filters: AuditFilters) =>
  Object.fromEntries(
    Object.entries({ ...filters, limit: 50 }).filter(([, v]) => v !== '' && v !== undefined),
  );

export function useAdminAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit', 'admin', filters],
    placeholderData: keepPreviousData,
    queryFn: () =>
      paged(() =>
        apiClient().GET('/api/v1/admin/audit', { params: { query: auditQuery(filters) } }),
      ),
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: ['audit', 'actions'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/admin/audit/actions')),
  });
}

export function useOrganizationAudit(organizationId: string, filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit', 'organization', organizationId, filters],
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () =>
      paged(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/audit', {
          params: { path: { organizationId }, query: auditQuery(filters) },
        }),
      ),
  });
}
