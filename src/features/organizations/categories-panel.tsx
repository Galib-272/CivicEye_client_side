'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { errorMessage } from '@/features/auth/server-errors';
import { useCategories, useSetCategories, type Category, type Scope } from './api';

export function categoryName(category: Category, locale: string): string {
  return locale === 'bn' ? category.nameBn : category.nameEn;
}

/** The categories an organization handles; editable by Org Admins and Super Admins. */
export function CategoriesPanel({
  scope,
  organizationId,
  selectedIds,
  canEdit,
}: {
  scope: Scope;
  organizationId: string;
  selectedIds: string[];
  canEdit: boolean;
}) {
  const t = useTranslations('Org');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const categories = useCategories();
  const save = useSetCategories(scope, organizationId);
  // Local edits start from the server's selection; null means "no unsaved edits".
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const selected = draft ?? new Set(selectedIds);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft(next);
  };

  if (!categories.data) {
    return (
      <Section title={t('categoriesHeading')}>
        <p aria-live="polite">{tCommon('loading')}</p>
      </Section>
    );
  }

  if (!canEdit) {
    const chosen = categories.data.filter((category) => selected.has(category.id));
    return (
      <Section title={t('categoriesHeading')}>
        {chosen.length === 0 ? (
          <p className="text-muted">{t('noCategories')}</p>
        ) : (
          <ul className="list-inside list-disc">
            {chosen.map((category) => (
              <li key={category.id}>{categoryName(category, locale)}</li>
            ))}
          </ul>
        )}
      </Section>
    );
  }

  return (
    <Section title={t('categoriesHeading')}>
      <p className="text-muted text-sm">{t('categoriesHint')}</p>
      {save.isError && <FormAlert tone="error">{errorMessage(save.error, tErrors)}</FormAlert>}
      {save.isSuccess && draft === null && <FormAlert tone="success">{t('saved')}</FormAlert>}
      <fieldset className="space-y-1">
        <legend className="sr-only">{t('categoriesHeading')}</legend>
        {categories.data.map((category) => (
          <label
            key={category.id}
            className={`flex items-center gap-2 ${category.parentId ? 'ps-6' : 'font-medium'}`}
          >
            <input
              type="checkbox"
              checked={selected.has(category.id)}
              onChange={() => toggle(category.id)}
            />
            <span>{categoryName(category, locale)}</span>
          </label>
        ))}
      </fieldset>
      <Button
        type="button"
        busy={save.isPending}
        disabled={draft === null}
        onClick={() => save.mutate([...selected], { onSuccess: () => setDraft(null) })}
      >
        {t('save')}
      </Button>
    </Section>
  );
}
