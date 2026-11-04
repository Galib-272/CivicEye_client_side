import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import type { Locale } from '@/i18n/routing';

export default function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations('Home');

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{t('heading')}</h1>
      <p className="text-muted text-lg leading-relaxed">{t('intro')}</p>
      <p
        className="border-border bg-notice-bg text-notice-fg rounded-md border px-4 py-3"
        role="note"
      >
        {t('developmentNotice')}
      </p>
      <p className="text-muted text-sm">{t('emergencyNotice')}</p>
    </div>
  );
}
