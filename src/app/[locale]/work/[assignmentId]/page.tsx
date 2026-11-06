import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TaskPage } from '@/features/work/work-pages';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/work/[assignmentId]'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Work');
}

// The task ID is only known per request, so it is read inside a Suspense boundary.
async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, assignmentId } = await params;
  setRequestLocale(locale as Locale);
  return <TaskPage assignmentId={assignmentId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
