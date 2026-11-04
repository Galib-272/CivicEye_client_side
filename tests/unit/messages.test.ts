import { describe, expect, it } from 'vitest';
import bn from '@/messages/bn.json';
import en from '@/messages/en.json';

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translation dictionaries', () => {
  const english = flatten(en);
  const bangla = flatten(bn);

  it('define exactly the same keys in English and Bangla', () => {
    expect(Object.keys(bangla).sort()).toEqual(Object.keys(english).sort());
  });

  it('have no empty translations', () => {
    for (const [key, value] of Object.entries({ ...english, ...bangla })) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(english)) {
      expect(placeholders(bangla[key] ?? ''), key).toEqual(placeholders(english[key] ?? ''));
    }
  });

  it('contain Bengali script in the Bangla dictionary', () => {
    expect(bangla['Home.heading']).toMatch(/[ঀ-৿]/);
  });
});
