import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ReportDetail } from '@/features/reports/report-detail';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/reports/[publicId]'>;

// Not indexed: a report can turn private or be withdrawn after a crawler sees it.
export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Report');
}

// The report ID is only known per request, so it is read inside a Suspense boundary.
async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, publicId } = await params;
  setRequestLocale(locale as Locale);
  return <ReportDetail publicId={publicId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
