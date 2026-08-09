import { describe, expect, it } from 'vitest';
import { parseCustomAlias, normalizeShortCode } from './url.js';

describe('parseCustomAlias', () => {
  it('normalizes valid alias', () => {
    expect(parseCustomAlias('My_Link-1')).toEqual({
      ok: true,
      shortCode: 'my_link-1',
    });
  });

  it('rejects reserved and invalid', () => {
    expect(parseCustomAlias('api').ok).toBe(false);
    expect(parseCustomAlias('ab').ok).toBe(false);
    expect(parseCustomAlias('bad alias').ok).toBe(false);
  });
});

describe('normalizeShortCode', () => {
  it('trims and lowercases', () => {
    expect(normalizeShortCode('  AbC  ')).toBe('abc');
  });
});
