'use client';

import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { useRouter } from '@/i18n/navigation';
import { useMfaEnable, useMfaSetup, type AuthState } from './api';
import { currentNextPath } from './navigation';
import { errorMessage } from './server-errors';

export function TwoFactorSetup({ auth }: { auth: AuthState }) {
  const t = useTranslations('TwoFactor');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const setup = useMfaSetup();
  const enable = useMfaEnable();
  const [qr, setQr] = useState<string>();
  const [code, setCode] = useState('');
  const [formatError, setFormatError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || auth.mfa === 'pending') return;
    started.current = true;
    setup.mutate(undefined, {
      // The QR code is drawn locally; the secret is never sent to a third-party QR service.
      onSuccess: ({ otpauthUri }) =>
        void QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 }).then(setQr),
    });
  }, [auth.mfa, setup]);

  if (enable.isSuccess) {
    const codes = enable.data.backupCodes;
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t('backupTitle')}</h2>
        <p>{t('backupIntro')}</p>
        <ul className="border-border bg-surface grid grid-cols-2 gap-2 rounded-md border p-4 font-mono">
          {codes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void navigator.clipboard.writeText(codes.join('\n')).then(() => setCopied(true))
            }
          >
            {copied ? t('copied') : t('copyCodes')}
          </Button>
          <Button type="button" onClick={() => router.replace(currentNextPath())}>
            {t('backupDone')}
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setFormatError(tCommon('codeFormat'));
      return;
    }
    setFormatError(undefined);
    enable.mutate(code.trim(), { onError: () => setCode('') });
  };

  return (
    <div className="space-y-4">
      {auth.mfa === 'setup_required' && <FormAlert tone="info">{t('setupRequired')}</FormAlert>}
      {setup.isError && <FormAlert tone="error">{errorMessage(setup.error, tErrors)}</FormAlert>}
      <p>{t('setupIntro')}</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimize
        <img
          src={qr}
          alt={t('qrAlt')}
          width={220}
          height={220}
          className="rounded-md bg-white p-2"
        />
      ) : (
        <p aria-live="polite">{tCommon('loading')}</p>
      )}
      {setup.data && (
        <div className="space-y-1">
          <p className="text-muted text-sm">{t('manualEntry')}</p>
          <code className="bg-surface block rounded-md p-2 font-mono text-sm break-all">
            {setup.data.secret}
          </code>
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {enable.isError && (
          <FormAlert tone="error">{errorMessage(enable.error, tErrors)}</FormAlert>
        )}
        <TextField
          label={t('code')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={formatError}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
        />
        <Button busy={enable.isPending} disabled={!setup.isSuccess} className="w-full">
          {enable.isPending ? tCommon('loading') : t('enable')}
        </Button>
      </form>
    </div>
  );
}
