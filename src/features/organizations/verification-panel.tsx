'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { TextAreaField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import {
  useSetContact,
  useVerificationAction,
  type AdminOrganization,
  type VerificationAction,
} from './api';

/** Which decisions are offered in each verification state (mirrors the server's rules). */
const ACTIONS: Record<AdminOrganization['verificationState'], VerificationAction[]> = {
  UNVERIFIED: [],
  PENDING_VERIFICATION: ['verify', 'reject'],
  VERIFIED: ['suspend'],
  REJECTED: [],
  SUSPENDED: ['reactivate'],
};

/** Super Admin verification workflow: contact person, decisions and history. */
export function VerificationPanel({ organization }: { organization: AdminOrganization }) {
  const t = useTranslations('AdminOrgs');
  const tStates = useTranslations('VerificationState');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const setContact = useSetContact(organization.id);
  const decide = useVerificationAction(organization.id);
  const contact = organization.verificationContact;
  const [contactForm, setContactForm] = useState({ name: '', jobTitle: '', email: '' });
  const [reason, setReason] = useState('');

  const canSetContact = ['UNVERIFIED', 'PENDING_VERIFICATION', 'REJECTED'].includes(
    organization.verificationState,
  );
  const actions = ACTIONS[organization.verificationState];
  const contactConfirmed = !!contact?.confirmedAt;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  const onSendContact = (event: FormEvent) => {
    event.preventDefault();
    setContact.mutate(contactForm, {
      onSuccess: () => setContactForm({ name: '', jobTitle: '', email: '' }),
    });
  };

  const runAction = (action: VerificationAction) => {
    decide.mutate(
      { action, reason: reason.trim() || undefined },
      { onSuccess: () => setReason('') },
    );
  };

  return (
    <Section title={t('verificationHeading')}>
      <p>
        {t('verificationHeading')}: <strong>{tStates(organization.verificationState)}</strong>
      </p>

      <div className="space-y-2">
        <h3 className="font-semibold">{t('contactHeading')}</h3>
        {contact ? (
          <div>
            <p>
              {contact.name} · {contact.jobTitle} · {contact.email}
            </p>
            <p className="text-muted text-sm">
              {contact.confirmedAt
                ? t('contactConfirmed', { date: date(contact.confirmedAt) })
                : contact.linkExpiresAt
                  ? t('contactWaiting', { date: date(contact.linkExpiresAt) })
                  : null}
            </p>
          </div>
        ) : null}
        {canSetContact && (
          <form onSubmit={onSendContact} className="space-y-3">
            {setContact.isSuccess && <FormAlert tone="success">{t('contactSent')}</FormAlert>}
            {setContact.isError && (
              <FormAlert tone="error">
                <p>{errorMessage(setContact.error, tErrors)}</p>
                {errorDetail(setContact.error) && (
                  <p className="text-sm">{errorDetail(setContact.error)}</p>
                )}
              </FormAlert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t('contactName')}
                value={contactForm.name}
                required
                onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
              />
              <TextField
                label={t('contactTitle')}
                value={contactForm.jobTitle}
                required
                onChange={(event) =>
                  setContactForm({ ...contactForm, jobTitle: event.target.value })
                }
              />
            </div>
            <TextField
              label={t('contactEmail')}
              type="email"
              hint={t('contactHint', { domain: organization.officialEmailDomain })}
              value={contactForm.email}
              required
              onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
            />
            <Button busy={setContact.isPending}>{t('sendContact')}</Button>
          </form>
        )}
      </div>

      {actions.length > 0 && (
        <div className="border-border space-y-3 border-t pt-4">
          {decide.isError && (
            <FormAlert tone="error">{errorMessage(decide.error, tErrors)}</FormAlert>
          )}
          <TextAreaField
            label={t('reason')}
            hint={t('reasonHint')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {actions.includes('verify') && !contactConfirmed && (
            <p className="text-muted text-sm">{t('verifyNeedsContact')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={action === 'verify' || action === 'reactivate' ? 'primary' : 'secondary'}
                busy={decide.isPending && decide.variables?.action === action}
                disabled={
                  (action === 'verify' && !contactConfirmed) ||
                  (action !== 'verify' && reason.trim().length < 5)
                }
                onClick={() => runAction(action)}
              >
                {t(action)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">{t('historyHeading')}</h3>
        {organization.verificationHistory.length === 0 ? (
          <p className="text-muted">{t('noHistory')}</p>
        ) : (
          <ol className="space-y-2">
            {organization.verificationHistory.map((record) => (
              <li key={`${record.createdAt}-${record.toState}`}>
                <p>
                  {t('historyItem', {
                    from: tStates(record.fromState),
                    to: tStates(record.toState),
                    by: record.decidedBy,
                  })}
                </p>
                <p className="text-muted text-sm">
                  {date(record.createdAt)}
                  {record.reason ? ` · ${record.reason}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Section>
  );
}
