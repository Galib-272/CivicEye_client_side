'use client';

import { useTranslations } from 'next-intl';
import { FormAlert } from '@/components/ui/form-alert';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import { useAdminOrganization } from './api';
import { CategoriesPanel } from './categories-panel';
import { MembersPanel } from './members-panel';
import { ProfileForm } from './profile-form';
import { ServiceAreasPanel } from './service-areas-panel';
import { VerificationPanel } from './verification-panel';

function Detail({ organizationId }: { organizationId: string }) {
  const t = useTranslations('AdminOrgs');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const organization = useAdminOrganization(organizationId);

  if (organization.isError) {
    return <FormAlert tone="error">{errorMessage(organization.error, tErrors)}</FormAlert>;
  }
  if (!organization.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const data = organization.data;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/organizations"
        className="text-accent text-sm underline underline-offset-4"
      >
        ← {t('back')}
      </Link>
      <h1 className="text-2xl font-bold">{data.name}</h1>
      <VerificationPanel organization={data} />
      <ProfileForm scope="admin" organization={data} />
      <MembersPanel scope="admin" organizationId={data.id} canManage />
      <CategoriesPanel
        scope="admin"
        organizationId={data.id}
        selectedIds={data.categoryIds}
        canEdit
      />
      <ServiceAreasPanel scope="admin" organizationId={data.id} />
    </div>
  );
}

export function AdminOrganizationDetailPage({ organizationId }: { organizationId: string }) {
  return <RequireSuperAdmin>{() => <Detail organizationId={organizationId} />}</RequireSuperAdmin>;
}
