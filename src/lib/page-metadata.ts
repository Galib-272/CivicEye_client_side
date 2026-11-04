import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** Page title from a translation key; account pages are never indexed by search engines. */
export async function privatePageMetadata(
  params: Promise<{ locale: string }>,
  namespace: string,
  key = 'title',
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  return { title: t(key), robots: { index: false, follow: false } };
}
