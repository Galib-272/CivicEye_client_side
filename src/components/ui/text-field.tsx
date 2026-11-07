'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  /** Keeps the label for screen readers only, where the context already shows it. */
  hideLabel?: boolean;
}

/**
 * Labelled input with hint and error text linked through aria-describedby. Password fields
 * get a show/hide toggle.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, hideLabel, type = 'text', className, ...input },
  ref,
) {
  const t = useTranslations('Common');
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block font-medium'}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      )}
      <div className="flex gap-2">
        <input
          ref={ref}
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`border-border bg-background w-full rounded-md border px-3 py-2 ${
            error ? 'border-red-700 dark:border-red-400' : ''
          }`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            className="border-border text-muted shrink-0 rounded-md border px-3 text-sm"
          >
            {revealed ? t('hidePassword') : t('showPassword')}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});
