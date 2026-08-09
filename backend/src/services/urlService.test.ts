import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { UrlService } from './urlService.js';
import { AppError } from '../utils/errors.js';

const createdCodes: string[] = [];

const track = <T extends { shortCode: string }>(row: T): T => {
  createdCodes.push(row.shortCode);
  return row;
};

afterAll(async () => {
  if (createdCodes.length > 0) {
    await prisma.url.deleteMany({
      where: { shortCode: { in: createdCodes } },
    });
  }
  await prisma.$disconnect();
});

describe('UrlService core flows', () => {
  it('creates, lists, renames alias, and fetches', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl({
        originalUrl: 'https://example.com/core-create',
        customAlias: `t-create-${suffix}`,
      })
    );

    expect(created.shortCode).toBe(`t-create-${suffix}`);
    expect(created.shortUrl).toContain(created.shortCode);

    const listed = await UrlService.listUrls(100, 0);
    expect(listed.items.some((item) => item.shortCode === created.shortCode)).toBe(
      true
    );

    const renamed = track(
      await UrlService.updateByShortCode(created.shortCode, {
        customAlias: `t-renamed-${suffix}`,
      })
    );
    expect(renamed.shortCode).toBe(`t-renamed-${suffix}`);

    await expect(UrlService.getByShortCode(created.shortCode)).rejects.toBeInstanceOf(
      AppError
    );
    const fetched = await UrlService.getByShortCode(renamed.shortCode);
    expect(fetched.originalUrl).toBe('https://example.com/core-create');
  });

  it('redirects once then expires at max clicks', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl({
        originalUrl: 'https://example.com/max-clicks',
        customAlias: `t-max-${suffix}`,
        maxClicks: 1,
      })
    );

    const first = await UrlService.resolveRedirect(created.shortCode);
    expect(first).toEqual({
      ok: true,
      originalUrl: 'https://example.com/max-clicks',
    });

    const second = await UrlService.resolveRedirect(created.shortCode);
    expect(second).toEqual({ ok: false, reason: 'expired' });
  });

  it('is race-safe under concurrent max-click redirects', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl({
        originalUrl: 'https://example.com/race',
        customAlias: `t-race-${suffix}`,
        maxClicks: 1,
      })
    );

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        UrlService.resolveRedirect(created.shortCode)
      )
    );

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;
    expect(okCount).toBe(1);
    expect(failCount).toBe(19);

    const after = await UrlService.getByShortCode(created.shortCode);
    expect(after.clickCount).toBe(1);
    expect(after.isExpired).toBe(true);
  });

  it('rejects redirect when time-expired or disabled', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const expired = track(
      await UrlService.createShortUrl({
        originalUrl: 'https://example.com/expired',
        customAlias: `t-exp-${suffix}`,
        expiresIn: 1,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const expiredResult = await UrlService.resolveRedirect(expired.shortCode);
    expect(expiredResult).toEqual({ ok: false, reason: 'expired' });

    const disabled = track(
      await UrlService.createShortUrl({
        originalUrl: 'https://example.com/disabled',
        customAlias: `t-off-${suffix}`,
      })
    );
    await UrlService.updateByShortCode(disabled.shortCode, { isActive: false });
    const disabledResult = await UrlService.resolveRedirect(disabled.shortCode);
    expect(disabledResult).toEqual({ ok: false, reason: 'disabled' });
  });
});
