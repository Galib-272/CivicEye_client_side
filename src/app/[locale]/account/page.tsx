import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountSettingsGuarded } from '@/features/auth/guarded-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/account'>) {
  return privatePageMetadata(params, 'Account', 'title');
}

export default async function Page({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'Account' });
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <AccountSettingsGuarded />
    </div>
  );
}
