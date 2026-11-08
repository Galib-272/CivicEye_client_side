'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { SelectField } from '@/components/ui/select-field';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import {
  useAdminAudit,
  useAuditActions,
  useOrganizationAudit,
  type AuditEntry,
  type AuditFilters,
} from './api';

function Filters({
  value,
  onChange,
  actions,
}: {
  value: AuditFilters;
  onChange: (next: AuditFilters) => void;
  actions: string[] | undefined;
}) {
  const t = useTranslations('Audit');
  const field = 'border-border bg-background focus-ring rounded-md border px-3 py-2';
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      aria-label={t('filters')}
      onSubmit={(event) => event.preventDefault()}
    >
      {actions ? (
        <SelectField
          label={t('action')}
          value={value.action ?? ''}
          onChange={(event) =>
            onChange({ ...value, action: event.target.value || undefined, page: 1 })
          }
          options={[
            { value: '', label: t('anyAction') },
            ...actions.map((a) => ({ value: a, label: a })),
          ]}
        />
      ) : (
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{t('action')}</span>
          <input
            className={field}
            value={value.action ?? ''}
            placeholder="report.accepted"
            onChange={(event) =>
              onChange({ ...value, action: event.target.value || undefined, page: 1 })
            }
          />
        </label>
      )}
      <SelectField
        label={t('result')}
        value={value.result ?? ''}
        onChange={(event) =>
          onChange({
            ...value,
            result: (event.target.value || undefined) as AuditFilters['result'],
            page: 1,
          })
        }
        options={[
          { value: '', label: t('anyResult') },
          { value: 'SUCCESS', label: t('success') },
          { value: 'FAILURE', label: t('failure') },
        ]}
      />
      <label className="space-y-1 text-sm">
        <span className="block font-medium">{t('from')}</span>
        <input
          type="date"
          className={field}
          value={value.from ?? ''}
          onChange={(event) =>
            onChange({ ...value, from: event.target.value || undefined, page: 1 })
          }
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">{t('to')}</span>
        <input
          type="date"
          className={field}
          value={value.to ?? ''}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined, page: 1 })}
        />
      </label>
    </form>
  );
}

function Entries({
  data,
  page,
  onPage,
}: {
  data: { items: AuditEntry[]; total: number; totalPages: number } | undefined;
  page: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('Audit');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  if (!data) return <p aria-live="polite">{tCommon('loading')}</p>;
  if (data.items.length === 0) return <p className="text-muted">{t('empty')}</p>;
  return (
    <div className="space-y-3">
      <p className="text-muted text-sm">{t('count', { count: data.total })}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-2 pe-3 text-start">
                {t('when')}
              </th>
              <th scope="col" className="py-2 pe-3 text-start">
                {t('action')}
              </th>
              <th scope="col" className="py-2 pe-3 text-start">
                {t('who')}
              </th>
              <th scope="col" className="py-2 pe-3 text-start">
                {t('target')}
              </th>
              <th scope="col" className="py-2 text-start">
                {t('details')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((entry) => (
              <tr key={entry.id} className="border-border border-b align-top">
                <td className="py-2 pe-3 whitespace-nowrap">
                  {format.dateTime(new Date(entry.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className="py-2 pe-3">
                  <span className="font-mono">{entry.action}</span>
                  {entry.result !== 'SUCCESS' && (
                    <span className="text-muted"> · {t('failure')}</span>
                  )}
                </td>
                <td className="py-2 pe-3">{entry.actor ? entry.actor.name : t('system')}</td>
                <td className="py-2 pe-3 font-mono text-xs break-all">
                  {entry.targetType ? `${entry.targetType} ${entry.targetId ?? ''}` : '—'}
                </td>
                <td className="py-2">
                  {entry.reason && <p>{t('reason', { reason: entry.reason })}</p>}
                  {entry.metadata !== null && entry.metadata !== undefined && (
                    <details>
                      <summary className="text-muted cursor-pointer">{t('more')}</summary>
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                      {entry.ipAddress && (
                        <p className="text-muted text-xs">IP {entry.ipAddress}</p>
                      )}
                      {entry.requestId && (
                        <p className="text-muted text-xs">
                          {t('requestId', { id: entry.requestId })}
                        </p>
                      )}
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {tCommon('previous')}
          </Button>
          <span className="text-sm">{t('page', { page, total: data.totalPages })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= data.totalPages}
            onClick={() => onPage(page + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function AdminAudit() {
  const t = useTranslations('Audit');
  const tErrors = useTranslations('Errors');
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 });
  const entries = useAdminAudit(filters);
  const actions = useAuditActions();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/admin/analytics" className="text-accent text-sm underline underline-offset-4">
          {t('backToDashboard')}
        </Link>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </div>
      <Filters value={filters} onChange={setFilters} actions={actions.data} />
      {entries.isError && (
        <FormAlert tone="error">{errorMessage(entries.error, tErrors)}</FormAlert>
      )}
      <Entries
        data={entries.data}
        page={filters.page}
        onPage={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}

export function AdminAuditPage() {
  return <RequireSuperAdmin>{() => <AdminAudit />}</RequireSuperAdmin>;
}

function OrganizationAudit({ organizationId }: { organizationId: string }) {
  const t = useTranslations('Audit');
  const tErrors = useTranslations('Errors');
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 });
  const entries = useOrganizationAudit(organizationId, filters);
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
        <p className="text-muted">{t('organizationIntro')}</p>
      </div>
      <Filters value={filters} onChange={setFilters} actions={undefined} />
      {entries.isError ? (
        <FormAlert tone="error">{errorMessage(entries.error, tErrors)}</FormAlert>
      ) : (
        <Entries
          data={entries.data}
          page={filters.page}
          onPage={(page) => setFilters({ ...filters, page })}
        />
      )}
    </div>
  );
}

export function OrganizationAuditPage({ organizationId }: { organizationId: string }) {
  return <RequireAuth>{() => <OrganizationAudit organizationId={organizationId} />}</RequireAuth>;
}
