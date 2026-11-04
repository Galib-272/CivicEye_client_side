import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiClientError } from '@/lib/api/client';

type Translate = (key: string) => string;

const KNOWN_ERRORS = new Set([
  'INVALID_CREDENTIALS',
  'RATE_LIMITED',
  'INVALID_TOKEN',
  'INVALID_MFA_CODE',
  'ACCOUNT_INACTIVE',
  'EMAIL_NOT_VERIFIED',
  'CSRF_TOKEN_INVALID',
  'SERVICE_UNAVAILABLE',
  'NETWORK_ERROR',
  'FORBIDDEN',
  'CONFLICT',
  'NOT_FOUND',
  'INVALID_STATE_TRANSITION',
  'ORGANIZATION_NOT_ELIGIBLE',
  'FILE_TOO_LARGE',
  'VALIDATION_ERROR',
]);

const PASSWORD_ISSUES = new Set([
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_TOO_COMMON',
  'PASSWORD_CONTAINS_PERSONAL_INFO',
]);

/** A translated, user-facing message for an error from the API client. */
export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiClientError && KNOWN_ERRORS.has(error.code)) {
    return t(error.code);
  }
  return t('GENERIC');
}

/**
 * Puts field-level validation errors returned by the API onto the matching form fields.
 * Returns true if at least one field error was applied (so no general alert is needed).
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
  t: Translate,
): boolean {
  if (!(error instanceof ApiClientError) || error.code !== 'VALIDATION_ERROR') return false;
  let applied = false;
  for (const detail of error.details as Array<{ field?: string; code?: string }>) {
    const field = fields.find((candidate) => candidate === detail.field);
    if (!field) continue;
    const message = detail.code && PASSWORD_ISSUES.has(detail.code) ? t(detail.code) : t('GENERIC');
    setError(field, { type: 'server', message }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}

/**
 * The server's own explanation for a validation error (for example why a map shape was
 * rejected). It is English-only technical detail, shown under the translated message.
 */
export function errorDetail(error: unknown): string | undefined {
  if (error instanceof ApiClientError && error.code === 'VALIDATION_ERROR') {
    const detail = (error.details as Array<{ message?: string }>)[0]?.message;
    return detail ?? error.message;
  }
  return undefined;
}
