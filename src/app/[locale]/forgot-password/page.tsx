import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/forgot-password'>) {
  return privatePageMetadata(params, 'Forgot');
}

export default async function Page({ params }: PageProps<'/[locale]/forgot-password'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'Forgot' });
  return (
    <PageCard title={t('title')}>
      <ForgotPasswordForm />
    </PageCard>
  );
}
