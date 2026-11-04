import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiClient, callApi } from '@/lib/api/client';
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

type Body<Op extends keyof operations> = operations[Op] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type PublicReport = Data<'ReportsController_list_v1'>[number];
export type ReportView = Data<'ReportsController_get_v1'>;
export type OwnReport = Data<'ReportsController_create_v1'>;
export type HistoryEntry = Data<'ReportsController_history_v1'>[number];
export type TriageItem = Data<'AdminReportsController_triage_v1'>[number];
export type ReportStatus = PublicReport['status'];
export type CreateReportInput = Body<'ReportsController_create_v1'>;
export type UpdateReportInput = Body<'ReportsController_update_v1'>;
export type MediaView = Data<'MediaController_view_v1'>;

export function isOwnReport(report: ReportView): report is OwnReport {
  return 'version' in report;
}

export const reportKeys = {
  detail: (publicId: string) => ['reports', publicId] as const,
  history: (publicId: string) => ['reports', publicId, 'history'] as const,
};

export function useReport(publicId: string) {
  return useQuery({
    queryKey: reportKeys.detail(publicId),
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/reports/{publicId}', { params: { path: { publicId } } }),
      ),
    retry: false,
  });
}

export function useReportHistory(publicId: string, enabled: boolean) {
  return useQuery({
    queryKey: reportKeys.history(publicId),
    enabled,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/reports/{publicId}/history', { params: { path: { publicId } } }),
      ),
  });
}

export function useMyReports(status?: ReportStatus) {
  return useQuery({
    queryKey: ['reports', 'mine', status ?? 'all'],
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/reports/mine', {
          params: { query: { status, page: 1, limit: 50 } },
        }),
      ),
  });
}

export function useMySummary() {
  return useQuery({
    queryKey: ['reports', 'mine', 'summary'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/reports/mine/summary')),
  });
}

/** Public list; returns the items plus the total so pages can be counted. */
export function usePublicReports(query: {
  page: number;
  categoryId?: string;
  status?: ReportStatus;
}) {
  return useQuery({
    queryKey: ['reports', 'public', query],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await apiClient().GET('/api/v1/reports', {
        params: { query: { ...query, limit: 20 } },
      });
      const items = await callApi(() => Promise.resolve(result));
      const meta = (result.data as { meta?: { total?: number; totalPages?: number } } | undefined)
        ?.meta;
      return { items, total: meta?.total ?? items.length, totalPages: meta?.totalPages ?? 1 };
    },
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateReportInput; idempotencyKey: string }) =>
      callApi(() =>
        apiClient().POST('/api/v1/reports', {
          body,
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useUpdateReport(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateReportInput; version: number }) =>
      callApi(() =>
        apiClient().PATCH('/api/v1/reports/{publicId}', {
          params: { path: { publicId }, header: { 'If-Match': String(version) } },
          body,
        }),
      ),
    onSuccess: (report) => {
      queryClient.setQueryData(reportKeys.detail(publicId), report);
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
    },
  });
}

export function useWithdrawReport(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      callApi(() =>
        apiClient().POST('/api/v1/reports/{publicId}/withdraw', {
          params: { path: { publicId } },
          body: { reason },
        }),
      ),
    onSuccess: (report) => {
      queryClient.setQueryData(reportKeys.detail(publicId), report);
      void queryClient.invalidateQueries({ queryKey: reportKeys.history(publicId) });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
    },
  });
}

export function useTriage() {
  return useQuery({
    queryKey: ['reports', 'triage'],
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/admin/reports/triage', {
          params: { query: { page: 1, limit: 100 } },
        }),
      ),
  });
}

export function useRouteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      publicId,
      organizationId,
      reason,
    }: {
      publicId: string;
      organizationId: string;
      reason: string;
    }) =>
      callApi(() =>
        apiClient().POST('/api/v1/admin/reports/{publicId}/route', {
          params: { path: { publicId } },
          body: { organizationId, reason },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports', 'triage'] }),
  });
}

export function useVerifiedOrganizations() {
  return useQuery({
    queryKey: ['organizations', 'public-directory'],
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations', { params: { query: { page: 1, limit: 100 } } }),
      ),
  });
}

// ─── Photo uploads ─────────────────────────────────────────────────────────────

export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;

/** PUTs the file to the signed storage URL, reporting progress (fetch cannot). */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

/**
 * Uploads one photo: asks the API for a signed URL, sends the file straight to storage,
 * confirms, then waits for the server's checks (metadata removal, format validation).
 */
export async function uploadPhoto(
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<MediaView> {
  const contentType = file.type as (typeof ACCEPTED_PHOTO_TYPES)[number];
  const intent = await callApi(() =>
    apiClient().POST('/api/v1/media/upload-intent', { body: { contentType, byteSize: file.size } }),
  );
  await putWithProgress(intent.uploadUrl, file, contentType, onProgress);
  const params = { params: { path: { mediaId: intent.mediaId } } };
  let view = await callApi(() => apiClient().POST('/api/v1/media/{mediaId}/confirm', params));
  for (let attempt = 0; attempt < 60 && view.status === 'UPLOADED'; attempt += 1) {
    if (signal.aborted)
      throw new ApiClientError('NETWORK_ERROR', 'Cancelled', undefined, undefined);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    view = await callApi(() => apiClient().GET('/api/v1/media/{mediaId}', params));
  }
  return view;
}

export function removePhoto(mediaId: string) {
  return callApi(() =>
    apiClient().DELETE('/api/v1/media/{mediaId}', { params: { path: { mediaId } } }),
  );
}
