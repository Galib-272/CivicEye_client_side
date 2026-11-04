'use client';

import { useTranslations } from 'next-intl';
import { useLogout, useAuthState } from '@/features/auth/api';
import { Link, useRouter } from '@/i18n/navigation';

const linkStyle =
  'focus-ring rounded-md px-3 py-2 text-sm font-medium underline-offset-4 hover:underline';

export function AuthNav() {
  const t = useTranslations('Nav');
  const { data: auth, isPending } = useAuthState();
  const logout = useLogout();
  const router = useRouter();

  // Reserve space while loading so the header does not jump.
  if (isPending) return <div className="h-9 w-40" aria-hidden="true" />;

  return (
    <nav aria-label={t('mainLabel')}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/reports" className={linkStyle}>
            {t('publicReports')}
          </Link>
        </li>
        {auth ? (
          <>
            <li>
              <Link href="/reports/new" className={linkStyle}>
                {t('report')}
              </Link>
            </li>
            <li>
              <Link href="/reports/mine" className={linkStyle}>
                {t('myReports')}
              </Link>
            </li>
            {auth.user.platformRole === 'SUPER_ADMIN' && auth.mfa === 'verified' && (
              <>
                <li>
                  <Link href="/admin/reports/triage" className={linkStyle}>
                    {t('triage')}
                  </Link>
                </li>
                <li>
                  <Link href="/admin/organizations" className={linkStyle}>
                    {t('admin')}
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link href="/account" className={linkStyle}>
                {t('account')}
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={linkStyle}
                disabled={logout.isPending}
                onClick={() => logout.mutate(undefined, { onSettled: () => router.push('/') })}
              >
                {t('signOut')}
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link href="/sign-in" className={linkStyle}>
                {t('signIn')}
              </Link>
            </li>
            <li>
              <Link href="/register" className={`${linkStyle} bg-accent text-background`}>
                {t('register')}
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
