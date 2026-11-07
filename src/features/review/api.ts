import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : operations[Op]['responses'] extends {
        201: { content: { 'application/json': { data: infer D } } };
      }
    ? D
    : never;

export type QueueItem = Data<'OrganizationReportsController_queue_v1'>[number];
export type QueueCounts = Data<'OrganizationReportsController_counts_v1'>;
export type QueueTab =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'ACCEPTED'
  | 'IN_WORK'
  | 'TO_VERIFY'
  | 'RESOLVED'
  | 'CLOSED';
export type Worker = Data<'OrganizationWorkController_workers_v1'>[number];
export type Assignment = WorkspaceReport['assignments'][number];
export type VerificationOutcome = 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE';
export type WorkspaceReport = Data<'OrganizationReportsController_get_v1'>;
export type WorkspaceHistoryEntry = Data<'OrganizationReportsController_history_v1'>[number];
export type InternalNote = Data<'OrganizationReportsController_notes_v1'>[number];
export type OrganizationUpdate = Data<'OrganizationReportsController_updates_v1'>[number];
export type TransferTarget = Data<'OrganizationReportsController_transferTargets_v1'>[number];
export type RejectionReason = NonNullable<WorkspaceReport['rejection']>['reason'];

export const QUEUE_TABS: QueueTab[] = [
  'NEW',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'ACCEPTED',
  'IN_WORK',
  'TO_VERIFY',
  'RESOLVED',
  'CLOSED',
];
export const REJECTION_REASONS: RejectionReason[] = [
  'NOT_A_CIVIC_ISSUE',
  'INSUFFICIENT_INFORMATION',
  'ALREADY_FIXED',
  'INAPPROPRIATE_CONTENT',
  'NO_RESPONSE',
  'OTHER',
];

/**
 * Where a workspace reads from: an organization's review routes, or the Super Admin's
 * read-only (audited) view of any report.
 */
export type WorkspaceScope = { kind: 'organization'; organizationId: string } | { kind: 'admin' };

const scopeKey = (scope: WorkspaceScope) =>
  scope.kind === 'organization' ? scope.organizationId : 'admin';

export const reviewKeys = {
  all: ['review'] as const,
  queue: (organizationId: string, tab: QueueTab, page: number) =>
    ['review', organizationId, 'queue', tab, page] as const,
  counts: (organizationId: string) => ['review', organizationId, 'counts'] as const,
  report: (scope: WorkspaceScope, publicId: string) =>
    ['review', scopeKey(scope), 'report', publicId] as const,
};

const orgPath = (organizationId: string, publicId: string) => ({
  params: { path: { organizationId, publicId } },
});

export function useQueue(organizationId: string, tab: QueueTab, page: number) {
  return useQuery({
    queryKey: reviewKeys.queue(organizationId, tab, page),
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      const result = await apiClient().GET('/api/v1/organizations/{organizationId}/reports', {
        params: { path: { organizationId }, query: { tab, page, limit: 20 } },
      });
      const items = await callApi(() => Promise.resolve(result));
      const meta = (result.data as { meta?: { totalPages?: number } } | undefined)?.meta;
      return { items, totalPages: meta?.totalPages ?? 1 };
    },
  });
}

export function useQueueCounts(organizationId: string) {
  return useQuery({
    queryKey: reviewKeys.counts(organizationId),
    retry: false,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/reports/counts', {
          params: { path: { organizationId } },
        }),
      ),
  });
}

export function useWorkspaceReport(scope: WorkspaceScope, publicId: string) {
  return useQuery({
    queryKey: reviewKeys.report(scope, publicId),
    retry: false,
    queryFn: () =>
      scope.kind === 'organization'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/reports/{publicId}',
              orgPath(scope.organizationId, publicId),
            ),
          )
        : callApi(() =>
            apiClient().GET('/api/v1/admin/reports/{publicId}', {
              params: { path: { publicId } },
            }),
          ),
  });
}

export function useWorkspaceHistory(scope: WorkspaceScope, publicId: string) {
  return useQuery({
    queryKey: [...reviewKeys.report(scope, publicId), 'history'],
    queryFn: () =>
      scope.kind === 'organization'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/history',
              orgPath(scope.organizationId, publicId),
            ),
          )
        : callApi(() =>
            apiClient().GET('/api/v1/admin/reports/{publicId}/history', {
              params: { path: { publicId } },
            }),
          ),
  });
}

export function useNotes(scope: WorkspaceScope, publicId: string) {
  return useQuery({
    queryKey: [...reviewKeys.report(scope, publicId), 'notes'],
    queryFn: () =>
      scope.kind === 'organization'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/notes',
              orgPath(scope.organizationId, publicId),
            ),
          )
        : callApi(() =>
            apiClient().GET('/api/v1/admin/reports/{publicId}/notes', {
              params: { path: { publicId } },
            }),
          ),
  });
}

export function useOrganizationUpdates(scope: WorkspaceScope, publicId: string) {
  return useQuery({
    queryKey: [...reviewKeys.report(scope, publicId), 'updates'],
    queryFn: () =>
      scope.kind === 'organization'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/updates',
              orgPath(scope.organizationId, publicId),
            ),
          )
        : callApi(() =>
            apiClient().GET('/api/v1/admin/reports/{publicId}/updates', {
              params: { path: { publicId } },
            }),
          ),
  });
}

export function useTransferTargets(organizationId: string, publicId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['review', organizationId, 'report', publicId, 'targets'],
    enabled,
    queryFn: () =>
      callApi(() =>
        apiClient().GET(
          '/api/v1/organizations/{organizationId}/reports/{publicId}/transfer-targets',
          orgPath(organizationId, publicId),
        ),
      ),
  });
}

export type ReviewAction =
  | { kind: 'start-review' }
  | { kind: 'request-information'; message: string }
  | { kind: 'accept'; categoryId?: string; publicMessage?: string }
  | { kind: 'reject'; reason: RejectionReason; message: string }
  | { kind: 'transfer'; toOrganizationId: string | null; reason: string }
  | { kind: 'assign'; workerId: string; note?: string }
  | { kind: 'reassign'; workerId: string; reason: string; note?: string }
  | { kind: 'cancel-assignment'; reason: string }
  | { kind: 'verify'; outcome: VerificationOutcome; reason?: string }
  | { kind: 'reopen'; reason: string }
  | { kind: 'close' }
  | { kind: 'mark-duplicate'; canonicalPublicId: string; reason: string };

/**
 * One mutation for every review decision. Each sends the version the reviewer is looking at
 * (If-Match), so a decision made on a report someone else just changed is refused.
 */
export function useReviewAction(organizationId: string, publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, version }: { action: ReviewAction; version: number }) => {
      const params = {
        params: { path: { organizationId, publicId }, header: { 'If-Match': String(version) } },
      };
      const base = '/api/v1/organizations/{organizationId}/reports/{publicId}' as const;
      switch (action.kind) {
        case 'start-review':
          return callApi(() => apiClient().POST(`${base}/start-review`, params));
        case 'request-information':
          return callApi(() =>
            apiClient().POST(`${base}/request-information`, {
              ...params,
              body: { message: action.message },
            }),
          );
        case 'accept':
          return callApi(() =>
            apiClient().POST(`${base}/accept`, {
              ...params,
              body: { categoryId: action.categoryId, publicMessage: action.publicMessage },
            }),
          );
        case 'reject':
          return callApi(() =>
            apiClient().POST(`${base}/reject`, {
              ...params,
              body: { reason: action.reason, message: action.message },
            }),
          );
        case 'transfer':
          await callApi(() =>
            apiClient().POST(`${base}/transfer`, {
              ...params,
              body: { toOrganizationId: action.toOrganizationId, reason: action.reason },
            }),
          );
          return null;
        case 'assign':
          return callApi(() =>
            apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/assign', {
              ...params,
              body: { workerId: action.workerId, note: action.note },
            }),
          );
        case 'reassign':
          return callApi(() =>
            apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/reassign', {
              ...params,
              body: { workerId: action.workerId, reason: action.reason, note: action.note },
            }),
          );
        case 'cancel-assignment':
          return callApi(() =>
            apiClient().POST(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/cancel-assignment',
              { ...params, body: { reason: action.reason } },
            ),
          );
        case 'verify':
          return callApi(() =>
            apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/verify', {
              ...params,
              body: { outcome: action.outcome, reason: action.reason },
            }),
          );
        case 'reopen':
          return callApi(() =>
            apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/reopen', {
              ...params,
              body: { reason: action.reason },
            }),
          );
        case 'mark-duplicate':
          return callApi(() =>
            apiClient().POST(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/mark-duplicate',
              {
                ...params,
                body: { canonicalPublicId: action.canonicalPublicId, reason: action.reason },
              },
            ),
          );
        case 'close':
          return callApi(() =>
            apiClient().POST(
              '/api/v1/organizations/{organizationId}/reports/{publicId}/close',
              params,
            ),
          );
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}

export type RelatedReport = Data<'OrganizationReportsController_duplicates_v1'>[number];

/** Possible duplicates of a report, within the same organization. */
export function useDuplicateCandidates(organizationId: string, publicId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['review', organizationId, 'report', publicId, 'duplicates'],
    enabled,
    queryFn: () =>
      callApi(() =>
        apiClient().GET(
          '/api/v1/organizations/{organizationId}/reports/{publicId}/duplicates',
          orgPath(organizationId, publicId),
        ),
      ),
  });
}

/** The organization's reports within a distance of this one. */
export function useNearbySearch(
  organizationId: string,
  publicId: string,
  radius: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['review', organizationId, 'report', publicId, 'nearby', radius],
    enabled,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/reports/{publicId}/nearby', {
          params: { path: { organizationId, publicId }, query: { radius } },
        }),
      ),
  });
}

export function useDismissDuplicate(organizationId: string, publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { candidatePublicId: string; reason?: string }) =>
      callApi(() =>
        apiClient().POST(
          '/api/v1/organizations/{organizationId}/reports/{publicId}/dismiss-duplicate',
          { ...orgPath(organizationId, publicId), body },
        ),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}

export function useWorkers(organizationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['review', organizationId, 'workers'],
    enabled,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/workers', {
          params: { path: { organizationId } },
        }),
      ),
  });
}

export function useAddNote(organizationId: string, publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      callApi(() =>
        apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/notes', {
          ...orgPath(organizationId, publicId),
          body: { body },
        }),
      ),
    onSuccess: (notes) =>
      queryClient.setQueryData(
        [...reviewKeys.report({ kind: 'organization', organizationId }, publicId), 'notes'],
        notes,
      ),
  });
}

export function useAddUpdate(organizationId: string, publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      callApi(() =>
        apiClient().POST('/api/v1/organizations/{organizationId}/reports/{publicId}/updates', {
          ...orgPath(organizationId, publicId),
          body: { body },
        }),
      ),
    onSuccess: (updates) =>
      queryClient.setQueryData(
        [...reviewKeys.report({ kind: 'organization', organizationId }, publicId), 'updates'],
        updates,
      ),
  });
}

export function useHideUpdate(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, reason }: { updateId: string; reason: string }) =>
      callApi(() =>
        apiClient().POST('/api/v1/admin/reports/updates/{updateId}/hide', {
          params: { path: { updateId } },
          body: { reason },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...reviewKeys.report({ kind: 'admin' }, publicId), 'updates'],
      }),
  });
}
