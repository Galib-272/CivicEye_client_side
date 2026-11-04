'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { Link } from '@/i18n/navigation';
import { useForgotPassword } from './api';
import { errorMessage } from './server-errors';

export function ForgotPasswordForm() {
  const t = useTranslations('Forgot');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const forgot = useForgotPassword();

  const schema = z.object({ email: z.email(tCommon('invalidEmail')) });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (forgot.isSuccess) {
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

  return (
    <form
      onSubmit={form.handleSubmit(({ email }) => forgot.mutate(email))}
      noValidate
      className="space-y-4"
    >
      <p className="text-muted">{t('intro')}</p>
      {forgot.isError && <FormAlert tone="error">{errorMessage(forgot.error, tErrors)}</FormAlert>}
      <TextField
        label={t('email')}
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Button busy={forgot.isPending} className="w-full">
        {forgot.isPending ? tCommon('loading') : t('submit')}
      </Button>
      <Link href="/sign-in" className="text-accent block text-sm underline underline-offset-4">
        {tCommon('backToSignIn')}
      </Link>
    </form>
  );
}
