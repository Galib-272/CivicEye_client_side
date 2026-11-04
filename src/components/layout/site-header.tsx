import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { AuthNav } from './auth-nav';
import { LanguageSwitcher } from './language-switcher';

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="focus-ring rounded-md text-lg font-semibold tracking-tight">
          CivicEye
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AuthNav />
          {/* Reads the current path, which on some pages is only known per request. */}
          <Suspense fallback={<div className="h-9 w-32" aria-hidden="true" />}>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
