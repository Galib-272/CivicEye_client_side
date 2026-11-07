'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { StatusBadge } from '@/features/reports/report-detail';
import { PhotoGrid } from '@/features/work/assignment-history';
import { Link } from '@/i18n/navigation';
import {
  useDismissDuplicate,
  useDuplicateCandidates,
  useNearbySearch,
  useReviewAction,
  type RelatedReport,
  type WorkspaceReport,
} from './api';

const RADII = [50, 100, 200, 500, 1000];

function RelatedRow({
  organizationId,
  related,
  canMark,
  canDismiss,
  onMark,
  onDismiss,
  busy,
}: {
  organizationId: string;
  related: RelatedReport;
  canMark: boolean;
  canDismiss: boolean;
  onMark: (reason: string) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const t = useTranslations('Duplicates');
  const tReport = useTranslations('Report');
  const locale = useLocale();
  const format = useFormatter();
  const [reason, setReason] = useState('');
  return (
    <li className="border-border space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/organizations/${organizationId}/reports/${related.publicId}`}
          className="text-accent font-medium underline underline-offset-4"
        >
          {related.publicId} · {related.title}
        </Link>
        <StatusBadge status={related.status} />
      </div>
      <p className="text-muted text-sm">
        {t('distance', { meters: related.distanceM })} ·{' '}
        {locale === 'bn' ? related.category.nameBn : related.category.nameEn} ·{' '}
        {format.dateTime(new Date(related.submittedAt), { dateStyle: 'medium' })}
      </p>
      <PhotoGrid
        photos={related.photos}
        alt={(index) => tReport('photoAlt', { number: index + 1 })}
      />
      {(canMark || canDismiss) && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t('decide')}</summary>
          <div className="mt-2 space-y-2">
            <TextAreaField
              label={t('reason')}
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {canMark && (
                <Button
                  type="button"
                  busy={busy}
                  disabled={reason.trim().length < 10}
                  onClick={() => onMark(reason.trim())}
                >
                  {t('markAsDuplicate')}
                </Button>
              )}
              {canDismiss && (
                <Button type="button" variant="secondary" busy={busy} onClick={onDismiss}>
                  {t('notDuplicate')}
                </Button>
              )}
            </div>
            {canMark && <p className="text-muted text-sm">{t('finalHint')}</p>}
          </div>
        </details>
      )}
    </li>
  );
}

/**
 * Possible duplicates (same category family, nearby, recent) and a free distance search, both
 * limited to the reviewer's organization. Linking is final and needs a reason.
 */
export function DuplicatesPanel({
  organizationId,
  report,
}: {
  organizationId: string;
  report: WorkspaceReport;
}) {
  const t = useTranslations('Duplicates');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const candidates = useDuplicateCandidates(organizationId, report.publicId, true);
  const [radius, setRadius] = useState(200);
  const [searching, setSearching] = useState(false);
  const nearby = useNearbySearch(organizationId, report.publicId, radius, searching);
  const action = useReviewAction(organizationId, report.publicId);
  const dismiss = useDismissDuplicate(organizationId, report.publicId);
  const canMark = report.actions.markDuplicate;
  const error = action.error ?? dismiss.error;

  const mark = (canonicalPublicId: string, reason: string) =>
    action.mutate({
      action: { kind: 'mark-duplicate', canonicalPublicId, reason },
      version: report.version,
    });

  return (
    <Section title={t('heading')}>
      <p className="text-muted text-sm">{t('hint')}</p>
      {error && (
        <FormAlert tone="error">
          <p>{errorMessage(error, tErrors)}</p>
          {errorDetail(error) && <p className="text-sm">{errorDetail(error)}</p>}
        </FormAlert>
      )}
      {!candidates.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : candidates.data.length === 0 ? (
        <p className="text-muted">{t('none')}</p>
      ) : (
        <ul className="space-y-3">
          {candidates.data.map((related) => (
            <RelatedRow
              key={related.publicId}
              organizationId={organizationId}
              related={related}
              canMark={canMark}
              canDismiss
              busy={action.isPending || dismiss.isPending}
              onMark={(reason) => mark(related.publicId, reason)}
              onDismiss={() => dismiss.mutate({ candidatePublicId: related.publicId })}
            />
          ))}
        </ul>
      )}

      <details onToggle={(event) => setSearching((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-medium">{t('searchNearby')}</summary>
        <div className="mt-3 space-y-3">
          <SelectField
            label={t('radius')}
            value={String(radius)}
            options={RADII.map((value) => ({
              value: String(value),
              label: t('meters', { meters: value }),
            }))}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="max-w-xs"
          />
          {searching && !nearby.data ? (
            <p aria-live="polite">{tCommon('loading')}</p>
          ) : nearby.data?.length === 0 ? (
            <p className="text-muted">{t('nothingNearby')}</p>
          ) : (
            <ul className="space-y-3">
              {nearby.data?.map((related) => (
                <RelatedRow
                  key={related.publicId}
                  organizationId={organizationId}
                  related={related}
                  canMark={
                    canMark && !['DUPLICATE', 'WITHDRAWN', 'REJECTED'].includes(related.status)
                  }
                  canDismiss={false}
                  busy={action.isPending}
                  onMark={(reason) => mark(related.publicId, reason)}
                  onDismiss={() => undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </details>
    </Section>
  );
}
