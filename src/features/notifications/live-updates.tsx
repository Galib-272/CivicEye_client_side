'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { parsePublicEnv } from '@/lib/env';
import { fetchRealtimeTicket, notificationKeys } from './api';

/**
 * Keeps the signed-in user's pages fresh. The server only says that something changed (no
 * data), and the affected queries are fetched again through the normal API. Each connection
 * attempt asks for a new one-time ticket; if the connection is down, the bell still polls.
 */
export function LiveUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(parsePublicEnv().NEXT_PUBLIC_API_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: (send) => {
        fetchRealtimeTicket()
          .then((ticket) => send({ ticket }))
          .catch(() => send({}));
      },
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 60_000,
    });
    socket.on('notifications.changed', () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
    socket.on('data.changed', () => {
      for (const key of ['reports', 'review', 'work']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return null;
}
