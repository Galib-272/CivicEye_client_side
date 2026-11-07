import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicMapPage } from '@/features/map/public-map';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/map'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Map' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/map'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PublicMapPage />;
}
