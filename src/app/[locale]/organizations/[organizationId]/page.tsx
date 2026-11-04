import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { WorkspacePage } from '@/features/organizations/workspace';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

type Props = PageProps<'/[locale]/organizations/[organizationId]'>;

export function generateMetadata({ params }: Props) {
  return privatePageMetadata(params, 'Workspace', 'title');
}

// The organization ID is only known per request, so it is read inside a Suspense boundary.
async function Content({ params }: Pick<Props, 'params'>) {
  const { locale, organizationId } = await params;
  setRequestLocale(locale as Locale);
  return <WorkspacePage organizationId={organizationId} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
