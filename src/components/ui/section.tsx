import { useId, type ReactNode } from 'react';

/** Bordered page section with a level-2 heading that labels it for assistive technology. */
export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="border-border space-y-4 rounded-lg border p-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Small status label. Meaning is carried by its text, not its colour. */
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const styles = {
    neutral: 'border-border bg-surface',
    good: 'border-green-700 text-green-900 dark:border-green-400 dark:text-green-100',
    warn: 'border-notice-fg bg-notice-bg text-notice-fg',
  }[tone];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-sm font-medium ${styles}`}>
      {children}
    </span>
  );
}
