'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useUnreadCount } from './api';
import { LiveUpdates } from './live-updates';

/** Bell with the unread count; also keeps the live connection open while signed in. */
export function NotificationBell({ className }: { className: string }) {
  const t = useTranslations('Notifications');
  const unread = useUnreadCount(true);
  const count = unread.data?.count ?? 0;
  return (
    <>
      <LiveUpdates />
      <Link
        href="/notifications"
        className={`${className} inline-flex items-center gap-1`}
        aria-label={t('bell', { count })}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span className="bg-accent text-background min-w-5 rounded-full px-1.5 text-center text-xs font-bold">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </>
  );
}
