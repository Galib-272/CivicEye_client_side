import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ReviewWorkspacePage } from '@/features/review/review-workspace';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/organizations/[organizationId]/reports/[publicId]'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Review', 'queueTitle');
}

async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, organizationId, publicId } = await params;
  setRequestLocale(locale as Locale);
  return <ReviewWorkspacePage organizationId={organizationId} publicId={publicId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
