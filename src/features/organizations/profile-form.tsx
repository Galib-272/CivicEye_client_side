'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { TextAreaField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { useUpdateProfile, type Overview, type Scope } from './api';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Public profile editor. Super Admins can also change the name and official domain; Org
 * Admins edit the description and public contact details only.
 */
export function ProfileForm({
  scope,
  organization,
}: {
  scope: Scope;
  organization: Pick<
    Overview,
    | 'id'
    | 'name'
    | 'officialEmailDomain'
    | 'description'
    | 'website'
    | 'publicEmail'
    | 'publicPhone'
  >;
}) {
  const t = useTranslations('Org');
  const tFields = useTranslations('Org.fields');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const update = useUpdateProfile(scope, organization.id);
  const isAdmin = scope === 'admin';

  const schema = z.object({
    name: z.string().trim().min(2, tCommon('fieldRequired')).max(200),
    officialEmailDomain: z.string().trim().min(4, tCommon('fieldRequired')),
    description: z.string().max(2000),
    website: z.union([z.literal(''), z.url({ protocol: /^https$/ })], {
      error: tCommon('invalidUrl'),
    }),
    publicEmail: z.union([z.literal(''), z.email(tCommon('invalidEmail'))]),
    publicPhone: z.string().max(30),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: organization.name,
      officialEmailDomain: organization.officialEmailDomain,
      description: organization.description ?? '',
      website: organization.website ?? '',
      publicEmail: organization.publicEmail ?? '',
      publicPhone: organization.publicPhone ?? '',
    },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const profile = {
      description: blankToNull(values.description),
      website: blankToNull(values.website),
      publicEmail: blankToNull(values.publicEmail),
      publicPhone: blankToNull(values.publicPhone),
    };
    update.mutate(
      isAdmin
        ? {
            ...profile,
            name: values.name.trim(),
            officialEmailDomain: values.officialEmailDomain.trim(),
          }
        : profile,
    );
  });

  return (
    <Section title={t('profileHeading')}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {update.isSuccess && !isDirty && <FormAlert tone="success">{t('saved')}</FormAlert>}
        {update.isError && (
          <FormAlert tone="error">
            <p>{errorMessage(update.error, tErrors)}</p>
            {errorDetail(update.error) && <p className="text-sm">{errorDetail(update.error)}</p>}
          </FormAlert>
        )}
        {isAdmin && (
          <>
            <TextField
              label={tFields('name')}
              error={errors.name?.message}
              {...form.register('name')}
            />
            <TextField
              label={tFields('officialEmailDomain')}
              hint={tFields('officialEmailDomainHint')}
              error={errors.officialEmailDomain?.message}
              {...form.register('officialEmailDomain')}
            />
          </>
        )}
        <TextAreaField
          label={tFields('description')}
          error={errors.description?.message}
          {...form.register('description')}
        />
        <TextField
          label={tFields('website')}
          type="url"
          error={errors.website?.message}
          {...form.register('website')}
        />
        <TextField
          label={tFields('publicEmail')}
          type="email"
          error={errors.publicEmail?.message}
          {...form.register('publicEmail')}
        />
        <TextField
          label={tFields('publicPhone')}
          type="tel"
          error={errors.publicPhone?.message}
          {...form.register('publicPhone')}
        />
        <Button busy={update.isPending} disabled={!isDirty}>
          {update.isPending ? tCommon('saving') : t('save')}
        </Button>
      </form>
    </Section>
  );
}
