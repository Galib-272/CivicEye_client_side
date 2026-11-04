import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicReportsPage } from '@/features/reports/report-lists';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reports'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PublicReports' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/reports'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PublicReportsPage />;
}
