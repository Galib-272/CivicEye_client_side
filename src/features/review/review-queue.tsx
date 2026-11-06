'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { RequireAuth } from '@/features/auth/require-auth';
import { errorMessage } from '@/features/auth/server-errors';
import { StatusBadge } from '@/features/reports/report-detail';
import { Link } from '@/i18n/navigation';
import { QUEUE_TABS, useQueue, useQueueCounts, type QueueTab } from './api';

function ReviewQueue({ organizationId }: { organizationId: string }) {
  const t = useTranslations('Review');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tPublic = useTranslations('PublicReports');
  const locale = useLocale();
  const format = useFormatter();
  const [tab, setTab] = useState<QueueTab>('NEW');
  const [page, setPage] = useState(1);
  const counts = useQueueCounts(organizationId);
  const queue = useQueue(organizationId, tab, page);

  // Non-reviewers and other organizations get NOT_FOUND from the API.
  if (counts.isError) {
    return <FormAlert tone="error">{errorMessage(counts.error, tErrors)}</FormAlert>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/organizations/${organizationId}`}
          className="text-accent text-sm underline underline-offset-4"
        >
          {t('backToOrganization')}
        </Link>
        <h1 className="text-2xl font-bold">{t('queueTitle')}</h1>
        <p className="text-muted">{t('queueIntro')}</p>
      </div>

      <nav aria-label={t('tabsLabel')}>
        <ul className="flex flex-wrap gap-2">
          {QUEUE_TABS.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-current={tab === value ? 'page' : undefined}
                onClick={() => {
                  setTab(value);
                  setPage(1);
                }}
                className={`focus-ring rounded-md border px-3 py-2 text-sm font-medium ${
                  tab === value ? 'bg-accent text-background border-accent' : 'border-border'
                }`}
              >
                {t('tabLabel', { tab: t(`tabs.${value}`), count: counts.data?.[value] ?? 0 })}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {queue.isError ? (
        <FormAlert tone="error">{errorMessage(queue.error, tErrors)}</FormAlert>
      ) : !queue.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : queue.data.items.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {queue.data.items.map((item) => (
            <li key={item.publicId} className="border-border space-y-1 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/organizations/${organizationId}/reports/${item.publicId}`}
                  className="text-accent font-medium underline underline-offset-4"
                >
                  {item.title}
                </Link>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-muted text-sm">
                <span className="font-mono">{item.publicId}</span> ·{' '}
                {locale === 'bn' ? item.category.nameBn : item.category.nameEn} ·{' '}
                {format.dateTime(new Date(item.submittedAt), { dateStyle: 'medium' })} ·{' '}
                {tPublic('photoCount', { count: item.photoCount })}
              </p>
              {item.locationDescription && <p className="text-sm">{item.locationDescription}</p>}
            </li>
          ))}
        </ul>
      )}

      {(queue.data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {tPublic('previous')}
          </Button>
          <span>{tPublic('page', { page, pages: queue.data?.totalPages ?? 1 })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= (queue.data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            {tPublic('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReviewQueuePage({ organizationId }: { organizationId: string }) {
  return <RequireAuth>{() => <ReviewQueue organizationId={organizationId} />}</RequireAuth>;
}
