'use client';

import { forwardRef, useId, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string;
  /** Visually hidden label, for compact table rows where context is clear. */
  hideLabel?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hideLabel, options, className, ...select },
  ref,
) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block font-medium'}>
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="border-border bg-background w-full rounded-md border px-3 py-2"
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, hint, error, className, ...textarea }, ref) {
    const id = useId();
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={`space-y-1 ${className ?? ''}`}>
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-muted text-sm">
            {hint}
          </p>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="border-border bg-background w-full rounded-md border px-3 py-2"
          {...textarea}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);
