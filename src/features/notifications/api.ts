import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : never;

export type NotificationItem = Data<'NotificationsController_list_v1'>[number];
export type NotificationType = NotificationItem['type'];
export type Preferences = Data<'NotificationsController_preferences_v1'>;
export type DeliveryHealth = Data<'DeliveryHealthController_health_v1'>;

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  list: (page: number, unreadOnly: boolean) => ['notifications', 'list', page, unreadOnly] as const,
  preferences: ['notifications', 'preferences'] as const,
  health: ['notifications', 'health'] as const,
};

/** Unread count for the bell. Also polls every minute in case the live connection is down. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unread,
    enabled,
    refetchInterval: 60_000,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/notifications/unread-count')),
  });
}

export function useNotifications(page: number, unreadOnly: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(page, unreadOnly),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await apiClient().GET('/api/v1/notifications', {
        params: { query: { page, limit: 20, unread: unreadOnly ? 'true' : undefined } },
      });
      const items = await callApi(() => Promise.resolve(result));
      const meta = (result.data as { meta?: { totalPages?: number } } | undefined)?.meta;
      return { items, totalPages: meta?.totalPages ?? 1 };
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      callApi(() =>
        apiClient().PATCH('/api/v1/notifications/{notificationId}/read', {
          params: { path: { notificationId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callApi(() => apiClient().POST('/api/v1/notifications/read-all')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/notifications/preferences')),
  });
}

export function useSetPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Preferences) =>
      callApi(() => apiClient().PUT('/api/v1/notifications/preferences', { body })),
    onSuccess: (preferences) => queryClient.setQueryData(notificationKeys.preferences, preferences),
  });
}

/** A one-time ticket for opening the live connection (valid 60 seconds). */
export async function fetchRealtimeTicket(): Promise<string> {
  const { ticket } = await callApi(() => apiClient().POST('/api/v1/notifications/realtime-ticket'));
  return ticket;
}

export function useDeliveryHealth() {
  return useQuery({
    queryKey: notificationKeys.health,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/admin/delivery-health')),
  });
}

export function useRetryDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: 'event' | 'email'; id: string }) =>
      kind === 'event'
        ? callApi(() =>
            apiClient().POST('/api/v1/admin/delivery-health/events/{eventId}/retry', {
              params: { path: { eventId: id } },
            }),
          )
        : callApi(() =>
            apiClient().POST('/api/v1/admin/delivery-health/emails/{notificationId}/retry', {
              params: { path: { notificationId: id } },
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.health }),
  });
}
