'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { FormAlert } from '@/components/ui/form-alert';
import { Link } from '@/i18n/navigation';
import { useVerifyEmail } from './api';
import { useClearFragment, useFragmentToken } from './navigation';
import { errorMessage } from './server-errors';

export function VerifyEmail() {
  const t = useTranslations('VerifyEmail');
  const tErrors = useTranslations('Errors');
  const verify = useVerifyEmail();
  const token = useFragmentToken();
  const submitted = useRef(false);
  useClearFragment();

  useEffect(() => {
    if (token && !submitted.current) {
      submitted.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  if (token === null) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;
  if (verify.isError) {
    return <FormAlert tone="error">{errorMessage(verify.error, tErrors)}</FormAlert>;
  }
  if (verify.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t('success')}</FormAlert>
        <Link href="/account" className="text-accent underline underline-offset-4">
          {t('continue')}
        </Link>
      </div>
    );
  }
  return <p aria-live="polite">{t('verifying')}</p>;
}
