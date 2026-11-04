'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFormatter, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { applyFieldErrors, errorDetail, errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import {
  useAdminOrganizations,
  useCreateOrganization,
  useOverlaps,
  type VerificationState,
} from './api';

const STATES: VerificationState[] = [
  'UNVERIFIED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
];

function CreateOrganizationForm() {
  const t = useTranslations('AdminOrgs');
  const tFields = useTranslations('Org.fields');
  const tTypes = useTranslations('OrganizationTypes');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const create = useCreateOrganization();

  const schema = z.object({
    name: z.string().trim().min(2, tCommon('fieldRequired')).max(200),
    officialEmailDomain: z.string().trim().min(4, tCommon('fieldRequired')).max(253),
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(
      { ...values, type: 'CITY_CORPORATION' },
      {
        onSuccess: () => form.reset(),
        onError: (error) =>
          applyFieldErrors(error, form.setError, ['name', 'officialEmailDomain'], tErrors),
      },
    ),
  );

  return (
    <Section title={t('createHeading')}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {create.isSuccess && (
          <FormAlert tone="success">
            {t('created')}{' '}
            <Link href={`/admin/organizations/${create.data.id}`} className="underline">
              {t('manage')}
            </Link>
          </FormAlert>
        )}
        {create.isError && Object.keys(errors).length === 0 && (
          <FormAlert tone="error">
            <p>{errorMessage(create.error, tErrors)}</p>
            {errorDetail(create.error) && <p className="text-sm">{errorDetail(create.error)}</p>}
          </FormAlert>
        )}
        <TextField
          label={tFields('name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label={tFields('officialEmailDomain')}
          hint={tFields('officialEmailDomainHint')}
          error={errors.officialEmailDomain?.message}
          {...form.register('officialEmailDomain')}
        />
        <p className="text-muted text-sm">
          {tFields('type')}: {tTypes('CITY_CORPORATION')}
        </p>
        <Button busy={create.isPending}>{t('create')}</Button>
      </form>
    </Section>
  );
}

function OverlapsSection() {
  const t = useTranslations('AdminOrgs');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const overlaps = useOverlaps();
  return (
    <Section title={t('overlapsHeading')}>
      <p className="text-muted text-sm">{t('overlapNote')}</p>
      {!overlaps.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : overlaps.data.length === 0 ? (
        <p>{t('noOverlaps')}</p>
      ) : (
        <ul className="list-inside list-disc space-y-1">
          {overlaps.data.map((overlap) => (
            <li key={`${overlap.areaId}-${overlap.otherAreaId}`}>
              {t('overlapItem', {
                a: overlap.areaName,
                orgA: overlap.organizationName,
                b: overlap.otherAreaName,
                orgB: overlap.otherOrganizationName,
                area: format.number(overlap.overlapSqKm, { maximumFractionDigits: 2 }),
              })}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function OrganizationList() {
  const t = useTranslations('AdminOrgs');
  const tStates = useTranslations('VerificationState');
  const tOrg = useTranslations('Org');
  const tCommon = useTranslations('Common');
  const [q, setQ] = useState('');
  const [state, setState] = useState<VerificationState | ''>('');
  const query = useDeferredValue({
    q: q.trim() || undefined,
    verificationState: state || undefined,
  });
  const organizations = useAdminOrganizations(query);

  return (
    <Section title={t('listHeading')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t('search')}
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <SelectField
          label={t('stateFilter')}
          value={state}
          options={[
            { value: '', label: t('allStates') },
            ...STATES.map((value) => ({ value, label: tStates(value) })),
          ]}
          onChange={(event) => setState(event.target.value as VerificationState | '')}
        />
      </div>
      {!organizations.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : organizations.data.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="divide-border divide-y">
          {organizations.data.map((organization) => (
            <li
              key={organization.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">{organization.name}</p>
                <p className="text-muted text-sm">
                  {organization.officialEmailDomain} ·{' '}
                  {tOrg('memberCount', { count: organization.memberCount })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={organization.verificationState === 'VERIFIED' ? 'good' : 'neutral'}>
                  {tStates(organization.verificationState)}
                </Badge>
                <Link
                  href={`/admin/organizations/${organization.id}`}
                  className="text-accent underline underline-offset-4"
                  aria-label={`${t('manage')}: ${organization.name}`}
                >
                  {t('manage')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function AdminOrganizationsPage() {
  const t = useTranslations('AdminOrgs');
  return (
    <RequireSuperAdmin>
      {() => (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <Link href="/admin/categories" className="text-accent underline underline-offset-4">
              {t('categoriesNav')}
            </Link>
          </div>
          <CreateOrganizationForm />
          <OrganizationList />
          <OverlapsSection />
        </div>
      )}
    </RequireSuperAdmin>
  );
}
