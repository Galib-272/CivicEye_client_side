import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { OrganizationAnalyticsPage } from '@/features/insights/dashboards';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/organizations/[organizationId]/analytics'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Insights', 'organizationTitle');
}

async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, organizationId } = await params;
  setRequestLocale(locale as Locale);
  return <OrganizationAnalyticsPage organizationId={organizationId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
