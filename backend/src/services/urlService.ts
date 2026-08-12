import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import {
  RESERVED_SHORT_CODES,
  generateShortCode,
  generateShortUrl,
  isValidUrl,
  normalizeShortCode,
  normalizeUrl,
  parseCustomAlias,
} from '../utils/url.js';
import { isLinkExpired, resolveExpiryPatch } from '../utils/expiry.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  claimTokensMatch,
  generateClaimToken,
  hashClaimToken,
  hashIp,
} from '../utils/claim.js';
import { redirectCache } from '../utils/redirectCache.js';
import { assertUrlNotMalicious } from '../utils/safeBrowsing.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import type { DeadLinkReason } from '../utils/deadLinkPage.js';
import {
  BulkCreateRequest,
  CreateUrlRequest,
  UpdateUrlRequest,
  UrlResponse,
} from '../types/index.js';

type UrlRow = {
  id: number;
  shortCode: string;
  originalUrl: string;
  clerkUserId: string | null;
  claimTokenHash?: string | null;
  passwordHash?: string | null;
  isActive: boolean;
  clickCount: number;
  expiresAt: Date | null;
  maxClicks: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RedirectResult =
  | { ok: true; originalUrl: string; urlId: number }
  | { ok: false; reason: DeadLinkReason | 'password_required' };

export type ClickMeta = {
  referrer?: string;
  userAgent?: string;
  ip?: string;
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class UrlService {
  static async createShortUrl(
    data: CreateUrlRequest,
    clerkUserId: string | null
  ): Promise<UrlResponse & { claimToken?: string }> {
    const normalizedUrl = normalizeUrl(data.originalUrl);
    if (!isValidUrl(normalizedUrl)) {
      throw new AppError('Invalid URL provided', 400);
    }
    await assertUrlNotMalicious(normalizedUrl);

    const expiry = resolveExpiryPatch({
      expiresAt: data.expiresAt,
      expiresIn: data.expiresIn,
      maxClicks: data.maxClicks,
    });

    const claimToken = clerkUserId ? null : generateClaimToken();
    const claimTokenHash = claimToken ? hashClaimToken(claimToken) : null;
    let passwordHash: string | null = null;
    if (data.password !== undefined && data.password !== '') {
      if (data.password.length < 4) {
        throw new AppError('Password must be at least 4 characters', 400);
      }
      passwordHash = await hashPassword(data.password);
    }

    const createData = {
      originalUrl: normalizedUrl,
      clerkUserId,
      claimTokenHash,
      passwordHash,
      expiresAt: expiry.expiresAt ?? null,
      maxClicks: expiry.maxClicks ?? null,
    };

    if (data.customAlias) {
      const parsed = parseCustomAlias(data.customAlias);
      if (!parsed.ok) {
        throw new AppError(parsed.message, 400);
      }

      try {
        const url = await prisma.url.create({
          data: {
            shortCode: parsed.shortCode,
            ...createData,
          },
        });
        return this.formatWithClaim(url, claimToken);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('Custom alias already exists', 409);
        }
        throw error;
      }
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const shortCode = generateShortCode();
      if (RESERVED_SHORT_CODES.has(shortCode)) {
        continue;
      }
      try {
        const url = await prisma.url.create({
          data: {
            shortCode,
            ...createData,
          },
        });
        return this.formatWithClaim(url, claimToken);
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError('Unable to generate unique short code', 500);
  }

  static async claimShortUrl(
    shortCode: string,
    claimToken: string,
    clerkUserId: string
  ): Promise<UrlResponse> {
    const code = normalizeShortCode(shortCode);
    const url = await prisma.url.findUnique({ where: { shortCode: code } });
    if (!url) {
      throw new AppError('URL not found', 404);
    }
    if (url.clerkUserId) {
      throw new AppError('Link already has an owner', 409);
    }
    if (!claimTokensMatch(claimToken, url.claimTokenHash)) {
      throw new AppError('Invalid claim token', 403);
    }

    const updated = await prisma.url.update({
      where: { shortCode: code },
      data: {
        clerkUserId,
        claimTokenHash: null,
      },
    });
    await redirectCache.invalidate(code);
    return this.format(updated);
  }

  static async getByShortCode(
    shortCode: string,
    clerkUserId: string
  ): Promise<UrlResponse> {
    const url = await this.findOwnedOrThrow(shortCode, clerkUserId);
    return this.format(url);
  }

  static async listUrls(
    clerkUserId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: UrlResponse[]; total: number }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const where = { clerkUserId };

    const [rows, total] = await Promise.all([
      prisma.url.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.url.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.format(row)),
      total,
    };
  }

  static async getClickAnalytics(
    shortCode: string,
    clerkUserId: string,
    limit = 50
  ): Promise<{
    shortCode: string;
    totalClicks: number;
    recent: Array<{
      id: string;
      createdAt: string;
      referrer: string | null;
      userAgent: string | null;
    }>;
  }> {
    const url = await this.findOwnedOrThrow(shortCode, clerkUserId);
    const take = Math.min(Math.max(limit, 1), 200);
    const recent = await prisma.clickEvent.findMany({
      where: { urlId: url.id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        referrer: true,
        userAgent: true,
      },
    });

    return {
      shortCode: url.shortCode,
      totalClicks: url.clickCount,
      recent: recent.map((row) => ({
        id: row.id.toString(),
        createdAt: row.createdAt.toISOString(),
        referrer: row.referrer,
        userAgent: row.userAgent,
      })),
    };
  }

  static async updateByShortCode(
    shortCode: string,
    data: UpdateUrlRequest,
    clerkUserId: string
  ): Promise<UrlResponse> {
    const code = normalizeShortCode(shortCode);
    await this.findOwnedOrThrow(code, clerkUserId);

    const patch: {
      shortCode?: string;
      originalUrl?: string;
      isActive?: boolean;
      expiresAt?: Date | null;
      maxClicks?: number | null;
      passwordHash?: string | null;
    } = {};

    if (data.originalUrl !== undefined) {
      const normalizedUrl = normalizeUrl(data.originalUrl);
      if (!isValidUrl(normalizedUrl)) {
        throw new AppError('Invalid URL provided', 400);
      }
      await assertUrlNotMalicious(normalizedUrl);
      patch.originalUrl = normalizedUrl;
    }

    if (data.customAlias !== undefined) {
      const parsed = parseCustomAlias(data.customAlias);
      if (!parsed.ok) {
        throw new AppError(parsed.message, 400);
      }
      if (parsed.shortCode !== code) {
        patch.shortCode = parsed.shortCode;
      }
    }

    if (data.isActive !== undefined) {
      patch.isActive = data.isActive;
    }

    if (
      data.expiresAt !== undefined ||
      data.expiresIn !== undefined ||
      data.maxClicks !== undefined
    ) {
      Object.assign(
        patch,
        resolveExpiryPatch({
          expiresAt: data.expiresAt,
          expiresIn: data.expiresIn,
          maxClicks: data.maxClicks,
        })
      );
    }

    if (data.password !== undefined) {
      if (data.password === null || data.password === '') {
        patch.passwordHash = null;
      } else if (data.password.length < 4) {
        throw new AppError('Password must be at least 4 characters', 400);
      } else {
        patch.passwordHash = await hashPassword(data.password);
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError('No changes provided', 400);
    }

    try {
      const url = await prisma.url.update({
        where: { shortCode: code },
        data: patch,
      });
      await redirectCache.invalidate(code);
      if (patch.shortCode && patch.shortCode !== code) {
        await redirectCache.invalidate(patch.shortCode);
      }
      return this.format(url);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('Custom alias already exists', 409);
      }
      throw error;
    }
  }

  static async deleteByShortCode(
    shortCode: string,
    clerkUserId: string
  ): Promise<void> {
    const code = normalizeShortCode(shortCode);
    await this.findOwnedOrThrow(code, clerkUserId);
    await prisma.url.delete({ where: { shortCode: code } });
    await redirectCache.invalidate(code);
  }

  static async deleteAllForClerkUser(clerkUserId: string): Promise<number> {
    const rows = await prisma.url.findMany({
      where: { clerkUserId },
      select: { shortCode: true },
    });
    const result = await prisma.url.deleteMany({ where: { clerkUserId } });
    await Promise.all(rows.map((r) => redirectCache.invalidate(r.shortCode)));
    return result.count;
  }

  static async adminGetByShortCode(shortCode: string): Promise<
    UrlResponse & { clerkUserId: string | null }
  > {
    const code = normalizeShortCode(shortCode);
    const url = await prisma.url.findUnique({ where: { shortCode: code } });
    if (!url) {
      throw new AppError('URL not found', 404);
    }
    return {
      ...this.format(url),
      clerkUserId: url.clerkUserId,
    };
  }

  static async adminDisableByShortCode(
    shortCode: string,
    adminUserId: string
  ): Promise<UrlResponse & { clerkUserId: string | null }> {
    const code = normalizeShortCode(shortCode);
    const existing = await prisma.url.findUnique({ where: { shortCode: code } });
    if (!existing) {
      throw new AppError('URL not found', 404);
    }

    const url = await prisma.url.update({
      where: { shortCode: code },
      data: { isActive: false },
    });
    await redirectCache.invalidate(code);

    await prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action: 'disable',
        shortCode: code,
        meta: {
          previousOwner: existing.clerkUserId,
          previousActive: existing.isActive,
        },
      },
    });

    logger.warn('Admin disabled short URL', {
      shortCode: code,
      adminUserId,
      previousOwner: existing.clerkUserId,
    });

    return {
      ...this.format(url),
      clerkUserId: url.clerkUserId,
    };
  }

  static async adminListAudit(limit = 50): Promise<
    Array<{
      id: number;
      adminUserId: string;
      action: string;
      shortCode: string;
      meta: unknown;
      createdAt: string;
    }>
  > {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      adminUserId: row.adminUserId,
      action: row.action,
      shortCode: row.shortCode,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  static async resolveRedirect(
    shortCode: string,
    meta?: ClickMeta,
    options?: { unlocked?: boolean }
  ): Promise<RedirectResult> {
    const code = normalizeShortCode(shortCode);

    const existing = await prisma.url.findUnique({ where: { shortCode: code } });
    if (!existing) {
      return { ok: false, reason: 'not_found' };
    }
    if (existing.passwordHash && !options?.unlocked) {
      return { ok: false, reason: 'password_required' };
    }

    // Cache fast-path only when max_clicks unset and no password.
    const cached = await redirectCache.get(code);
    if (
      !existing.passwordHash &&
      cached &&
      cached.maxClicks === null &&
      cached.isActive &&
      (!cached.expiresAt || new Date(cached.expiresAt) > new Date())
    ) {
      void this.bumpClickOnly(code, cached.id, meta);
      return { ok: true, originalUrl: cached.originalUrl, urlId: cached.id };
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: number;
        original_url: string;
        expires_at: Date | null;
        max_clicks: number | null;
      }>
    >`
      UPDATE urls
      SET click_count = click_count + 1
      WHERE short_code = ${code}
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_clicks IS NULL OR click_count < max_clicks)
      RETURNING id, original_url, expires_at, max_clicks
    `;

    const hit = rows[0];
    if (hit) {
      void this.recordClickEvent(hit.id, code, meta);
      if (!existing.passwordHash) {
        void redirectCache.set(code, {
          id: hit.id,
          originalUrl: hit.original_url,
          isActive: true,
          expiresAt: hit.expires_at ? hit.expires_at.toISOString() : null,
          maxClicks: hit.max_clicks,
        });
      }
      return { ok: true, originalUrl: hit.original_url, urlId: hit.id };
    }

    return this.explainRedirectFailure(code);
  }

  static async unlockRedirect(
    shortCode: string,
    password: string,
    meta?: ClickMeta
  ): Promise<RedirectResult> {
    const code = normalizeShortCode(shortCode);
    const url = await prisma.url.findUnique({ where: { shortCode: code } });
    if (!url) {
      return { ok: false, reason: 'not_found' };
    }
    if (!url.passwordHash) {
      return this.resolveRedirect(code, meta, { unlocked: true });
    }
    const ok = await verifyPassword(password, url.passwordHash);
    if (!ok) {
      throw new AppError('Invalid password', 403);
    }
    return this.resolveRedirect(code, meta, { unlocked: true });
  }

  static async createBulk(
    data: BulkCreateRequest,
    clerkUserId: string
  ): Promise<{ created: UrlResponse[]; errors: Array<{ index: number; message: string }> }> {
    const items = data.urls?.slice(0, 50) ?? [];
    if (items.length === 0) {
      throw new AppError('urls array required (max 50)', 400);
    }
    const created: UrlResponse[] = [];
    const errors: Array<{ index: number; message: string }> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      try {
        const row = await this.createShortUrl(item, clerkUserId);
        created.push(row);
      } catch (error) {
        errors.push({
          index: i,
          message: error instanceof AppError ? error.message : 'Create failed',
        });
      }
    }
    return { created, errors };
  }

  static async reportAbuse(input: {
    shortCode: string;
    reason: string;
    reporterEmail?: string;
  }): Promise<{ id: number }> {
    const code = normalizeShortCode(input.shortCode);
    const reason = input.reason.trim().slice(0, 1000);
    if (reason.length < 5) {
      throw new AppError('Reason too short', 400);
    }
    const url = await prisma.url.findUnique({ where: { shortCode: code } });
    const row = await prisma.abuseReport.create({
      data: {
        shortCode: code,
        urlId: url?.id ?? null,
        reason,
        reporterEmail: input.reporterEmail?.trim().slice(0, 320) || null,
      },
    });
    return { id: row.id };
  }

  static async adminListAbuse(status = 'open', limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await prisma.abuseReport.findMany({
      where: status === 'all' ? undefined : { status },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      shortCode: r.shortCode,
      reason: r.reason,
      reporterEmail: r.reporterEmail,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolvedBy: r.resolvedBy,
    }));
  }

  static async adminResolveAbuse(
    id: number,
    adminUserId: string,
    status: 'resolved' | 'dismissed'
  ) {
    const row = await prisma.abuseReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });
    return row;
  }

  private static async bumpClickOnly(
    shortCode: string,
    urlId: number,
    meta?: ClickMeta
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE urls SET click_count = click_count + 1 WHERE short_code = ${shortCode}
      `;
      await this.recordClickEvent(urlId, shortCode, meta);
    } catch (error) {
      logger.warn('Async click bump failed', {
        shortCode,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private static async recordClickEvent(
    urlId: number,
    shortCode: string,
    meta?: ClickMeta
  ): Promise<void> {
    try {
      await prisma.clickEvent.create({
        data: {
          urlId,
          shortCode,
          referrer: meta?.referrer?.slice(0, 2048) || null,
          userAgent: meta?.userAgent?.slice(0, 512) || null,
          ipHash: hashIp(meta?.ip),
        },
      });
    } catch (error) {
      logger.warn('Click event insert failed', {
        shortCode,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private static async explainRedirectFailure(
    shortCode: string
  ): Promise<RedirectResult> {
    const url = await prisma.url.findUnique({ where: { shortCode } });
    if (!url) {
      return { ok: false, reason: 'not_found' };
    }
    if (!url.isActive) {
      await redirectCache.set(shortCode, {
        id: url.id,
        originalUrl: url.originalUrl,
        isActive: false,
        expiresAt: url.expiresAt ? url.expiresAt.toISOString() : null,
        maxClicks: url.maxClicks,
      });
      return { ok: false, reason: 'disabled' };
    }
    if (isLinkExpired(url)) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: false, reason: 'expired' };
  }

  private static async findOwnedOrThrow(
    shortCode: string,
    clerkUserId: string
  ): Promise<UrlRow> {
    const code = normalizeShortCode(shortCode);
    const url = await prisma.url.findFirst({
      where: { shortCode: code, clerkUserId },
    });
    if (!url) {
      throw new AppError('URL not found', 404);
    }
    return url;
  }

  private static formatWithClaim(
    url: UrlRow,
    claimToken: string | null
  ): UrlResponse & { claimToken?: string } {
    const base = this.format(url);
    if (claimToken) {
      return { ...base, claimToken };
    }
    return base;
  }

  private static format(url: UrlRow): UrlResponse {
    return {
      id: url.id,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      shortUrl: generateShortUrl(url.shortCode),
      isActive: url.isActive,
      clickCount: url.clickCount,
      expiresAt: url.expiresAt ? url.expiresAt.toISOString() : null,
      maxClicks: url.maxClicks,
      isExpired: isLinkExpired(url),
      hasPassword: Boolean(url.passwordHash),
      createdAt: url.createdAt.toISOString(),
      updatedAt: url.updatedAt.toISOString(),
    };
  }
}
