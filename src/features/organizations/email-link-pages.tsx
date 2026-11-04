'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { useAuthState } from '@/features/auth/api';
import { useClearFragment, useFragmentToken } from '@/features/auth/navigation';
import { errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import { useAcceptInvitation, useConfirmContact } from './api';

const PENDING_INVITATION_KEY = 'civiceye:pending-invitation';

function readStoredInvitation(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITATION_KEY);
  } catch {
    // Storage unavailable (e.g. private mode): only the token from the link can be used.
    return null;
  }
}

const noSubscription = () => () => undefined;

/**
 * Accepting an invitation needs a signed-in, verified account with the invited email. If the
 * visitor must sign in first, the token is kept in sessionStorage (this tab only) so they can
 * return here afterwards without the email link.
 */
export function AcceptInvitation() {
  const t = useTranslations('Invitation');
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const fragmentToken = useFragmentToken();
  useClearFragment();
  const auth = useAuthState();
  const accept = useAcceptInvitation();
  const storedToken = useSyncExternalStore(noSubscription, readStoredInvitation, () => null);

  useEffect(() => {
    if (!fragmentToken) return;
    try {
      sessionStorage.setItem(PENDING_INVITATION_KEY, fragmentToken);
    } catch {
      // Storage unavailable: the token from the link is still used on this page.
    }
  }, [fragmentToken]);

  const token = fragmentToken ?? storedToken;
  if (fragmentToken === undefined || auth.isPending) {
    return <p aria-live="polite">{tCommon('loading')}</p>;
  }
  if (!token) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;

  if (accept.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">
          {t('accepted', {
            organization: accept.data.organizationName,
            role: tRoles(accept.data.role),
          })}
        </FormAlert>
        <Link
          href={`/organizations/${accept.data.organizationId}`}
          className="text-accent underline underline-offset-4"
        >
          {t('openWorkspace')}
        </Link>
      </div>
    );
  }

  if (!auth.data) {
    return (
      <div className="space-y-4">
        <p>{t('signInFirst')}</p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/sign-in?next=%2Finvitations%2Faccept"
            className="text-accent underline underline-offset-4"
          >
            {t('signIn')}
          </Link>
          <Link href="/register" className="text-accent underline underline-offset-4">
            {t('register')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accept.isError && <FormAlert tone="error">{errorMessage(accept.error, tErrors)}</FormAlert>}
      <Button
        type="button"
        busy={accept.isPending}
        onClick={() =>
          accept.mutate(token, {
            onSuccess: () => {
              try {
                sessionStorage.removeItem(PENDING_INVITATION_KEY);
              } catch {
                // Nothing stored.
              }
            },
          })
        }
      >
        {t('accept')}
      </Button>
    </div>
  );
}

/** The verification contact person opens this from their email; no account is needed. */
export function ConfirmContact() {
  const t = useTranslations('ContactConfirm');
  const tErrors = useTranslations('Errors');
  const token = useFragmentToken();
  useClearFragment();
  const confirm = useConfirmContact();
  const submitted = useRef(false);

  useEffect(() => {
    if (token && !submitted.current) {
      submitted.current = true;
      confirm.mutate(token);
    }
  }, [token, confirm]);

  if (token === null) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;
  if (confirm.isError) {
    return <FormAlert tone="error">{errorMessage(confirm.error, tErrors)}</FormAlert>;
  }
  if (confirm.isSuccess) {
    return (
      <FormAlert tone="success">
        {t('confirmed', { organization: confirm.data.organizationName })}
      </FormAlert>
    );
  }
  return <p aria-live="polite">{t('confirming')}</p>;
}
