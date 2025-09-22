import { prisma } from '../config/database';
import {
  generateShortCode,
  isValidUrl,
  normalizeUrl,
  generateShortUrl,
} from '../utils/url';
import { CreateUrlRequest, UrlResponse, AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';
import { CacheService } from './cacheService';
import { EnhancedPasswordService } from './enhancedPasswordService';

export class UrlService {
  /**
   * Create a short URL from a long URL
   */
  static async createShortUrl(
    data: CreateUrlRequest,
    userId?: number
  ): Promise<UrlResponse> {
    const {
      originalUrl,
      customAlias,
      customDomain,
      password,
      expiresAt,
      description,
    } = data;

    // Validate the original URL
    const normalizedUrl = normalizeUrl(originalUrl);
    if (!isValidUrl(normalizedUrl)) {
      throw new Error('Invalid URL provided');
    }

    // Check if custom alias is provided and available
    let shortCode: string;
    if (customAlias) {
      // Validate custom alias format
      if (!/^[a-zA-Z0-9_-]{3,50}$/.test(customAlias)) {
        throw new Error(
          'Custom alias must be 3-50 characters and contain only letters, numbers, hyphens, and underscores'
        );
      }

      // Check if custom alias already exists
      const existingAlias = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode: customAlias }, { customAlias: customAlias }],
        },
      });

      if (existingAlias) {
        throw new Error('Custom alias already exists');
      }

      shortCode = customAlias;
    } else {
      // Generate unique short code
      shortCode = await this.generateUniqueShortCode();
    }

    // Validate custom domain if provided
    if (customDomain) {
      // Basic domain validation
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
      if (!domainPattern.test(customDomain)) {
        throw new Error('Invalid custom domain format');
      }
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (password) {
      // Use enhanced password validation
      const validation = EnhancedPasswordService.validatePassword(password);
      if (!validation.valid) {
        throw new Error(
          `Password validation failed: ${validation.errors.join(', ')}`
        );
      }

      hashedPassword = await EnhancedPasswordService.hashPassword(password);
    }

    // Create expiration date if provided
    const expirationDate = expiresAt ? new Date(expiresAt) : undefined;

    // Validate expiration date
    if (expirationDate && expirationDate <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    // Create URL record in database
    const url = await prisma.url.create({
      data: {
        shortCode,
        originalUrl: normalizedUrl,
        customAlias: customAlias || null,
        customDomain: customDomain || null,
        password: hashedPassword,
        description: description || null,
        expiresAt: expirationDate || null,
        userId: userId || null,
      },
    });

    // Get click count (will be 0 for new URLs)
    const clickCount = await this.getClickCount(url.id);

    return this.formatUrlResponse(url, clickCount);
  }

  /**
   * Get analytics for a URL within an optional date range
   */
  static async getAnalytics(shortCode: string, start?: string, end?: string) {
    const url = await prisma.url.findFirst({
      where: { OR: [{ shortCode }, { customAlias: shortCode }] },
      select: { id: true },
    });
    if (!url) return null;

    const where: any = { urlId: url.id };
    if (start) where.clickedAt = { gte: new Date(start) };
    if (end)
      where.clickedAt = { ...(where.clickedAt || {}), lte: new Date(end) };

    const [totalClicks, uniqueClicks, byDate, byReferrer, byCountry, byHour] =
      await Promise.all([
        prisma.analytics.count({ where }),
        prisma.analytics
          .groupBy({
            by: ['ipAddress'],
            where,
            _count: { _all: true },
          })
          .then((rows) => rows.length),
        prisma.analytics.groupBy({
          by: ['clickedAt'],
          where,
          _count: { _all: true },
        }),
        prisma.analytics.groupBy({
          by: ['referer'],
          where,
          _count: { _all: true },
        }),
        prisma.analytics.groupBy({
          by: ['country'],
          where,
          _count: { _all: true },
        }),
        prisma.analytics.groupBy({
          by: ['clickedAt'],
          where,
          _count: { _all: true },
        }),
      ]);

    // Format groupings
    const clicksByDate = byDate
      .map((row) => ({
        date: row.clickedAt.toISOString().slice(0, 10),
        clicks: row._count._all,
      }))
      .reduce(
        (acc: Record<string, number>, cur) => {
          acc[cur.date] = (acc[cur.date] || 0) + cur.clicks;
          return acc;
        },
        {} as Record<string, number>
      );

    const clicksByHour = byHour
      .map((row) => ({
        hour: new Date(row.clickedAt).getHours(),
        clicks: row._count._all,
      }))
      .reduce(
        (acc: Record<number, number>, cur) => {
          acc[cur.hour] = (acc[cur.hour] || 0) + cur.clicks;
          return acc;
        },
        {} as Record<number, number>
      );

    const topReferrers = byReferrer
      .map((r) => ({ referrer: r.referer || 'direct', clicks: r._count._all }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const clicksByCountry = byCountry
      .map((r) => ({ country: r.country || 'Unknown', clicks: r._count._all }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    return {
      totalClicks,
      uniqueClicks: typeof uniqueClicks === 'number' ? uniqueClicks : 0,
      clicksByDate: Object.entries(clicksByDate).map(([date, clicks]) => ({
        date,
        clicks: clicks as number,
      })),
      topReferrers,
      clicksByCountry,
      // Minimal compatibility fields for frontend visuals (can be expanded later)
      deviceTypes: [],
      browsers: [],
      platforms: [],
      clicksByHour: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        clicks: clicksByHour[i] || 0,
      })),
    };
  }

  /**
   * Verify password for password-protected URL
   */
  static async verifyUrlPassword(
    shortCode: string,
    password: string
  ): Promise<boolean> {
    const url = await prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
        isActive: true,
      },
      select: { password: true },
    });

    if (!url || !url.password) {
      return false;
    }

    return await bcrypt.compare(password, url.password);
  }

  /**
   * Get URL details by short code
   */
  static async getUrlByShortCode(
    shortCode: string
  ): Promise<UrlResponse | null> {
    // Try to get from cache first
    const cachedUrl = await CacheService.getCachedUrl(shortCode);
    if (cachedUrl) {
      // Check if cached URL has expired
      if (cachedUrl.expiresAt && new Date(cachedUrl.expiresAt) <= new Date()) {
        await CacheService.invalidateUrl(shortCode);
        return null;
      }

      // Get fresh click count and return formatted response
      const clickCount = await this.getClickCount(cachedUrl.id);
      return this.formatUrlResponse(
        {
          ...cachedUrl,
          expiresAt: cachedUrl.expiresAt ? new Date(cachedUrl.expiresAt) : null,
        },
        clickCount
      );
    }

    // If not in cache, get from database
    const url = await prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
        isActive: true,
      },
    });

    if (!url) {
      return null;
    }

    // Check if URL has expired
    if (url.expiresAt && url.expiresAt <= new Date()) {
      return null;
    }

    // Cache the URL data for future requests
    await CacheService.cacheUrl(shortCode, {
      originalUrl: url.originalUrl,
      expiresAt: url.expiresAt,
      isActive: url.isActive,
      id: url.id,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      customDomain: url.customDomain,
      description: url.description,
      hasPassword: !!url.password,
      userId: url.userId,
      createdAt: url.createdAt,
      updatedAt: url.updatedAt,
    });

    const clickCount = await this.getClickCount(url.id);
    return this.formatUrlResponse(url, clickCount);
  }

  /**
   * Get original URL for redirection
   */
  static async getOriginalUrl(shortCode: string): Promise<string | null> {
    // Try to get from cache first
    const cachedUrl = await CacheService.getCachedUrl(shortCode);
    if (cachedUrl) {
      // Check if cached URL has expired
      if (cachedUrl.expiresAt && new Date(cachedUrl.expiresAt) <= new Date()) {
        await CacheService.invalidateUrl(shortCode);
        return null;
      }
      return cachedUrl.originalUrl;
    }

    // If not in cache, get from database
    const url = await prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
        isActive: true,
      },
    });

    if (!url) {
      return null;
    }

    // Check if URL has expired
    if (url.expiresAt && url.expiresAt <= new Date()) {
      return null;
    }

    // Cache the URL data for future requests
    await CacheService.cacheUrl(shortCode, {
      originalUrl: url.originalUrl,
      expiresAt: url.expiresAt,
      isActive: url.isActive,
      id: url.id,
    });

    return url.originalUrl;
  }

  /**
   * List URLs with pagination
   */
  static async listUrls(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      prisma.url.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.url.count({
        where: { isActive: true },
      }),
    ]);

    // Get click counts for all URLs
    const urlsWithCounts = await Promise.all(
      urls.map(async (url) => {
        const clickCount = await this.getClickCount(url.id);
        return this.formatUrlResponse(url, clickCount);
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: urlsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update URL by short code or custom alias
   */
  static async updateUrl(
    shortCode: string,
    updates: Partial<{
      description: string;
      expiresAt: string;
      isActive: boolean;
      customAlias: string;
    }>
  ): Promise<UrlResponse | null> {
    const url = await prisma.url.findFirst({
      where: { OR: [{ shortCode }, { customAlias: shortCode }] },
    });
    if (!url) return null;

    const data: any = {};

    if (typeof updates.description !== 'undefined') {
      if (updates.description && updates.description.length > 500) {
        throw new Error('Description must not exceed 500 characters');
      }
      data.description = updates.description || null;
    }

    if (typeof updates.isActive !== 'undefined') {
      data.isActive = Boolean(updates.isActive);
    }

    if (typeof updates.expiresAt !== 'undefined') {
      if (updates.expiresAt) {
        const exp = new Date(updates.expiresAt);
        if (isNaN(exp.getTime()) || exp <= new Date()) {
          throw new Error('Expiration date must be a valid future date');
        }
        data.expiresAt = exp;
      } else {
        data.expiresAt = null;
      }
    }

    if (typeof updates.customAlias !== 'undefined') {
      const alias = updates.customAlias;
      if (alias) {
        if (!/^[a-zA-Z0-9_-]{3,50}$/.test(alias)) {
          throw new Error(
            'Custom alias must be 3-50 characters and contain only letters, numbers, hyphens, and underscores'
          );
        }
        const existing = await prisma.url.findFirst({
          where: {
            OR: [{ shortCode: alias }, { customAlias: alias }],
            NOT: { id: url.id },
          },
        });
        if (existing) {
          throw new Error('Custom alias already exists');
        }
        data.customAlias = alias;
        data.shortCode = alias; // keep them aligned for simplicity in MVP
      } else {
        data.customAlias = null;
      }
    }

    const updated = await prisma.url.update({ where: { id: url.id }, data });

    // Invalidate cache for the URL
    await CacheService.invalidateUrl(shortCode);
    if (url.customAlias && url.customAlias !== shortCode) {
      await CacheService.invalidateUrl(url.customAlias);
    }

    const clickCount = await this.getClickCount(updated.id);
    return this.formatUrlResponse(updated, clickCount);
  }

  /**
   * Delete URL by short code
   */
  static async deleteUrl(shortCode: string): Promise<boolean> {
    const url = await prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
        isActive: true,
      },
    });

    if (!url) {
      return false;
    }

    // Soft delete - mark as inactive
    await prisma.url.update({
      where: { id: url.id },
      data: { isActive: false },
    });

    // Invalidate cache for the URL
    await CacheService.invalidateUrl(shortCode);
    if (url.customAlias && url.customAlias !== shortCode) {
      await CacheService.invalidateUrl(url.customAlias);
    }

    return true;
  }

  /**
   * Bulk create URLs with transaction support
   */
  static async bulkCreateUrls(
    urlsData: CreateUrlRequest[],
    userId?: number
  ): Promise<{
    successful: UrlResponse[];
    failed: { index: number; error: string; data: CreateUrlRequest }[];
  }> {
    const successful: UrlResponse[] = [];
    const failed: { index: number; error: string; data: CreateUrlRequest }[] =
      [];

    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < urlsData.length; i += batchSize) {
      const batch = urlsData.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (urlData, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const result = await this.createShortUrl(urlData, userId);
            successful.push(result);
          } catch (error) {
            failed.push({
              index: globalIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: urlData,
            });
          }
        })
      );
    }

    return { successful, failed };
  }

  /**
   * Bulk delete URLs
   */
  static async bulkDeleteUrls(
    shortCodes: string[],
    userId?: number
  ): Promise<{
    successful: string[];
    failed: { shortCode: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { shortCode: string; error: string }[] = [];

    await Promise.all(
      shortCodes.map(async (shortCode) => {
        try {
          // If userId is provided, verify ownership
          if (userId) {
            const url = await prisma.url.findFirst({
              where: {
                OR: [{ shortCode }, { customAlias: shortCode }],
                userId,
                isActive: true,
              },
            });

            if (!url) {
              failed.push({
                shortCode,
                error: 'URL not found or not owned by user',
              });
              return;
            }
          }

          const deleted = await this.deleteUrl(shortCode);
          if (deleted) {
            successful.push(shortCode);
          } else {
            failed.push({
              shortCode,
              error: 'URL not found or already deleted',
            });
          }
        } catch (error) {
          failed.push({
            shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    return { successful, failed };
  }

  /**
   * Bulk update URLs
   */
  static async bulkUpdateUrls(
    updates: Array<{
      shortCode: string;
      data: Partial<{
        description: string;
        expiresAt: string;
        isActive: boolean;
        customAlias: string;
      }>;
    }>,
    userId?: number
  ): Promise<{
    successful: UrlResponse[];
    failed: { shortCode: string; error: string }[];
  }> {
    const successful: UrlResponse[] = [];
    const failed: { shortCode: string; error: string }[] = [];

    await Promise.all(
      updates.map(async (update) => {
        try {
          // If userId is provided, verify ownership
          if (userId) {
            const url = await prisma.url.findFirst({
              where: {
                OR: [
                  { shortCode: update.shortCode },
                  { customAlias: update.shortCode },
                ],
                userId,
              },
            });

            if (!url) {
              failed.push({
                shortCode: update.shortCode,
                error: 'URL not found or not owned by user',
              });
              return;
            }
          }

          const updated = await this.updateUrl(update.shortCode, update.data);
          if (updated) {
            successful.push(updated);
          } else {
            failed.push({
              shortCode: update.shortCode,
              error: 'URL not found',
            });
          }
        } catch (error) {
          failed.push({
            shortCode: update.shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    return { successful, failed };
  }

  /**
   * Record a click/visit to a URL
   */
  static async recordClick(
    urlId: number,
    ipAddress?: string,
    userAgent?: string,
    referer?: string
  ) {
    await prisma.analytics.create({
      data: {
        urlId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        referer: referer || null,
      },
    });
  }

  /**
   * Get click count for a URL
   */
  private static async getClickCount(urlId: number): Promise<number> {
    return await prisma.analytics.count({
      where: { urlId },
    });
  }

  /**
   * Generate a unique short code
   */
  private static async generateUniqueShortCode(): Promise<string> {
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode();
      const existing = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode }, { customAlias: shortCode }],
        },
      });

      if (!existing) {
        break;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique short code');
      }
    } while (true);

    return shortCode;
  }

  /**
   * Format URL data for response
   */
  private static formatUrlResponse(url: any, clickCount: number): UrlResponse {
    return {
      id: String(url.id),
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      shortUrl: generateShortUrl(url.shortCode),
      title: url.title,
      description: url.description,
      customAlias: url.customAlias,
      isActive: url.isActive,
      expiresAt: url.expiresAt?.toISOString(),
      createdAt: url.createdAt.toISOString(),
      updatedAt: url.updatedAt.toISOString(),
      clickCount,
    };
  }
}
