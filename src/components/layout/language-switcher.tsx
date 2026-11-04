'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

// Language names are shown in their own language so every visitor can find theirs.
const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', bn: 'বাংলা' };

export function LanguageSwitcher() {
  const t = useTranslations('Layout');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('languageSwitcherLabel')}>
      <ul className="flex gap-1">
        {routing.locales.map((option) => {
          const current = option === locale;
          return (
            <li key={option}>
              <Link
                href={pathname}
                locale={option}
                lang={option}
                hrefLang={option}
                aria-current={current ? 'true' : undefined}
                className={`focus-ring rounded-md px-3 py-2 text-sm font-medium underline-offset-4 hover:underline ${
                  current ? 'bg-surface-strong text-foreground' : 'text-muted'
                }`}
              >
                {LANGUAGE_NAMES[option]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
