import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SystemStatus } from '@/features/system-status/system-status';
import type { Locale } from '@/i18n/routing';
import { isSystemStatusEnabled } from '@/lib/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/system-status'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'SystemStatus' });
  return { title: t('heading'), robots: { index: false, follow: false } };
}

/** Diagnostics page. Shown in development; hidden in production unless explicitly enabled. */
export default async function SystemStatusPage({ params }: PageProps<'/[locale]/system-status'>) {
  if (!isSystemStatusEnabled()) {
    notFound();
  }
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'SystemStatus' });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <p className="text-muted">{t('description')}</p>
      <SystemStatus />
    </div>
  );
}
