'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import { useCategories, useCreateCategory, useUpdateCategory } from './api';
import { categoryName } from './categories-panel';

function CreateCategoryForm() {
  const t = useTranslations('AdminCategories');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const categories = useCategories(true);
  const create = useCreateCategory();

  const schema = z.object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('slugHint'))
      .max(60),
    nameEn: z.string().trim().min(2, tCommon('fieldRequired')).max(100),
    nameBn: z.string().trim().min(2, tCommon('fieldRequired')).max(100),
    parentId: z.string(),
    displayOrder: z.coerce.number().int().min(0).max(10_000),
  });
  type Input = z.input<typeof schema>;
  type Output = z.output<typeof schema>;
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: { parentId: '', displayOrder: 100 },
  });
  const { errors } = form.formState;
  const parents = (categories.data ?? []).filter((category) => !category.parentId);

  const onSubmit = form.handleSubmit(({ parentId, ...values }) =>
    create.mutate(
      { ...values, parentId: parentId || null },
      { onSuccess: () => form.reset({ parentId: '', displayOrder: 100 }) },
    ),
  );

  return (
    <Section title={t('createHeading')}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {create.isSuccess && <FormAlert tone="success">{t('created')}</FormAlert>}
        {create.isError && (
          <FormAlert tone="error">
            <p>{errorMessage(create.error, tErrors)}</p>
            {errorDetail(create.error) && <p className="text-sm">{errorDetail(create.error)}</p>}
          </FormAlert>
        )}
        <TextField
          label={t('slug')}
          hint={t('slugHint')}
          error={errors.slug?.message}
          {...form.register('slug')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('nameEn')}
            error={errors.nameEn?.message}
            {...form.register('nameEn')}
          />
          <TextField
            label={t('nameBn')}
            lang="bn"
            error={errors.nameBn?.message}
            {...form.register('nameBn')}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={t('parent')}
            options={[
              { value: '', label: t('noParent') },
              ...parents.map((parent) => ({
                value: parent.id,
                label: categoryName(parent, locale),
              })),
            ]}
            {...form.register('parentId')}
          />
          <TextField
            label={t('order')}
            type="number"
            inputMode="numeric"
            error={errors.displayOrder?.message}
            {...form.register('displayOrder')}
          />
        </div>
        <Button busy={create.isPending}>{t('create')}</Button>
      </form>
    </Section>
  );
}

/** Duplicate search distance for one category; empty means "use the parent's, then 50 m". */
function RadiusEditor({
  categoryId,
  name,
  value,
}: {
  categoryId: string;
  name: string;
  value: number | null;
}) {
  const t = useTranslations('AdminCategories');
  const update = useUpdateCategory();
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const parsed = draft.trim() === '' ? null : Number(draft);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 10 && parsed <= 1000);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) update.mutate({ categoryId, duplicateRadiusM: parsed });
      }}
    >
      <TextField
        label={t('radius', { name })}
        hideLabel
        placeholder={t('radiusInherited')}
        type="number"
        inputMode="numeric"
        min={10}
        max={1000}
        className="w-28"
        value={draft}
        error={valid ? undefined : t('radiusRange')}
        onChange={(event) => setDraft(event.target.value)}
      />
      <span className="text-muted pb-2 text-sm">m</span>
      <Button type="submit" variant="secondary" busy={update.isPending} disabled={!valid}>
        {update.isSuccess ? t('radiusSaved') : t('radiusSave')}
      </Button>
    </form>
  );
}

function CategoryList() {
  const t = useTranslations('AdminCategories');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const categories = useCategories(true);
  const update = useUpdateCategory();

  return (
    <Section title={t('title')}>
      <p className="text-muted text-sm">{t('reviewNote')}</p>
      {update.isError && <FormAlert tone="error">{errorMessage(update.error, tErrors)}</FormAlert>}
      {!categories.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : (
        <ul className="divide-border divide-y">
          {categories.data.map((category) => (
            <li
              key={category.id}
              className={`flex flex-wrap items-center justify-between gap-2 py-2 ${category.parentId ? 'ps-6' : ''}`}
            >
              <div>
                <p className={category.parentId ? '' : 'font-medium'}>
                  {category.nameEn} · <span lang="bn">{category.nameBn}</span>
                </p>
                <p className="text-muted font-mono text-sm">{category.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RadiusEditor
                  categoryId={category.id}
                  name={category.nameEn}
                  value={category.duplicateRadiusM}
                />
                <Badge tone={category.isActive ? 'good' : 'neutral'}>
                  {category.isActive ? t('active') : t('inactive')}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`${category.isActive ? t('deactivate') : t('activate')}: ${category.nameEn}`}
                  busy={update.isPending && update.variables?.categoryId === category.id}
                  onClick={() =>
                    update.mutate({ categoryId: category.id, isActive: !category.isActive })
                  }
                >
                  {category.isActive ? t('deactivate') : t('activate')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function AdminCategoriesPage() {
  const t = useTranslations('AdminCategories');
  const tOrgs = useTranslations('AdminOrgs');
  return (
    <RequireSuperAdmin>
      {() => (
        <div className="space-y-6">
          <Link
            href="/admin/organizations"
            className="text-accent text-sm underline underline-offset-4"
          >
            ← {tOrgs('back')}
          </Link>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <CreateCategoryForm />
          <CategoryList />
        </div>
      )}
    </RequireSuperAdmin>
  );
}
