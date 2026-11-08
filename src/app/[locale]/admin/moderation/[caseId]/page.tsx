import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ModerationCasePage } from '@/features/insights/moderation';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/admin/moderation/[caseId]'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Moderation', 'queueTitle');
}

async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, caseId } = await params;
  setRequestLocale(locale as Locale);
  return <ModerationCasePage caseId={caseId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
