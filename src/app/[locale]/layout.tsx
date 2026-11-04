import type { Metadata } from 'next';
import { Noto_Sans, Noto_Sans_Bengali } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { QueryProvider } from '@/components/providers/query-provider';
import { routing } from '@/i18n/routing';
import '../globals.css';

const latin = Noto_Sans({ variable: '--font-latin', subsets: ['latin'], display: 'swap' });
const bengali = Noto_Sans_Bengali({
  variable: '--font-bengali',
  subsets: ['bengali'],
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Layout' });

  return (
    <html lang={locale} className={`${latin.variable} ${bengali.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main-content"
          className="bg-accent text-background sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
          <QueryProvider>
            <SiteHeader />
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"
            >
              {children}
            </main>
            <SiteFooter />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
