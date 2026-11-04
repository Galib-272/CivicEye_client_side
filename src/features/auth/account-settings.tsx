'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { Link } from '@/i18n/navigation';
import {
  useChangePassword,
  useMfaStatus,
  useResendVerification,
  useRevokeSession,
  useSessions,
  useUpdateProfile,
  type AuthState,
} from './api';
import { MyOrganizations } from '@/features/organizations/workspace';
import { applyFieldErrors, errorMessage } from './server-errors';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className="border-border space-y-4 rounded-lg border p-5" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfileSection({ auth }: { auth: AuthState }) {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tLanguages = useTranslations('Languages');
  const update = useUpdateProfile();
  const resend = useResendVerification();

  const schema = z.object({
    name: z.string().trim().min(1, tCommon('fieldRequired')).max(100, tCommon('nameTooLong')),
    preferredLocale: z.enum(['en', 'bn']),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: { name: auth.user.name, preferredLocale: auth.user.preferredLocale },
  });

  return (
    <Section title={t('profileHeading')}>
      {!auth.user.emailVerified && (
        <div className="space-y-2">
          <FormAlert tone="info">{t('unverifiedNotice')}</FormAlert>
          {resend.isSuccess ? (
            <FormAlert tone="success">{t('verificationSent')}</FormAlert>
          ) : (
            <Button
              type="button"
              variant="secondary"
              busy={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {t('resendVerification')}
            </Button>
          )}
          {resend.isError && (
            <FormAlert tone="error">{errorMessage(resend.error, tErrors)}</FormAlert>
          )}
        </div>
      )}
      <form
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
        noValidate
        className="space-y-4"
      >
        {update.isSuccess && !form.formState.isDirty && (
          <FormAlert tone="success">{t('profileSaved')}</FormAlert>
        )}
        {update.isError && (
          <FormAlert tone="error">{errorMessage(update.error, tErrors)}</FormAlert>
        )}
        <div className="space-y-1">
          <p className="font-medium">{t('email')}</p>
          <p className="text-muted">{auth.user.email}</p>
        </div>
        <TextField
          label={t('name')}
          autoComplete="name"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
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
        <Button busy={update.isPending}>
          {update.isPending ? tCommon('saving') : t('saveProfile')}
        </Button>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const change = useChangePassword();

  const schema = z
    .object({
      currentPassword: z.string().min(1, tCommon('fieldRequired')),
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

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => form.reset(),
        onError: (error) => applyFieldErrors(error, form.setError, ['newPassword'], tErrors),
      },
    ),
  );

  return (
    <Section title={t('passwordHeading')}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {change.isSuccess && <FormAlert tone="success">{t('passwordChanged')}</FormAlert>}
        {change.isError && !errors.newPassword && (
          <FormAlert tone="error">{errorMessage(change.error, tErrors)}</FormAlert>
        )}
        <TextField
          label={t('currentPassword')}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
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
        <Button busy={change.isPending}>
          {change.isPending ? tCommon('saving') : t('changePassword')}
        </Button>
      </form>
    </Section>
  );
}

function TwoFactorSection() {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const status = useMfaStatus();

  return (
    <Section title={t('securityHeading')}>
      {!status.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : status.data.enabled ? (
        <>
          <p>{t('mfaOn')}</p>
          <p className="text-muted text-sm">
            {t('mfaBackupRemaining', { count: status.data.backupCodesRemaining })}
          </p>
        </>
      ) : (
        <>
          <p>{t('mfaOff')}</p>
          <Link href="/two-factor/setup" className="text-accent underline underline-offset-4">
            {t('mfaSetUp')}
          </Link>
        </>
      )}
    </Section>
  );
}

/** A short, human-readable device description from the user-agent string. */
function describeDevice(userAgent: string | null, fallback: string): string {
  if (!userAgent) return fallback;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null;
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' · ') || fallback;
}

function SessionsSection() {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const sessions = useSessions();
  const revoke = useRevokeSession();

  return (
    <Section title={t('sessionsHeading')}>
      {revoke.isError && <FormAlert tone="error">{errorMessage(revoke.error, tErrors)}</FormAlert>}
      {!sessions.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : (
        <ul className="divide-border divide-y">
          {sessions.data.map((session) => {
            const device = describeDevice(session.userAgent, t('unknownDevice'));
            return (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium">
                    {device}
                    {session.current && <span className="text-muted"> — {t('thisDevice')}</span>}
                  </p>
                  <p className="text-muted text-sm">
                    {t('lastActive', {
                      time: format.dateTime(new Date(session.lastSeenAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={t('signOutDeviceLabel', { device })}
                    busy={revoke.isPending && revoke.variables === session.id}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    {t('signOutDevice')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function AccountSettings({ auth }: { auth: AuthState }) {
  return (
    <div className="space-y-6">
      <ProfileSection auth={auth} />
      <MyOrganizations />
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}
