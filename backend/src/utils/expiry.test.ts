import { describe, expect, it } from 'vitest';
import {
  isLinkExpired,
  parseExpiresAt,
  parseExpiresIn,
  resolveExpiryPatch,
} from './expiry.js';
import { AppError } from './errors.js';

describe('parseExpiresIn', () => {
  it('parses relative units', () => {
    const before = Date.now();
    const at = parseExpiresIn('1h');
    expect(at.getTime()).toBeGreaterThanOrEqual(before + 3_600_000 - 50);
    expect(at.getTime()).toBeLessThanOrEqual(before + 3_600_000 + 50);
  });

  it('parses seconds number', () => {
    const before = Date.now();
    const at = parseExpiresIn(90);
    expect(at.getTime()).toBeGreaterThanOrEqual(before + 90_000 - 50);
  });

  it('rejects empty / invalid', () => {
    expect(() => parseExpiresIn('')).toThrow(AppError);
    expect(() => parseExpiresIn('nope')).toThrow(AppError);
    expect(() => parseExpiresIn(0)).toThrow(AppError);
  });
});

describe('parseExpiresAt', () => {
  it('accepts future ISO datetime', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(parseExpiresAt(future).toISOString()).toBe(future);
  });

  it('rejects past datetime', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(() => parseExpiresAt(past)).toThrow(AppError);
  });
});

describe('resolveExpiryPatch', () => {
  it('rejects both expiresAt and expiresIn', () => {
    expect(() =>
      resolveExpiryPatch({
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expiresIn: '1h',
      })
    ).toThrow(AppError);
  });

  it('clears with null', () => {
    expect(resolveExpiryPatch({ expiresAt: null, maxClicks: null })).toEqual({
      expiresAt: null,
      maxClicks: null,
    });
  });
});

describe('isLinkExpired', () => {
  it('detects time and max-click expiry', () => {
    expect(
      isLinkExpired({
        expiresAt: new Date(Date.now() - 1000),
        maxClicks: null,
        clickCount: 0,
      })
    ).toBe(true);

    expect(
      isLinkExpired({
        expiresAt: null,
        maxClicks: 3,
        clickCount: 3,
      })
    ).toBe(true);

    expect(
      isLinkExpired({
        expiresAt: null,
        maxClicks: 3,
        clickCount: 2,
      })
    ).toBe(false);
  });
});
