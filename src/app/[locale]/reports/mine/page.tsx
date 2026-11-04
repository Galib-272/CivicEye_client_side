import { setRequestLocale } from 'next-intl/server';
import { MyReportsPage } from '@/features/reports/report-lists';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/reports/mine'>) {
  return privatePageMetadata(params, 'MyReports');
}

export default async function Page({ params }: PageProps<'/[locale]/reports/mine'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <MyReportsPage />;
}
