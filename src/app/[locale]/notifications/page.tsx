import { setRequestLocale } from 'next-intl/server';
import { NotificationsPage } from '@/features/notifications/notifications-page';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/notifications'>) {
  return privatePageMetadata(params, 'Notifications');
}

export default async function Page({ params }: PageProps<'/[locale]/notifications'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NotificationsPage />;
}
