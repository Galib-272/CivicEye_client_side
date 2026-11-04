import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { ReportFormPage } from '@/features/reports/report-form';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/reports/new'>) {
  return privatePageMetadata(params, 'ReportForm');
}

export default async function Page({ params }: PageProps<'/[locale]/reports/new'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'ReportForm' });
  return (
    <PageCard title={t('title')}>
      <ReportFormPage />
    </PageCard>
  );
}
