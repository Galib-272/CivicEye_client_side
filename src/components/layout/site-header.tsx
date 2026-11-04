import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="focus-ring rounded-md text-lg font-semibold tracking-tight">
          CivicEye
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
