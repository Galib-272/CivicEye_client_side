'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { Link } from '@/i18n/navigation';
import { useResetPassword } from './api';
import { useClearFragment, useFragmentToken } from './navigation';
import { applyFieldErrors, errorMessage } from './server-errors';

export function ResetPasswordForm() {
  const t = useTranslations('Reset');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const reset = useResetPassword();
  // undefined = not read yet; null = missing from the link. The token stays in memory only.
  const token = useFragmentToken();
  useClearFragment();

  const schema = z
    .object({
      newPassword: z
        .string()
        .min(12, tErrors('PASSWORD_TOO_SHORT'))
        .max(128, tErrors('PASSWORD_TOO_LONG')),
      confirmPassword: z.string(),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: tCommon('passwordsDontMatch'),
    });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  if (token === undefined) return <p aria-live="polite">{tCommon('loading')}</p>;
  if (token === null) {
    return (
      <div className="space-y-4">
        <FormAlert tone="error">{t('missingToken')}</FormAlert>
        <Link href="/forgot-password" className="text-accent underline underline-offset-4">
          {t('title')}
        </Link>
      </div>
    );
  }
  if (reset.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t('success')}</FormAlert>
        <Link href="/sign-in" className="text-accent underline underline-offset-4">
          {tCommon('backToSignIn')}
        </Link>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(({ newPassword }) =>
    reset.mutate(
      { token, newPassword },
      { onError: (error) => applyFieldErrors(error, form.setError, ['newPassword'], tErrors) },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {reset.isError && !errors.newPassword && (
        <FormAlert tone="error">{errorMessage(reset.error, tErrors)}</FormAlert>
      )}
      <TextField
        label={t('newPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...form.register('newPassword')}
      />
      <TextField
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <Button busy={reset.isPending} className="w-full">
        {reset.isPending ? tCommon('loading') : t('submit')}
      </Button>
    </form>
  );
}
