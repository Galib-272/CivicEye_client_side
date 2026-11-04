'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { useCategories } from '@/features/organizations/api';
import { categoryName } from '@/features/organizations/categories-panel';
import { Link } from '@/i18n/navigation';
import {
  useMyReports,
  useMySummary,
  usePublicReports,
  useRouteReport,
  useTriage,
  useVerifiedOrganizations,
  type PublicReport,
  type ReportStatus,
  type TriageItem,
} from './api';
import { StatusBadge } from './report-detail';

const STATUSES: ReportStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'ACCEPTED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WORK_COMPLETED',
  'PENDING_VERIFICATION',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'WITHDRAWN',
  'DUPLICATE',
];

function ReportCard({
  report,
  showPhotos = false,
}: {
  report: PublicReport;
  showPhotos?: boolean;
}) {
  const t = useTranslations('PublicReports');
  const tReport = useTranslations('Report');
  const locale = useLocale();
  const format = useFormatter();
  return (
    <li className="border-border space-y-1 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/reports/${report.publicId}`}
          className="text-accent font-medium underline underline-offset-4"
        >
          {report.title}
        </Link>
        <StatusBadge status={report.status} />
      </div>
      <p className="text-muted text-sm">
        {locale === 'bn' ? report.category.nameBn : report.category.nameEn} ·{' '}
        {tReport('submitted', {
          date: format.dateTime(new Date(report.submittedAt), { dateStyle: 'medium' }),
        })}
        {showPhotos && ` · ${t('photoCount', { count: report.photoCount })}`}
      </p>
      {report.locationDescription && <p className="text-sm">{report.locationDescription}</p>}
    </li>
  );
}

function MyReports() {
  const t = useTranslations('MyReports');
  const tStatus = useTranslations('ReportStatus');
  const tCommon = useTranslations('Common');
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const summary = useMySummary();
  const reports = useMyReports(status || undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link
          href="/reports/new"
          className="bg-accent text-background rounded-md px-4 py-2 font-medium"
        >
          {t('newReport')}
        </Link>
      </div>
      {summary.data && (
        <Section title={t('summary', { total: summary.data.total })}>
          <ul className="flex flex-wrap gap-3">
            {Object.entries(summary.data.byStatus).map(([key, count]) => (
              <li key={key} className="border-border rounded-md border px-3 py-2 text-sm">
                {tStatus(key as ReportStatus)}: <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <SelectField
        label={t('filter')}
        value={status}
        options={[
          { value: '', label: t('all') },
          ...STATUSES.map((value) => ({ value, label: tStatus(value) })),
        ]}
        onChange={(event) => setStatus(event.target.value as ReportStatus | '')}
        className="max-w-xs"
      />
      {!reports.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : reports.data.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {reports.data.map((report) => (
            <ReportCard key={report.publicId} report={report} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function MyReportsPage() {
  return <RequireAuth>{() => <MyReports />}</RequireAuth>;
}

export function PublicReportsPage() {
  const t = useTranslations('PublicReports');
  const tStatus = useTranslations('ReportStatus');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const categories = useCategories();
  const [filters, setFilters] = useState<{
    page: number;
    categoryId?: string;
    status?: ReportStatus;
  }>({ page: 1 });
  const reports = usePublicReports(filters);
  const pages = Math.max(1, reports.data?.totalPages ?? 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted">{t('intro')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t('allCategories')}
          hideLabel
          value={filters.categoryId ?? ''}
          options={[
            { value: '', label: t('allCategories') },
            ...(categories.data ?? []).map((category) => ({
              value: category.id,
              label: category.parentId
                ? `— ${categoryName(category, locale)}`
                : categoryName(category, locale),
            })),
          ]}
          onChange={(event) =>
            setFilters({
              page: 1,
              status: filters.status,
              categoryId: event.target.value || undefined,
            })
          }
        />
        <SelectField
          label={t('allStatuses')}
          hideLabel
          value={filters.status ?? ''}
          options={[
            { value: '', label: t('allStatuses') },
            ...STATUSES.filter((status) => status !== 'WITHDRAWN').map((value) => ({
              value,
              label: tStatus(value),
            })),
          ]}
          onChange={(event) =>
            setFilters({
              page: 1,
              categoryId: filters.categoryId,
              status: (event.target.value || undefined) as ReportStatus | undefined,
            })
          }
        />
      </div>
      {reports.isError ? (
        <FormAlert tone="error">{errorMessage(reports.error, tErrors)}</FormAlert>
      ) : !reports.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : reports.data.items.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {reports.data.items.map((report) => (
            <ReportCard key={report.publicId} report={report} showPhotos />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav
          aria-label={t('page', { page: filters.page, pages })}
          className="flex items-center gap-3"
        >
          <Button
            type="button"
            variant="secondary"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            {t('previous')}
          </Button>
          <span>{t('page', { page: filters.page, pages })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={filters.page >= pages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </div>
  );
}

function TriageRow({
  item,
  organizations,
}: {
  item: TriageItem;
  organizations: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('Triage');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const route = useRouteReport();
  const [organizationId, setOrganizationId] = useState(item.candidates[0]?.id ?? '');
  const [reason, setReason] = useState('');

  return (
    <li className="border-border space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/reports/${item.publicId}`}
          className="text-accent font-medium underline underline-offset-4"
        >
          {item.publicId} · {item.title}
        </Link>
        <span className="text-muted text-sm">
          {locale === 'bn' ? item.category.nameBn : item.category.nameEn}
        </span>
      </div>
      <p className="text-sm">
        {item.candidates.length
          ? t('candidates', {
              names: item.candidates.map((candidate) => candidate.name).join(', '),
            })
          : t('noCandidates')}
      </p>
      {item.locationDescription && <p className="text-muted text-sm">{item.locationDescription}</p>}
      {route.isError && <FormAlert tone="error">{errorMessage(route.error, tErrors)}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t('organization')}
          value={organizationId}
          options={[
            { value: '', label: t('chooseOrganization') },
            ...organizations.map((o) => ({ value: o.id, label: o.name })),
          ]}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <TextAreaField
          label={t('reason')}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <Button
        type="button"
        busy={route.isPending}
        disabled={!organizationId || reason.trim().length < 5}
        onClick={() =>
          route.mutate({ publicId: item.publicId, organizationId, reason: reason.trim() })
        }
      >
        {t('assign')}
      </Button>
    </li>
  );
}

function Triage() {
  const t = useTranslations('Triage');
  const tCommon = useTranslations('Common');
  const triage = useTriage();
  const organizations = useVerifiedOrganizations();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted">{t('intro')}</p>
      {!triage.data || !organizations.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : triage.data.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul className="space-y-4">
          {triage.data.map((item) => (
            <TriageRow key={item.publicId} item={item} organizations={organizations.data} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function TriagePage() {
  return <RequireSuperAdmin>{() => <Triage />}</RequireSuperAdmin>;
}
