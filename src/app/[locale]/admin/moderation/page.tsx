import { setRequestLocale } from 'next-intl/server';
import { ModerationQueuePage } from '@/features/insights/moderation';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/moderation'>) {
  return privatePageMetadata(params, 'Moderation', 'queueTitle');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/moderation'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ModerationQueuePage />;
}
