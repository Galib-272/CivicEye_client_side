import { setRequestLocale } from 'next-intl/server';
import { PlatformAnalyticsPage } from '@/features/insights/dashboards';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/analytics'>) {
  return privatePageMetadata(params, 'Insights', 'platformTitle');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/analytics'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PlatformAnalyticsPage />;
}
