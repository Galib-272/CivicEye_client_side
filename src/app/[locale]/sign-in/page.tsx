import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { PageCard } from '@/components/ui/page-card';
import { SignInForm } from '@/features/auth/sign-in-form';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/sign-in'>) {
  return privatePageMetadata(params, 'SignIn');
}

export default async function SignInPage({ params }: PageProps<'/[locale]/sign-in'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'SignIn' });
  return (
    <PageCard title={t('title')}>
      {/* Reads ?next= from the URL, so it renders on the client. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </PageCard>
  );
}
