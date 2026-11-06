'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useDeliveryHealth,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  usePreferences,
  useRetryDelivery,
  useSetPreferences,
  type Preferences,
} from './api';

function Notifications() {
  const t = useTranslations('Notifications');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tPublic = useTranslations('PublicReports');
  const format = useFormatter();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotifications(page, unreadOnly);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button
          type="button"
          variant="secondary"
          busy={markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          {t('markAll')}
        </Button>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => {
            setUnreadOnly(event.target.checked);
            setPage(1);
          }}
        />
        <span>{t('unreadOnly')}</span>
      </label>
      {notifications.isError ? (
        <FormAlert tone="error">{errorMessage(notifications.error, tErrors)}</FormAlert>
      ) : !notifications.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : notifications.data.items.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {notifications.data.items.map((item) => (
            <li
              key={item.id}
              className={`rounded-md border p-3 ${item.read ? 'border-border' : 'border-accent border-s-4'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className={item.read ? '' : 'font-semibold'}>{t(`types.${item.type}`)}</p>
                  <p className="text-muted text-sm">
                    {item.reportPublicId && (
                      <span className="font-mono">
                        {t('report', { id: item.reportPublicId })} ·{' '}
                      </span>
                    )}
                    {format.dateTime(new Date(item.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!item.read && <Badge tone="warn">{t('unread')}</Badge>}
                  <Link
                    href={item.path}
                    className="text-accent underline underline-offset-4"
                    onClick={(event) => {
                      if (item.read) return;
                      event.preventDefault();
                      markRead.mutate(item.id, { onSettled: () => router.push(item.path) });
                    }}
                  >
                    {t('open')}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(notifications.data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {tPublic('previous')}
          </Button>
          <span>{tPublic('page', { page, pages: notifications.data?.totalPages ?? 1 })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= (notifications.data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            {tPublic('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  return <RequireAuth>{() => <Notifications />}</RequireAuth>;
}

const PREFERENCE_KEYS: Array<keyof Preferences> = [
  'emailMyReports',
  'emailMyTasks',
  'emailOrganization',
];

/** Email choices on the account page. */
export function EmailPreferences() {
  const t = useTranslations('Notifications');
  const tErrors = useTranslations('Errors');
  const preferences = usePreferences();
  const save = useSetPreferences();
  const [pending, setPending] = useState<Preferences | null>(null);
  const current = pending ?? preferences.data;
  if (!current) return null;

  return (
    <Section title={t('emailHeading')}>
      <p className="text-muted text-sm">{t('emailHint')}</p>
      {save.isError && <FormAlert tone="error">{errorMessage(save.error, tErrors)}</FormAlert>}
      <ul className="space-y-2">
        {PREFERENCE_KEYS.map((key) => (
          <li key={key}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={current[key]}
                disabled={save.isPending}
                onChange={(event) => {
                  const next = { ...current, [key]: event.target.checked };
                  setPending(next);
                  save.mutate(next, { onSettled: () => setPending(null) });
                }}
              />
              <span>{t(key)}</span>
            </label>
          </li>
        ))}
      </ul>
      {save.isSuccess && (
        <p role="status" className="text-sm">
          {t('saved')}
        </p>
      )}
    </Section>
  );
}

function DeliveryHealth() {
  const t = useTranslations('Notifications');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const health = useDeliveryHealth();
  const retry = useRetryDelivery();
  if (health.isError)
    return <FormAlert tone="error">{errorMessage(health.error, tErrors)}</FormAlert>;
  if (!health.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const { pendingEvents, failedEvents, failedEmails } = health.data;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('healthTitle')}</h1>
      <p className="text-muted">{t('healthIntro')}</p>
      <p>{t('pending', { count: pendingEvents })}</p>
      {retry.isError && <FormAlert tone="error">{errorMessage(retry.error, tErrors)}</FormAlert>}
      <Section title={t('failedEvents')}>
        {failedEvents.length === 0 ? (
          <p className="text-muted">{t('nothingFailed')}</p>
        ) : (
          <ul className="space-y-3">
            {failedEvents.map((event) => (
              <li key={event.id} className="border-border space-y-1 border-s-2 ps-3">
                <p className="font-mono text-sm">{event.type}</p>
                <p className="text-muted text-sm">
                  {date(event.createdAt)} · {t('attempts', { count: event.attempts })}
                </p>
                {event.lastError && (
                  <p className="text-sm">{t('lastError', { error: event.lastError })}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  busy={retry.isPending}
                  onClick={() => retry.mutate({ kind: 'event', id: event.id })}
                >
                  {t('retry')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('failedEmails')}>
        {failedEmails.length === 0 ? (
          <p className="text-muted">{t('nothingFailed')}</p>
        ) : (
          <ul className="space-y-3">
            {failedEmails.map((email) => (
              <li key={email.notificationId} className="border-border space-y-1 border-s-2 ps-3">
                <p className="text-sm">{t(`types.${email.type}`)}</p>
                <p className="text-muted text-sm">
                  {date(email.lastAttemptAt)} · {t('attempts', { count: email.failedAttempts })}
                </p>
                {email.lastError && (
                  <p className="text-sm">{t('lastError', { error: email.lastError })}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  busy={retry.isPending}
                  onClick={() => retry.mutate({ kind: 'email', id: email.notificationId })}
                >
                  {t('retry')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function DeliveryHealthPage() {
  return <RequireSuperAdmin>{() => <DeliveryHealth />}</RequireSuperAdmin>;
}
