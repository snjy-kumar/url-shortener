import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { UrlService } from './urlService.js';
import { AppError } from '../utils/errors.js';

const TEST_USER = 'user_test_owner';
const OTHER_USER = 'user_test_other';
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
  it('creates, lists, renames alias, and fetches for owner', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/core-create',
          customAlias: `t-create-${suffix}`,
        },
        TEST_USER
      )
    );

    expect(created.shortCode).toBe(`t-create-${suffix}`);
    expect(created.shortUrl).toContain(created.shortCode);

    const listed = await UrlService.listUrls(TEST_USER, 100, 0);
    expect(listed.items.some((item) => item.shortCode === created.shortCode)).toBe(
      true
    );

    const otherList = await UrlService.listUrls(OTHER_USER, 100, 0);
    expect(
      otherList.items.some((item) => item.shortCode === created.shortCode)
    ).toBe(false);

    const renamed = track(
      await UrlService.updateByShortCode(
        created.shortCode,
        {
          customAlias: `t-renamed-${suffix}`,
        },
        TEST_USER
      )
    );
    expect(renamed.shortCode).toBe(`t-renamed-${suffix}`);

    await expect(
      UrlService.getByShortCode(created.shortCode, TEST_USER)
    ).rejects.toBeInstanceOf(AppError);
    const fetched = await UrlService.getByShortCode(renamed.shortCode, TEST_USER);
    expect(fetched.originalUrl).toBe('https://example.com/core-create');

    await expect(
      UrlService.getByShortCode(renamed.shortCode, OTHER_USER)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('purges all links for a deleted Clerk user', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const a = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/purge-a',
          customAlias: `t-purge-a-${suffix}`,
        },
        TEST_USER
      )
    );
    track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/purge-b',
          customAlias: `t-purge-b-${suffix}`,
        },
        TEST_USER
      )
    );

    const deleted = await UrlService.deleteAllForClerkUser(TEST_USER);
    expect(deleted).toBeGreaterThanOrEqual(2);

    await expect(
      UrlService.getByShortCode(a.shortCode, TEST_USER)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('redirects once then expires at max clicks', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/max-clicks',
          customAlias: `t-max-${suffix}`,
          maxClicks: 1,
        },
        TEST_USER
      )
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
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/race',
          customAlias: `t-race-${suffix}`,
          maxClicks: 1,
        },
        TEST_USER
      )
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

    const after = await UrlService.getByShortCode(created.shortCode, TEST_USER);
    expect(after.clickCount).toBe(1);
    expect(after.isExpired).toBe(true);
  });

  it('rejects redirect when time-expired or disabled', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const expired = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/expired',
          customAlias: `t-exp-${suffix}`,
          expiresIn: 1,
        },
        TEST_USER
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const expiredResult = await UrlService.resolveRedirect(expired.shortCode);
    expect(expiredResult).toEqual({ ok: false, reason: 'expired' });

    const disabled = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/disabled',
          customAlias: `t-off-${suffix}`,
        },
        TEST_USER
      )
    );
    await UrlService.updateByShortCode(
      disabled.shortCode,
      { isActive: false },
      TEST_USER
    );
    const disabledResult = await UrlService.resolveRedirect(disabled.shortCode);
    expect(disabledResult).toEqual({ ok: false, reason: 'disabled' });
  });

  it('creates anonymous links with null owner', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/anon',
          customAlias: `t-anon-${suffix}`,
        },
        null
      )
    );

    const row = await prisma.url.findUnique({
      where: { shortCode: created.shortCode },
    });
    expect(row?.clerkUserId).toBeNull();

    const listed = await UrlService.listUrls(TEST_USER, 100, 0);
    expect(
      listed.items.some((item) => item.shortCode === created.shortCode)
    ).toBe(false);
  });

  it('stores clerk owner on signed-in create', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/owned',
          customAlias: `t-owned-${suffix}`,
        },
        TEST_USER
      )
    );

    const row = await prisma.url.findUnique({
      where: { shortCode: created.shortCode },
    });
    expect(row?.clerkUserId).toBe(TEST_USER);
  });

  it('blocks mutate of unowned or anonymous links', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const owned = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/other-owned',
          customAlias: `t-block-o-${suffix}`,
        },
        OTHER_USER
      )
    );
    const anon = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/other-anon',
          customAlias: `t-block-a-${suffix}`,
        },
        null
      )
    );

    await expect(
      UrlService.updateByShortCode(
        owned.shortCode,
        { originalUrl: 'https://example.com/hacked' },
        TEST_USER
      )
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      UrlService.deleteByShortCode(owned.shortCode, TEST_USER)
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      UrlService.getByShortCode(anon.shortCode, TEST_USER)
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      UrlService.updateByShortCode(
        anon.shortCode,
        { isActive: false },
        TEST_USER
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it('admin can look up and disable any link', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created = track(
      await UrlService.createShortUrl(
        {
          originalUrl: 'https://example.com/admin-takedown',
          customAlias: `t-admin-${suffix}`,
        },
        OTHER_USER
      )
    );

    const looked = await UrlService.adminGetByShortCode(created.shortCode);
    expect(looked.clerkUserId).toBe(OTHER_USER);
    expect(looked.isActive).toBe(true);

    const disabled = await UrlService.adminDisableByShortCode(
      created.shortCode,
      'user_admin'
    );
    expect(disabled.isActive).toBe(false);

    const redirect = await UrlService.resolveRedirect(created.shortCode);
    expect(redirect).toEqual({ ok: false, reason: 'disabled' });
  });
});
