import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { ConfirmContact } from '@/features/organizations/email-link-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/organization-contact/confirm'>) {
  return privatePageMetadata(params, 'ContactConfirm');
}

export default async function Page({
  params,
}: PageProps<'/[locale]/organization-contact/confirm'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'ContactConfirm' });
  return (
    <PageCard title={t('title')}>
      <ConfirmContact />
    </PageCard>
  );
}
