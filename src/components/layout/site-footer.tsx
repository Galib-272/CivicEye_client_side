import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('Layout');

  return (
    <footer className="border-border text-muted border-t">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm">{t('footerNote')}</div>
    </footer>
  );
}
