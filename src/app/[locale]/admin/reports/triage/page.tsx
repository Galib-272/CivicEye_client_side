import { setRequestLocale } from 'next-intl/server';
import { TriagePage } from '@/features/reports/report-lists';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/reports/triage'>) {
  return privatePageMetadata(params, 'Triage');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/reports/triage'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <TriagePage />;
}
