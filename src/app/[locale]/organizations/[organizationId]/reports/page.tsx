import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ReviewQueuePage } from '@/features/review/review-queue';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/organizations/[organizationId]/reports'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Review', 'queueTitle');
}

// The organization ID is only known per request, so it is read inside a Suspense boundary.
async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, organizationId } = await params;
  setRequestLocale(locale as Locale);
  return <ReviewQueuePage organizationId={organizationId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
