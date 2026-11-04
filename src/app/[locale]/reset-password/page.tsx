import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/reset-password'>) {
  return privatePageMetadata(params, 'Reset');
}

export default async function Page({ params }: PageProps<'/[locale]/reset-password'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'Reset' });
  return (
    <PageCard title={t('title')}>
      <ResetPasswordForm />
    </PageCard>
  );
}
