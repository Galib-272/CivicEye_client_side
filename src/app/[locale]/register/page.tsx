import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { RegisterForm } from '@/features/auth/register-form';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/register'>) {
  return privatePageMetadata(params, 'Register');
}

export default async function Page({ params }: PageProps<'/[locale]/register'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'Register' });
  return (
    <PageCard title={t('title')}>
      <RegisterForm />
    </PageCard>
  );
}
