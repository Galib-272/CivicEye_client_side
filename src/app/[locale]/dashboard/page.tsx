import { setRequestLocale } from 'next-intl/server';
import { MyDashboardPage } from '@/features/insights/dashboards';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/dashboard'>) {
  return privatePageMetadata(params, 'Insights', 'myTitle');
}

export default async function Page({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <MyDashboardPage />;
}
