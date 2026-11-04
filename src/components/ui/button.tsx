import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  className,
  children,
  ...button
}: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-background'
      : 'border-border border bg-transparent text-foreground';
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${styles} rounded-md px-4 py-2 font-medium disabled:opacity-60 ${className ?? ''}`}
      {...button}
    >
      {children}
    </button>
  );
}
