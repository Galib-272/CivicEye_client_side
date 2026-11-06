'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { isSigningOut, useAuthState, type AuthState } from './api';
import { mfaRedirect } from './navigation';

/**
 * Client-side navigation guard: sends signed-out visitors to sign-in and users with
 * outstanding two-factor steps to finish them. It only shapes navigation — the API enforces
 * every permission on the server regardless of what the browser shows.
 */
export function RequireAuth({
  children,
  allowIncompleteMfa = false,
}: {
  children: (auth: AuthState) => ReactNode;
  allowIncompleteMfa?: boolean;
}) {
  const t = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const { data: auth, isPending, isError } = useAuthState();
  const router = useRouter();
  const pathname = usePathname();

  const redirect =
    auth === null
      ? isSigningOut()
        ? null
        : `/sign-in?next=${encodeURIComponent(pathname)}`
      : auth && !allowIncompleteMfa
        ? mfaRedirect(auth.mfa, pathname)
        : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (isError) {
    return <p role="alert">{tErrors('NETWORK_ERROR')}</p>;
  }
  if (isPending || !auth || redirect) {
    return <p aria-live="polite">{t('loading')}</p>;
  }
  return <>{children(auth)}</>;
}
