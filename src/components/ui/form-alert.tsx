import type { ReactNode } from 'react';

/** Error or success message announced to screen readers when it appears. */
export function FormAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error:
      'border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100',
    success:
      'border-green-700 bg-green-50 text-green-900 dark:border-green-400 dark:bg-green-950 dark:text-green-100',
    info: 'border-border bg-notice-bg text-notice-fg',
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-4 py-3 ${styles}`}
    >
      {children}
    </div>
  );
}
