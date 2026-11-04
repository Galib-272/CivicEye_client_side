'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { Link } from '@/i18n/navigation';
import { useRegister } from './api';
import { applyFieldErrors, errorMessage } from './server-errors';

export function RegisterForm() {
  const t = useTranslations('Register');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tLanguages = useTranslations('Languages');
  const locale = useLocale() as 'en' | 'bn';
  const register = useRegister();

  const schema = z
    .object({
      name: z.string().trim().min(1, tCommon('fieldRequired')).max(100, tCommon('nameTooLong')),
      email: z.email(tCommon('invalidEmail')),
      password: z
        .string()
        .min(12, tErrors('PASSWORD_TOO_SHORT'))
        .max(128, tErrors('PASSWORD_TOO_LONG')),
      confirmPassword: z.string(),
      preferredLocale: z.enum(['en', 'bn']),
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: tCommon('passwordsDontMatch'),
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { preferredLocale: locale },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ confirmPassword: _confirm, ...values }) =>
    register.mutate(values, {
      onError: (error) =>
        applyFieldErrors(error, form.setError, ['password', 'name', 'email'], tErrors),
    }),
  );

  if (register.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">
          <p className="font-semibold">{t('doneTitle')}</p>
          <p>{t('doneBody')}</p>
        </FormAlert>
        <Link href="/sign-in" className="text-accent underline underline-offset-4">
          {tCommon('backToSignIn')}
        </Link>
      </div>
    );
  }

  const fieldErrorShown = Object.keys(errors).length > 0;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {register.isError && !fieldErrorShown && (
        <FormAlert tone="error">{errorMessage(register.error, tErrors)}</FormAlert>
      )}
      <TextField
        label={t('name')}
        autoComplete="name"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <TextField
        label={t('email')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <TextField
        label={t('password')}
        type="password"
        autoComplete="new-password"
        hint={t('passwordHint')}
        error={errors.password?.message}
        {...form.register('password')}
      />
      <TextField
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <fieldset className="space-y-2">
        <legend className="font-medium">{t('language')}</legend>
        {(['en', 'bn'] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input type="radio" value={option} {...form.register('preferredLocale')} />
            <span>{tLanguages(option)}</span>
          </label>
        ))}
      </fieldset>
      <Button busy={register.isPending} className="w-full">
        {register.isPending ? tCommon('loading') : t('submit')}
      </Button>
      <p className="text-muted text-sm">
        {t('haveAccount')}{' '}
        <Link href="/sign-in" className="text-accent underline underline-offset-4">
          {tCommon('backToSignIn')}
        </Link>
      </p>
    </form>
  );
}
