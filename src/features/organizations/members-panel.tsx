'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Section } from '@/components/ui/section';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { errorMessage } from '@/features/auth/server-errors';
import {
  useChangeRole,
  useInvitations,
  useInvite,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  type OrganizationRole,
  type Scope,
} from './api';

const ROLES: OrganizationRole[] = ['ORG_ADMIN', 'ORG_REVIEWER', 'WORKER'];

/** Members, pending invitations and the invite form. Management controls only when allowed. */
export function MembersPanel({
  scope,
  organizationId,
  canManage,
}: {
  scope: Scope;
  organizationId: string;
  canManage: boolean;
}) {
  const t = useTranslations('Org');
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const members = useMembers(scope, organizationId);
  const invitations = useInvitations(scope, organizationId, canManage);
  const invite = useInvite(scope, organizationId);
  const revoke = useRevokeInvitation(scope, organizationId);
  const changeRole = useChangeRole(scope, organizationId);
  const remove = useRemoveMember(scope, organizationId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('WORKER');
  const [sentTo, setSentTo] = useState<string>();

  const roleOptions = ROLES.map((value) => ({ value, label: tRoles(value) }));
  const adminCount = members.data?.filter((member) => member.role === 'ORG_ADMIN').length ?? 0;
  const actionError = invite.error ?? revoke.error ?? changeRole.error ?? remove.error;

  const onInvite = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    invite.mutate(
      { email: address, role },
      {
        onSuccess: () => {
          setSentTo(address);
          setEmail('');
        },
      },
    );
  };

  return (
    <Section title={t('membersHeading')}>
      {actionError && <FormAlert tone="error">{errorMessage(actionError, tErrors)}</FormAlert>}
      {!members.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : members.data.length === 0 ? (
        <p className="text-muted">{t('noMembers')}</p>
      ) : (
        <ul className="divide-border divide-y">
          {members.data.map((member) => {
            const isLastAdmin = member.role === 'ORG_ADMIN' && adminCount <= 1;
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-muted text-sm">{member.email}</p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <SelectField
                      label={t('changeRoleLabel', { name: member.name })}
                      hideLabel
                      value={member.role}
                      disabled={isLastAdmin || changeRole.isPending}
                      options={roleOptions}
                      onChange={(event) =>
                        changeRole.mutate({
                          memberId: member.id,
                          role: event.target.value as OrganizationRole,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={t('removeLabel', { name: member.name })}
                      disabled={isLastAdmin}
                      busy={remove.isPending && remove.variables === member.id}
                      onClick={() => {
                        if (window.confirm(t('confirmRemove', { name: member.name }))) {
                          remove.mutate(member.id);
                        }
                      }}
                    >
                      {t('remove')}
                    </Button>
                    {isLastAdmin && <p className="text-muted w-full text-sm">{t('lastAdmin')}</p>}
                  </div>
                ) : (
                  <span>{tRoles(member.role)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <>
          <form onSubmit={onInvite} className="border-border space-y-3 border-t pt-4">
            <h3 className="font-semibold">{t('inviteHeading')}</h3>
            {sentTo && invite.isSuccess && (
              <FormAlert tone="success">{t('inviteSent', { email: sentTo })}</FormAlert>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <TextField
                label={t('inviteEmail')}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <SelectField
                label={t('inviteRole')}
                value={role}
                options={roleOptions}
                onChange={(event) => setRole(event.target.value as OrganizationRole)}
              />
            </div>
            <Button busy={invite.isPending}>{t('inviteSend')}</Button>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold">{t('pendingHeading')}</h3>
            {invitations.data?.length === 0 && <p className="text-muted">{t('noPending')}</p>}
            <ul className="divide-border divide-y">
              {invitations.data?.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p>
                      {invitation.email} · {tRoles(invitation.role)}
                    </p>
                    <p className="text-muted text-sm">
                      {t('expires', {
                        date: format.dateTime(new Date(invitation.expiresAt), {
                          dateStyle: 'medium',
                        }),
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={t('revokeLabel', { email: invitation.email })}
                    busy={revoke.isPending && revoke.variables === invitation.id}
                    onClick={() => revoke.mutate(invitation.id)}
                  >
                    {t('revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Section>
  );
}
