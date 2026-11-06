import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AdminReportPage } from '@/features/review/review-workspace';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/admin/reports/[publicId]'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Review', 'adminTitle');
}

async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, publicId } = await params;
  setRequestLocale(locale as Locale);
  return <AdminReportPage publicId={publicId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
