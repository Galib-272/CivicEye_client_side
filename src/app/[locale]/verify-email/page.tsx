import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { VerifyEmail } from '@/features/auth/verify-email';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/verify-email'>) {
  return privatePageMetadata(params, 'VerifyEmail');
}

export default async function Page({ params }: PageProps<'/[locale]/verify-email'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'VerifyEmail' });
  return (
    <PageCard title={t('title')}>
      <VerifyEmail />
    </PageCard>
  );
}
