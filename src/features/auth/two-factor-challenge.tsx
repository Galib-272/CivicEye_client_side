'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { useRouter } from '@/i18n/navigation';
import { useMfaChallenge, type AuthState } from './api';
import { currentNextPath } from './navigation';
import { errorMessage } from './server-errors';

export function TwoFactorChallenge({ auth }: { auth: AuthState }) {
  const t = useTranslations('TwoFactor');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const challenge = useMfaChallenge();
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState('');
  const [formatError, setFormatError] = useState<string>();

  // Nothing to verify: send the user on.
  useEffect(() => {
    if (auth.mfa !== 'pending') router.replace(currentNextPath());
  }, [auth.mfa, router]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const input = value.trim();
    if (!useBackup && !/^\d{6}$/.test(input)) {
      setFormatError(tCommon('codeFormat'));
      return;
    }
    setFormatError(undefined);
    challenge.mutate(useBackup ? { backupCode: input } : { code: input }, {
      onSuccess: () => router.replace(currentNextPath()),
      onError: () => setValue(''),
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {!useBackup && <p className="text-muted">{t('challengeIntro')}</p>}
      {challenge.isError && (
        <FormAlert tone="error">{errorMessage(challenge.error, tErrors)}</FormAlert>
      )}
      <TextField
        key={useBackup ? 'backup' : 'totp'}
        label={useBackup ? t('backupCode') : t('code')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={formatError}
        autoComplete="one-time-code"
        inputMode={useBackup ? 'text' : 'numeric'}
        maxLength={useBackup ? 20 : 6}
        autoFocus
      />
      <Button busy={challenge.isPending} className="w-full">
        {challenge.isPending ? tCommon('loading') : t('verify')}
      </Button>
      <button
        type="button"
        className="text-accent text-sm underline underline-offset-4"
        onClick={() => {
          setUseBackup((current) => !current);
          setValue('');
          setFormatError(undefined);
          challenge.reset();
        }}
      >
        {useBackup ? t('useApp') : t('useBackup')}
      </button>
    </form>
  );
}
