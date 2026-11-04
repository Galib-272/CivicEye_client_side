import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TwoFactorSetupGuarded } from '@/features/auth/guarded-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/two-factor/setup'>) {
  return privatePageMetadata(params, 'TwoFactor', 'setupTitle');
}

export default async function Page({ params }: PageProps<'/[locale]/two-factor/setup'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'TwoFactor' });
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t('setupTitle')}</h1>
      <TwoFactorSetupGuarded />
    </div>
  );
}
