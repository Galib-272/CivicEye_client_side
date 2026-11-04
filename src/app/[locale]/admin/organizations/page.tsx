import { setRequestLocale } from 'next-intl/server';
import { AdminOrganizationsPage } from '@/features/organizations/admin-organizations';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/organizations'>) {
  return privatePageMetadata(params, 'AdminOrgs', 'title');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/organizations'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AdminOrganizationsPage />;
}
