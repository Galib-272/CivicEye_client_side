import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from '@/lib/env';

describe('parsePublicEnv', () => {
  it('accepts a valid API URL and strips trailing slashes', () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_API_URL: 'https://api.example.org/' })).toEqual({
      NEXT_PUBLIC_API_URL: 'https://api.example.org',
      NEXT_PUBLIC_ENABLE_SYSTEM_STATUS: false,
    });
  });

  it('parses the system status flag', () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_ENABLE_SYSTEM_STATUS: 'true',
      }).NEXT_PUBLIC_ENABLE_SYSTEM_STATUS,
    ).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a URL', 'localhost:4000'],
    ['a non-HTTP scheme', 'javascript:alert(1)'],
  ])('rejects an API URL that is %s', (_label, value) => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_API_URL: value })).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
