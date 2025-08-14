import { prisma } from '../config/database';
import {
  generateShortCode,
  isValidUrl,
  normalizeUrl,
  generateShortUrl,
} from '../utils/url';
import { CreateUrlRequest, UrlResponse } from '../types';

export class UrlService {
  /**
   * Create a short URL from a long URL
   */
  static async createShortUrl(data: CreateUrlRequest): Promise<UrlResponse> {
    const { originalUrl, customAlias, expiresAt, description } = data;

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
        description: description || null,
        expiresAt: expirationDate || null,
      },
    });

    // Get click count (will be 0 for new URLs)
    const clickCount = await this.getClickCount(url.id);

    return this.formatUrlResponse(url, clickCount);
  }

  /**
   * Get URL details by short code
   */
  static async getUrlByShortCode(
    shortCode: string
  ): Promise<UrlResponse | null> {
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

    const clickCount = await this.getClickCount(url.id);
    return this.formatUrlResponse(url, clickCount);
  }

  /**
   * Get original URL for redirection
   */
  static async getOriginalUrl(shortCode: string): Promise<string | null> {
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

    return true;
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
      id: url.id,
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
