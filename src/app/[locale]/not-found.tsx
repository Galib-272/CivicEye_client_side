import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <p className="text-muted">{t('body')}</p>
      <Link href="/" className="text-accent focus-ring rounded-sm underline underline-offset-4">
        {t('home')}
      </Link>
    </div>
  );
}
