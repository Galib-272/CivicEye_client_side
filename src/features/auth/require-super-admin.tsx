'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { AuthState } from './api';
import { RequireAuth } from './require-auth';

/** Shows a permission-denied message instead of admin pages for other users. */
export function PermissionDenied() {
  const t = useTranslations('Denied');
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <Link href="/" className="text-accent underline underline-offset-4">
        {t('home')}
      </Link>
    </div>
  );
}

/**
 * Client-side gate for Super Admin pages. The API independently enforces every permission;
 * this only avoids showing pages that would fail.
 */
export function RequireSuperAdmin({ children }: { children: (auth: AuthState) => ReactNode }) {
  return (
    <RequireAuth>
      {(auth) => (auth.user.platformRole === 'SUPER_ADMIN' ? children(auth) : <PermissionDenied />)}
    </RequireAuth>
  );
}
