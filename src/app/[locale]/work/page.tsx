import { setRequestLocale } from 'next-intl/server';
import { WorkDashboardPage } from '@/features/work/work-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/work'>) {
  return privatePageMetadata(params, 'Work');
}

export default async function Page({ params }: PageProps<'/[locale]/work'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <WorkDashboardPage />;
}
