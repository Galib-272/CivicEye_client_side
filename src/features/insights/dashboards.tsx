'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { StatusBadge } from '@/features/reports/report-detail';
import { useWorkMemberships } from '@/features/work/api';
import { Link } from '@/i18n/navigation';
import {
  useCitizenDashboard,
  useOrganizationAnalytics,
  usePlatformAnalytics,
  useWorkerDashboard,
  type Range,
} from './api';
import { BarList, DurationCard, RangePicker, Stats, WeekChart } from './charts';

type ReportStatus = Parameters<typeof StatusBadge>[0]['status'];

function Loading({ error }: { error?: unknown }) {
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  if (error) return <FormAlert tone="error">{errorMessage(error, tErrors)}</FormAlert>;
  return <p aria-live="polite">{tCommon('loading')}</p>;
}

function useDate() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── My dashboard (citizen and worker) ────────────────────────────────────────

function CitizenSection() {
  const t = useTranslations('Insights');
  const tStatus = useTranslations('ReportStatus');
  const date = useDate();
  const dashboard = useCitizenDashboard();
  if (!dashboard.data) return <Loading error={dashboard.error} />;
  const data = dashboard.data;
  return (
    <Section title={t('myReports')}>
      <Stats
        items={[
          { label: t('total'), value: data.total },
          { label: t('open'), value: data.open },
          { label: t('resolved'), value: data.resolved },
          { label: t('unread'), value: data.unreadNotifications },
        ]}
      />
      <BarList
        empty={t('noReportsYet')}
        items={Object.entries(data.byStatus).map(([status, count]) => ({
          key: status,
          label: tStatus(status as ReportStatus),
          value: count,
        }))}
      />
      <h3 className="font-semibold">{t('recentActivity')}</h3>
      {data.recentActivity.length === 0 ? (
        <p className="text-muted">{t('noActivity')}</p>
      ) : (
        <ul className="space-y-2">
          {data.recentActivity.map((item) => (
            <li
              key={`${item.reportPublicId}-${item.at}`}
              className="flex flex-wrap items-center gap-2"
            >
              <Link
                href={`/reports/${item.reportPublicId}`}
                className="text-accent underline underline-offset-4"
              >
                {item.reportTitle}
              </Link>
              <StatusBadge status={item.status as ReportStatus} />
              <span className="text-muted text-sm">{date(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/reports/mine" className="text-accent text-sm underline underline-offset-4">
        {t('allMyReports')}
      </Link>
    </Section>
  );
}

function WorkerSection() {
  const t = useTranslations('Insights');
  const tWork = useTranslations('Work');
  const date = useDate();
  const dashboard = useWorkerDashboard(true);
  if (!dashboard.data) return <Loading error={dashboard.error} />;
  const data = dashboard.data;
  return (
    <Section title={t('myTasks')}>
      <Stats
        items={[
          { label: t('pending'), value: data.pending },
          { label: t('active'), value: data.active },
          { label: t('awaitingVerification'), value: data.awaitingVerification },
          { label: t('completedTotal'), value: data.completedTotal },
          { label: t('completed30'), value: data.completedLast30Days },
          { label: t('overdue'), value: data.overdue },
        ]}
      />
      {data.overdue > 0 && (
        <FormAlert tone="info">{t('overdueHint', { count: data.overdue })}</FormAlert>
      )}
      <div className="max-w-sm">
        <DurationCard title={t('completionTime')} duration={data.completion} />
      </div>
      <h3 className="font-semibold">{t('recentTasks')}</h3>
      {data.recent.length === 0 ? (
        <p className="text-muted">{t('noTasks')}</p>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((task) => (
            <li key={task.assignmentId} className="flex flex-wrap items-center gap-2">
              <Link
                href={`/work/${task.assignmentId}`}
                className="text-accent underline underline-offset-4"
              >
                {task.reportTitle}
              </Link>
              <span className="text-sm">{tWork(`states.${task.state}` as 'states.PENDING')}</span>
              <span className="text-muted text-sm">
                {task.organizationName} · {date(task.assignedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function MyDashboard() {
  const t = useTranslations('Insights');
  const memberships = useWorkMemberships();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('myTitle')}</h1>
      <CitizenSection />
      {(memberships.data?.length ?? 0) > 0 && <WorkerSection />}
    </div>
  );
}

export function MyDashboardPage() {
  return <RequireAuth>{() => <MyDashboard />}</RequireAuth>;
}

// ─── Organization dashboard ───────────────────────────────────────────────────

function OrganizationDashboard({ organizationId }: { organizationId: string }) {
  const t = useTranslations('Insights');
  const tStatus = useTranslations('ReportStatus');
  const locale = useLocale();
  const [range, setRange] = useState<Range>({});
  const analytics = useOrganizationAnalytics(organizationId, range);
  if (!analytics.data) return <Loading error={analytics.error} />;
  const data = analytics.data;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/organizations/${organizationId}`}
          className="text-accent text-sm underline underline-offset-4"
        >
          {t('backToOrganization')}
        </Link>
        <h1 className="text-2xl font-bold">{t('organizationTitle')}</h1>
        <p className="text-muted">{t('definitionsNote')}</p>
      </div>
      {analytics.isError && <Loading error={analytics.error} />}

      <Section title={t('backlogNow')}>
        <Stats
          items={[
            { label: t('awaitingReview'), value: data.backlog.awaitingReview },
            { label: t('waitingForCitizen'), value: data.backlog.waitingForCitizen },
            { label: t('acceptedNotAssigned'), value: data.backlog.accepted },
            { label: t('inProgress'), value: data.backlog.inProgress },
            { label: t('awaitingVerification'), value: data.backlog.awaitingVerification },
          ]}
        />
        <BarList
          empty={t('nothingOpen')}
          items={Object.entries(data.backlog.byStatus).map(([status, count]) => ({
            key: status,
            label: tStatus(status as ReportStatus),
            value: count,
          }))}
        />
      </Section>

      <Section title={t('inRange', { from: data.range.from, to: data.range.to })}>
        <RangePicker
          key={`${data.range.from}-${data.range.to}`}
          value={data.range}
          onChange={setRange}
        />
        <Stats
          items={[
            { label: t('received'), value: data.volume.received },
            { label: t('accepted'), value: data.volume.accepted },
            { label: t('rejected'), value: data.volume.rejected },
            { label: t('resolvedInRange'), value: data.volume.resolved },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <DurationCard title={t('reviewTime')} duration={data.times.review} />
          <DurationCard title={t('resolutionTime')} duration={data.times.resolution} />
          <DurationCard title={t('assignmentTime')} duration={data.times.assignment} />
          <DurationCard title={t('completionTime')} duration={data.times.completion} />
        </div>
        <h3 className="font-semibold">{t('byCategory')}</h3>
        <BarList
          empty={t('noneInRange')}
          items={data.categories.map((category) => ({
            key: category.id,
            label: locale === 'bn' ? category.nameBn : category.nameEn,
            value: category.count,
          }))}
        />
        <h3 className="font-semibold">{t('byArea')}</h3>
        <BarList
          empty={t('noneInRange')}
          items={data.areas.map((area) => ({
            key: area.id ?? 'outside',
            label: area.id ? area.name : t('outsideAreas'),
            value: area.count,
          }))}
        />
      </Section>

      <Section title={t('workload')}>
        {data.workers.length === 0 ? (
          <p className="text-muted">{t('noWorkers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 text-start">
                    {t('worker')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('pending')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('active')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('awaitingVerification')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('verifiedInRange')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.workers.map((worker) => (
                  <tr key={worker.userId} className="border-border border-b">
                    <th scope="row" className="py-2 text-start font-normal">
                      {worker.name}
                      {!worker.available && (
                        <span className="text-muted"> · {t('unavailable')}</span>
                      )}
                    </th>
                    <td className="py-2 text-end tabular-nums">{worker.pending}</td>
                    <td className="py-2 text-end tabular-nums">{worker.active}</td>
                    <td className="py-2 text-end tabular-nums">{worker.awaitingVerification}</td>
                    <td className="py-2 text-end tabular-nums">{worker.verifiedInRange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t('trend')}>
        <WeekChart
          caption={t('trend')}
          weeks={data.trend}
          series={[
            { key: 'received', label: t('received'), className: 'bg-accent' },
            { key: 'resolved', label: t('resolvedInRange'), className: 'bg-emerald-600' },
          ]}
        />
      </Section>
    </div>
  );
}

export function OrganizationAnalyticsPage({ organizationId }: { organizationId: string }) {
  return (
    <RequireAuth>{() => <OrganizationDashboard organizationId={organizationId} />}</RequireAuth>
  );
}

// ─── Platform dashboard (Super Admin) ─────────────────────────────────────────

function PlatformDashboard() {
  const t = useTranslations('Insights');
  const format = useFormatter();
  const tStatus = useTranslations('ReportStatus');
  const tModeration = useTranslations('Moderation');
  const locale = useLocale();
  const [range, setRange] = useState<Range>({});
  const analytics = usePlatformAnalytics(range);
  if (!analytics.data) return <Loading error={analytics.error} />;
  const data = analytics.data;
  const openCases = ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'].reduce(
    (sum, status) => sum + (data.moderation.byStatus[status] ?? 0),
    0,
  );
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t('platformTitle')}</h1>
        <p className="text-muted">{t('definitionsNote')}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/moderation" className="text-accent underline underline-offset-4">
            {t('moderationLink', { count: openCases })}
          </Link>
          <Link href="/admin/audit" className="text-accent underline underline-offset-4">
            {t('auditLink')}
          </Link>
          <Link href="/admin/delivery-health" className="text-accent underline underline-offset-4">
            {t('deliveryLink')}
          </Link>
        </div>
      </div>

      <Section title={t('now')}>
        <Stats
          items={[
            { label: t('users'), value: data.users.total },
            { label: t('organizations'), value: data.organizations.total },
            { label: t('verifiedOrganizations'), value: data.organizations.verified },
            { label: t('activeOrganizations'), value: data.organizations.active },
            { label: t('reports'), value: data.reports.total },
            { label: t('inTriage'), value: data.reports.inTriage },
            { label: t('openCases'), value: openCases },
          ]}
        />
        <h3 className="font-semibold">{t('reportsByStatus')}</h3>
        <BarList
          empty={t('noReportsYet')}
          items={Object.entries(data.reports.byStatus).map(([status, count]) => ({
            key: status,
            label: tStatus(status as ReportStatus),
            value: count,
          }))}
        />
        <h3 className="font-semibold">{t('moderationWorkload')}</h3>
        <BarList
          empty={t('noCasesYet')}
          items={Object.entries(data.moderation.byStatus).map(([status, count]) => ({
            key: status,
            label: tModeration(`status.${status}` as 'status.OPEN'),
            value: count,
          }))}
        />
      </Section>

      <Section title={t('inRange', { from: data.range.from, to: data.range.to })}>
        <RangePicker
          key={`${data.range.from}-${data.range.to}`}
          value={data.range}
          onChange={setRange}
        />
        <Stats
          items={[
            { label: t('submitted'), value: data.reports.submittedInRange },
            { label: t('newUsers'), value: data.users.newInRange },
            { label: t('flags'), value: data.moderation.flagsInRange },
          ]}
        />
        <h3 className="font-semibold">{t('byCategory')}</h3>
        <BarList
          empty={t('noneInRange')}
          items={data.reports.byCategory.map((category) => ({
            key: category.id,
            label: locale === 'bn' ? category.nameBn : category.nameEn,
            value: category.count,
          }))}
        />
        <h3 className="font-semibold">{t('byOrganizationArea')}</h3>
        <BarList
          empty={t('noneInRange')}
          items={data.geography.map((row) => ({
            key: row.id ?? 'none',
            label: row.id ? row.name : t('noOrganization'),
            value: row.count,
          }))}
        />
      </Section>

      <Section title={t('performance')}>
        {data.organizationPerformance.length === 0 ? (
          <p className="text-muted">{t('noOrganizations')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 text-start">
                    {t('organization')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('received')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('resolvedInRange')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('backlog')}
                  </th>
                  <th scope="col" className="py-2 text-end">
                    {t('medianResolution')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.organizationPerformance.map((row) => (
                  <tr key={row.organizationId} className="border-border border-b">
                    <th scope="row" className="py-2 text-start font-normal">
                      {row.name}
                    </th>
                    <td className="py-2 text-end tabular-nums">{row.received}</td>
                    <td className="py-2 text-end tabular-nums">{row.resolved}</td>
                    <td className="py-2 text-end tabular-nums">{row.backlog}</td>
                    <td className="py-2 text-end tabular-nums">
                      {row.resolution.count === 0
                        ? '—'
                        : row.resolution.enoughData
                          ? t('hours', {
                              value: format.number(row.resolution.medianHours ?? 0, {
                                maximumFractionDigits: 1,
                              }),
                            })
                          : t('fewCases', { count: row.resolution.count })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t('activity')}>
        <WeekChart
          caption={t('activity')}
          weeks={data.activity}
          series={[
            { key: 'submitted', label: t('submitted'), className: 'bg-accent' },
            { key: 'resolved', label: t('resolvedInRange'), className: 'bg-emerald-600' },
            { key: 'newUsers', label: t('newUsers'), className: 'bg-amber-500' },
          ]}
        />
      </Section>
    </div>
  );
}

export function PlatformAnalyticsPage() {
  return <RequireSuperAdmin>{() => <PlatformDashboard />}</RequireSuperAdmin>;
}
