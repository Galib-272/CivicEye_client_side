'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { Link, useRouter } from '@/i18n/navigation';
import { useLogin } from './api';
import { mfaRedirect, safeNextPath } from './navigation';
import { errorMessage } from './server-errors';

export function SignInForm() {
  const t = useTranslations('SignIn');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const login = useLogin();

  const schema = z.object({
    email: z.email(tCommon('invalidEmail')),
    password: z.string().min(1, tCommon('fieldRequired')),
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (state) => router.replace(mfaRedirect(state.mfa, next) ?? next),
      onError: () => form.resetField('password'),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {login.isError && <FormAlert tone="error">{errorMessage(login.error, tErrors)}</FormAlert>}
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Button busy={login.isPending} className="w-full">
        {login.isPending ? tCommon('loading') : t('submit')}
      </Button>
      <p className="text-sm">
        <Link href="/forgot-password" className="text-accent underline underline-offset-4">
          {t('forgot')}
        </Link>
      </p>
      <p className="text-muted text-sm">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-accent underline underline-offset-4">
          {t('createAccount')}
        </Link>
      </p>
    </form>
  );
}
