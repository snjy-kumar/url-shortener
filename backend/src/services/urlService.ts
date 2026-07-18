import { prisma } from '../config/database.js';
import {
  RESERVED_SHORT_CODES,
  generateShortCode,
  generateShortUrl,
  isValidUrl,
  normalizeUrl,
} from '../utils/url.js';
import { AppError } from '../utils/errors.js';
import { CacheService } from './cacheService.js';
import { CreateUrlRequest, UrlResponse } from '../types/index.js';

type UrlRow = {
  id: number;
  shortCode: string;
  originalUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export class UrlService {
  static async createShortUrl(data: CreateUrlRequest): Promise<UrlResponse> {
    const normalizedUrl = normalizeUrl(data.originalUrl);
    if (!isValidUrl(normalizedUrl)) {
      throw new AppError('Invalid URL provided', 400);
    }

    let shortCode: string;
    if (data.customAlias) {
      const alias = data.customAlias.toLowerCase();
      if (RESERVED_SHORT_CODES.has(alias)) {
        throw new AppError('This alias is reserved', 400);
      }
      if (!/^[a-zA-Z0-9_-]{3,50}$/.test(data.customAlias)) {
        throw new AppError(
          'Custom alias must be 3-50 characters (letters, numbers, - or _)',
          400
        );
      }
      const taken = await prisma.url.findUnique({
        where: { shortCode: data.customAlias },
      });
      if (taken) {
        throw new AppError('Custom alias already exists', 409);
      }
      shortCode = data.customAlias;
    } else {
      shortCode = await this.generateUniqueShortCode();
    }

    const url = await prisma.url.create({
      data: {
        shortCode,
        originalUrl: normalizedUrl,
      },
    });

    return this.format(url);
  }

  static async resolveRedirect(shortCode: string): Promise<{
    id: number;
    originalUrl: string;
  } | null> {
    const cached = await CacheService.getCachedUrl(shortCode);
    if (cached) {
      return { id: cached.id, originalUrl: cached.originalUrl };
    }

    const url = await prisma.url.findUnique({ where: { shortCode } });
    if (!url) {
      return null;
    }

    await CacheService.cacheUrl(shortCode, {
      id: url.id,
      originalUrl: url.originalUrl,
    });

    return { id: url.id, originalUrl: url.originalUrl };
  }

  private static async generateUniqueShortCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const shortCode = generateShortCode();
      if (RESERVED_SHORT_CODES.has(shortCode.toLowerCase())) {
        continue;
      }
      const existing = await prisma.url.findUnique({ where: { shortCode } });
      if (!existing) {
        return shortCode;
      }
    }
    throw new AppError('Unable to generate unique short code', 500);
  }

  private static format(url: UrlRow): UrlResponse {
    return {
      id: url.id,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      shortUrl: generateShortUrl(url.shortCode),
      createdAt: url.createdAt.toISOString(),
      updatedAt: url.updatedAt.toISOString(),
    };
  }
}
