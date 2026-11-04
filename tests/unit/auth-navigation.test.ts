import { describe, expect, it } from 'vitest';
import { mfaRedirect, safeNextPath, tokenFromFragment } from '@/features/auth/navigation';
import { applyFieldErrors, errorMessage } from '@/features/auth/server-errors';
import { ApiClientError } from '@/lib/api/client';

describe('safeNextPath', () => {
  it.each(['/account', '/en/account', '/account?tab=security'])(
    'allows the relative path %s',
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    'javascript:alert(1)',
    'account',
    '',
    null,
  ])('falls back for the unsafe value %p', (value) => {
    expect(safeNextPath(value)).toBe('/account');
  });
});

describe('mfaRedirect', () => {
  it('routes incomplete two-factor states to the right page', () => {
    expect(mfaRedirect('pending')).toBe('/two-factor');
    expect(mfaRedirect('setup_required')).toBe('/two-factor/setup');
    expect(mfaRedirect('none')).toBeNull();
    expect(mfaRedirect('verified')).toBeNull();
  });
});

describe('tokenFromFragment', () => {
  it('reads the token from the URL fragment', () => {
    expect(tokenFromFragment('#token=abcdefghijklmnopqrstuvwxyz')).toBe(
      'abcdefghijklmnopqrstuvwxyz',
    );
  });

  it('rejects missing or implausibly short tokens', () => {
    expect(tokenFromFragment('')).toBeNull();
    expect(tokenFromFragment('#token=short')).toBeNull();
    expect(tokenFromFragment('#other=abcdefghijklmnopqrstuvwxyz')).toBeNull();
  });
});

describe('server error mapping', () => {
  const t = (key: string) => `t:${key}`;

  it('translates known error codes and falls back for others', () => {
    expect(errorMessage(new ApiClientError('INVALID_CREDENTIALS', 'x', 401, 'r'), t)).toBe(
      't:INVALID_CREDENTIALS',
    );
    expect(errorMessage(new ApiClientError('INTERNAL_ERROR', 'x', 500, 'r'), t)).toBe('t:GENERIC');
    expect(errorMessage(new Error('boom'), t)).toBe('t:GENERIC');
  });

  it('puts password policy issues on the matching form field', () => {
    const calls: Array<[string, string]> = [];
    const setError = ((field: string, error: { message: string }) => {
      calls.push([field, error.message]);
    }) as never;
    const error = new ApiClientError('VALIDATION_ERROR', 'x', 400, 'r', [
      { field: 'password', code: 'PASSWORD_TOO_COMMON', message: 'server text' },
      { field: 'unknownField', message: 'ignored' },
    ] as never);

    expect(applyFieldErrors(error, setError, ['password'], t)).toBe(true);
    expect(calls).toEqual([['password', 't:PASSWORD_TOO_COMMON']]);
    expect(
      applyFieldErrors(
        new ApiClientError('RATE_LIMITED', 'x', 429, 'r'),
        setError,
        ['password'],
        t,
      ),
    ).toBe(false);
  });
});
