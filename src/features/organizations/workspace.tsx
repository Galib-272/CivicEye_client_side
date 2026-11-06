'use client';

import { useTranslations } from 'next-intl';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { RequireAuth } from '@/features/auth/require-auth';
import { errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import { useMyOrganizations, useOverview } from './api';
import { CategoriesPanel } from './categories-panel';
import { MembersPanel } from './members-panel';
import { ProfileForm } from './profile-form';
import { ServiceAreasPanel } from './service-areas-panel';

function Workspace({ organizationId }: { organizationId: string }) {
  const t = useTranslations('Org');
  const tStates = useTranslations('VerificationState');
  const tRoles = useTranslations('Roles');
  const tTypes = useTranslations('OrganizationTypes');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tReview = useTranslations('Review');
  const overview = useOverview(organizationId);

  // Non-members get NOT_FOUND from the API, so they see the same message as a missing page.
  if (overview.isError) {
    return <FormAlert tone="error">{errorMessage(overview.error, tErrors)}</FormAlert>;
  }
  if (!overview.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const organization = overview.data;
  const isAdmin = organization.myRole === 'ORG_ADMIN';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{organization.name}</h1>
      <Section title={t('overviewHeading')}>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-sm">{t('state')}</dt>
            <dd>
              <Badge tone={organization.verificationState === 'VERIFIED' ? 'good' : 'warn'}>
                {tStates(organization.verificationState)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t('fields.type')}</dt>
            <dd>{tTypes(organization.type)}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t('fields.officialEmailDomain')}</dt>
            <dd>{organization.officialEmailDomain}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t('membersHeading')}</dt>
            <dd>{organization.memberCount}</dd>
          </div>
        </dl>
        {organization.myRole && (
          <p className="text-muted text-sm">
            {t('yourRole', { role: tRoles(organization.myRole) })}
          </p>
        )}
        {(organization.myRole === 'ORG_ADMIN' || organization.myRole === 'ORG_REVIEWER') && (
          <Link
            href={`/organizations/${organization.id}/reports`}
            className="bg-accent text-background focus-ring inline-block rounded-md px-4 py-2 font-medium"
          >
            {tReview('openQueue')}
          </Link>
        )}
      </Section>
      {isAdmin && <ProfileForm scope="member" organization={organization} />}
      <MembersPanel scope="member" organizationId={organization.id} canManage={isAdmin} />
      <CategoriesPanel
        scope="member"
        organizationId={organization.id}
        selectedIds={organization.categoryIds}
        canEdit={isAdmin}
      />
      <ServiceAreasPanel scope="member" organizationId={organization.id} />
    </div>
  );
}

export function WorkspacePage({ organizationId }: { organizationId: string }) {
  return <RequireAuth>{() => <Workspace organizationId={organizationId} />}</RequireAuth>;
}

/** "My organizations" list for the account page. */
export function MyOrganizations() {
  const t = useTranslations('Workspace');
  const tRoles = useTranslations('Roles');
  const tStates = useTranslations('VerificationState');
  const tCommon = useTranslations('Common');
  const organizations = useMyOrganizations();

  return (
    <Section title={t('myOrganizations')}>
      {!organizations.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : organizations.data.length === 0 ? (
        <p className="text-muted">{t('noOrganizations')}</p>
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
                  {tRoles(organization.role)} · {tStates(organization.verificationState)}
                </p>
              </div>
              {organization.isActive && (
                <Link
                  href={`/organizations/${organization.id}`}
                  className="text-accent underline underline-offset-4"
                  aria-label={`${t('open')}: ${organization.name}`}
                >
                  {t('open')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
