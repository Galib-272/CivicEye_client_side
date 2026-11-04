import type { ReactNode } from 'react';

/** Narrow centered column for single-task pages such as sign-in. */
export function PageCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
