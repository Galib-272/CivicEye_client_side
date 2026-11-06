import { setRequestLocale } from 'next-intl/server';
import { DeliveryHealthPage } from '@/features/notifications/notifications-page';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/delivery-health'>) {
  return privatePageMetadata(params, 'Notifications', 'healthTitle');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/delivery-health'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <DeliveryHealthPage />;
}
