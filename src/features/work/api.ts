import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : never;

export type TaskItem = Data<'WorkController_tasks_v1'>[number];
export type Task = Data<'WorkController_task_v1'>;
export type WorkMembership = Data<'WorkController_memberships_v1'>[number];
export type TaskGroup = 'TO_ACCEPT' | 'ACTIVE' | 'WAITING' | 'DONE';
export const TASK_GROUPS: TaskGroup[] = ['TO_ACCEPT', 'ACTIVE', 'WAITING', 'DONE'];

const workKeys = {
  memberships: ['work', 'memberships'] as const,
  tasks: (group: TaskGroup, page: number) => ['work', 'tasks', group, page] as const,
  task: (id: string) => ['work', 'task', id] as const,
};

/** Organizations where the user is an active worker (empty for everyone else). */
export function useWorkMemberships(enabled = true) {
  return useQuery({
    queryKey: workKeys.memberships,
    enabled,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/work/memberships')),
  });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, available }: { organizationId: string; available: boolean }) =>
      callApi(() =>
        apiClient().PUT('/api/v1/work/memberships/{organizationId}/availability', {
          params: { path: { organizationId } },
          body: { available },
        }),
      ),
    onSuccess: (memberships) => queryClient.setQueryData(workKeys.memberships, memberships),
  });
}

export function useTasks(group: TaskGroup, page: number) {
  return useQuery({
    queryKey: workKeys.tasks(group, page),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await apiClient().GET('/api/v1/work/tasks', {
        params: { query: { group, page, limit: 20 } },
      });
      const items = await callApi(() => Promise.resolve(result));
      const meta = (result.data as { meta?: { totalPages?: number } } | undefined)?.meta;
      return { items, totalPages: meta?.totalPages ?? 1 };
    },
  });
}

export function useTask(assignmentId: string) {
  return useQuery({
    queryKey: workKeys.task(assignmentId),
    retry: false,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/work/tasks/{assignmentId}', {
          params: { path: { assignmentId } },
        }),
      ),
  });
}

export type TaskAction =
  | { kind: 'accept' }
  | { kind: 'decline'; reason: string }
  | { kind: 'start' }
  | { kind: 'progress'; message: string; mediaIds: string[] }
  | { kind: 'return'; reason: string }
  | { kind: 'complete'; description: string; mediaIds: string[] };

/** Every step the worker takes on a task; each returns the updated task. */
export function useTaskAction(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: TaskAction) => {
      const params = { params: { path: { assignmentId } } };
      const base = '/api/v1/work/tasks/{assignmentId}' as const;
      switch (action.kind) {
        case 'accept':
          return callApi(() => apiClient().POST(`${base}/accept`, params));
        case 'start':
          return callApi(() => apiClient().POST(`${base}/start`, params));
        case 'decline':
          return callApi(() =>
            apiClient().POST(`${base}/decline`, { ...params, body: { reason: action.reason } }),
          );
        case 'return':
          return callApi(() =>
            apiClient().POST(`${base}/return`, { ...params, body: { reason: action.reason } }),
          );
        case 'progress':
          return callApi(() =>
            apiClient().POST(`${base}/progress`, {
              ...params,
              body: { message: action.message, mediaIds: action.mediaIds },
            }),
          );
        case 'complete':
          return callApi(() =>
            apiClient().POST(`${base}/complete`, {
              ...params,
              body: { description: action.description, mediaIds: action.mediaIds },
            }),
          );
      }
    },
    onSuccess: (task) => {
      queryClient.setQueryData(workKeys.task(assignmentId), task);
      void queryClient.invalidateQueries({ queryKey: ['work', 'tasks'] });
    },
  });
}
