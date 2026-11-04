import { setRequestLocale } from 'next-intl/server';
import { AdminCategoriesPage } from '@/features/organizations/admin-categories';
import type { Locale } from '@/i18n/routing';
import { privatePageMetadata } from '@/lib/page-metadata';

export function generateMetadata({ params }: PageProps<'/[locale]/admin/categories'>) {
  return privatePageMetadata(params, 'AdminCategories', 'title');
}

export default async function Page({ params }: PageProps<'/[locale]/admin/categories'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AdminCategoriesPage />;
}
