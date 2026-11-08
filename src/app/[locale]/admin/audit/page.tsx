import { setRequestLocale } from 'next-intl/server';
import { AdminAuditPage } from '@/features/insights/audit';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/audit'>) {
  return privatePageMetadata(params, 'Audit', 'title');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/audit'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AdminAuditPage />;
}
