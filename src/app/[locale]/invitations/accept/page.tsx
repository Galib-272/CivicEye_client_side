import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageCard } from '@/components/ui/page-card';
import { AcceptInvitation } from '@/features/organizations/email-link-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/invitations/accept'>) {
  return privatePageMetadata(params, 'Invitation');
}

export default async function Page({ params }: PageProps<'/[locale]/invitations/accept'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale, namespace: 'Invitation' });
  return (
    <PageCard title={t('title')}>
      <AcceptInvitation />
    </PageCard>
  );
}
