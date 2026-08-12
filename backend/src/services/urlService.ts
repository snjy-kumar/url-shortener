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
import type { DeadLinkReason } from '../utils/deadLinkPage.js';
import {
  CreateUrlRequest,
  UpdateUrlRequest,
  UrlResponse,
} from '../types/index.js';

type UrlRow = {
  id: number;
  shortCode: string;
  originalUrl: string;
  clerkUserId: string | null;
  isActive: boolean;
  clickCount: number;
  expiresAt: Date | null;
  maxClicks: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RedirectResult =
  | { ok: true; originalUrl: string }
  | { ok: false; reason: DeadLinkReason };

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class UrlService {
  static async createShortUrl(
    data: CreateUrlRequest,
    clerkUserId: string | null
  ): Promise<UrlResponse> {
    const normalizedUrl = normalizeUrl(data.originalUrl);
    if (!isValidUrl(normalizedUrl)) {
      throw new AppError('Invalid URL provided', 400);
    }

    const expiry = resolveExpiryPatch({
      expiresAt: data.expiresAt,
      expiresIn: data.expiresIn,
      maxClicks: data.maxClicks,
    });

    if (data.customAlias) {
      const parsed = parseCustomAlias(data.customAlias);
      if (!parsed.ok) {
        throw new AppError(parsed.message, 400);
      }

      try {
        const url = await prisma.url.create({
          data: {
            shortCode: parsed.shortCode,
            originalUrl: normalizedUrl,
            clerkUserId,
            expiresAt: expiry.expiresAt ?? null,
            maxClicks: expiry.maxClicks ?? null,
          },
        });
        return this.format(url);
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
            originalUrl: normalizedUrl,
            clerkUserId,
            expiresAt: expiry.expiresAt ?? null,
            maxClicks: expiry.maxClicks ?? null,
          },
        });
        return this.format(url);
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError('Unable to generate unique short code', 500);
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
    } = {};

    if (data.originalUrl !== undefined) {
      const normalizedUrl = normalizeUrl(data.originalUrl);
      if (!isValidUrl(normalizedUrl)) {
        throw new AppError('Invalid URL provided', 400);
      }
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

    if (Object.keys(patch).length === 0) {
      throw new AppError('No changes provided', 400);
    }

    try {
      const url = await prisma.url.update({
        where: { shortCode: code },
        data: patch,
      });
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
  }

  /** Purge all links owned by a Clerk user (e.g. user.deleted webhook). */
  static async deleteAllForClerkUser(clerkUserId: string): Promise<number> {
    const result = await prisma.url.deleteMany({ where: { clerkUserId } });
    return result.count;
  }

  /** Admin: lookup any link by code (includes owner id). */
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

  /** Admin: force-disable any link (takedown). */
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

    // Structured audit trail in logs (no separate audit table yet).
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

  static async resolveRedirect(shortCode: string): Promise<RedirectResult> {
    const code = normalizeShortCode(shortCode);

    // Hot path: increment click_count only (no updated_at) so Postgres can HOT-update.
    const rows = await prisma.$queryRaw<
      Array<{ id: number; original_url: string }>
    >`
      UPDATE urls
      SET click_count = click_count + 1
      WHERE short_code = ${code}
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_clicks IS NULL OR click_count < max_clicks)
      RETURNING id, original_url
    `;

    const hit = rows[0];
    if (hit) {
      return { ok: true, originalUrl: hit.original_url };
    }

    return this.explainRedirectFailure(code);
  }

  private static async explainRedirectFailure(
    shortCode: string
  ): Promise<RedirectResult> {
    const url = await prisma.url.findUnique({ where: { shortCode } });
    if (!url) {
      return { ok: false, reason: 'not_found' };
    }
    if (!url.isActive) {
      return { ok: false, reason: 'disabled' };
    }
    if (isLinkExpired(url)) {
      return { ok: false, reason: 'expired' };
    }
    // Lost race on last click / concurrent disable
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
      createdAt: url.createdAt.toISOString(),
      updatedAt: url.updatedAt.toISOString(),
    };
  }
}
