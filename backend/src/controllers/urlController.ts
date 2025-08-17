import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/urlService';
import { CreateUrlRequest, AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

export class UrlController {
  /**
   * Create a short URL
   * POST /api/v1/urls
   */
  static async createShortUrl(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        originalUrl,
        customAlias,
        customDomain,
        password,
        expiresAt,
        description,
      }: CreateUrlRequest = req.body;

      // Validate required fields
      if (!originalUrl) {
        res.status(400).json({
          success: false,
          message: 'Original URL is required',
        });
        return;
      }

      // Create the short URL
      const urlData = await UrlService.createShortUrl(
        {
          originalUrl,
          customAlias,
          customDomain,
          password,
          expiresAt,
          description,
        },
        req.user?.id
      );

      logger.info('Short URL created', {
        shortCode: urlData.shortCode,
        originalUrl: urlData.originalUrl,
        userId: req.user?.id,
        hasPassword: !!password,
        customDomain: customDomain,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Short URL created successfully',
        data: urlData,
      });
    } catch (error) {
      logger.error('Error creating short URL:', error);

      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get URL details by short code
   * GET /api/v1/urls/:shortCode
   */
  static async getUrlDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const urlData = await UrlService.getUrlByShortCode(shortCode);

      if (!urlData) {
        res.status(404).json({
          success: false,
          message: 'URL not found or expired',
        });
        return;
      }

      res.json({
        success: true,
        message: 'URL details retrieved successfully',
        data: urlData,
      });
    } catch (error) {
      logger.error('Error getting URL details:', error);
      next(error);
    }
  }

  /**
   * List URLs with pagination
   * GET /api/v1/urls
   */
  static async listUrls(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message:
            'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
        });
        return;
      }

      const result = await UrlService.listUrls(page, limit);

      // Adapt response shape to frontend expectations
      res.json({
        success: true,
        message: 'URLs retrieved successfully',
        data: {
          urls: result.data,
          pagination: {
            currentPage: result.pagination.page,
            totalPages: result.pagination.totalPages,
            totalCount: result.pagination.total,
            hasNext: result.pagination.hasNext,
            hasPrev: result.pagination.hasPrev,
          },
        },
      });
    } catch (error) {
      logger.error('Error listing URLs:', error);
      next(error);
    }
  }

  /**
   * Update URL by short code
   * PUT /api/v1/urls/:shortCode
   */
  static async updateUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;
      if (!shortCode) {
        res
          .status(400)
          .json({ success: false, message: 'Short code is required' });
        return;
      }

      const { description, expiresAt, isActive, customAlias } =
        req.body as Partial<{
          description: string;
          expiresAt: string;
          isActive: boolean;
          customAlias: string;
        }>;

      const updated = await UrlService.updateUrl(shortCode, {
        description,
        expiresAt,
        isActive,
        customAlias,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'URL not found' });
        return;
      }

      res.json({
        success: true,
        message: 'URL updated successfully',
        data: updated,
      });
    } catch (error) {
      logger.error('Error updating URL:', error);
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * Get analytics for a URL by short code
   * GET /api/v1/urls/:shortCode/analytics
   */
  static async getUrlAnalytics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { shortCode } = req.params;
      const { start, end } = req.query as { start?: string; end?: string };

      if (!shortCode) {
        res
          .status(400)
          .json({ success: false, message: 'Short code is required' });
        return;
      }

      const analytics = await UrlService.getAnalytics(shortCode, start, end);
      if (!analytics) {
        res.status(404).json({ success: false, message: 'URL not found' });
        return;
      }

      res.json({ success: true, data: analytics });
    } catch (error) {
      logger.error('Error getting analytics:', error);
      next(error);
    }
  }

  /**
   * Verify password for password-protected URL
   * POST /api/v1/urls/:shortCode/verify-password
   */
  static async verifyUrlPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { shortCode } = req.params;
      const { password } = req.body;

      if (!shortCode) {
        res
          .status(400)
          .json({ success: false, message: 'Short code is required' });
        return;
      }

      if (!password) {
        res
          .status(400)
          .json({ success: false, message: 'Password is required' });
        return;
      }

      const isValid = await UrlService.verifyUrlPassword(shortCode, password);

      if (!isValid) {
        res.status(401).json({ success: false, message: 'Invalid password' });
        return;
      }

      // Get the original URL for redirection
      const originalUrl = await UrlService.getOriginalUrl(shortCode);
      if (!originalUrl) {
        res
          .status(404)
          .json({ success: false, message: 'URL not found or expired' });
        return;
      }

      res.json({
        success: true,
        message: 'Password verified successfully',
        data: { originalUrl },
      });
    } catch (error) {
      logger.error('Error verifying URL password:', error);
      next(error);
    }
  }

  /**
   * Delete URL by short code
   * DELETE /api/v1/urls/:shortCode
   */
  static async deleteUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const deleted = await UrlService.deleteUrl(shortCode);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      logger.info('URL deleted', {
        shortCode,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'URL deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting URL:', error);
      next(error);
    }
  }

  /**
   * Redirect to original URL
   * GET /:shortCode
   */
  static async redirectToOriginal(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(404).json({
          success: false,
          message: 'Short code not provided',
        });
        return;
      }

      // Get URL details to check for password protection
      const urlDetails = await UrlService.getUrlByShortCode(shortCode);
      if (!urlDetails) {
        res.status(404).json({
          success: false,
          message: 'URL not found or expired',
        });
        return;
      }

      // Check if URL is password protected
      const url = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode }, { customAlias: shortCode }],
          isActive: true,
        },
        select: { password: true, originalUrl: true, id: true },
      });

      if (url?.password) {
        // URL is password protected, return special response
        res.status(423).json({
          success: false,
          message: 'This URL is password protected',
          requiresPassword: true,
          shortCode: shortCode,
        });
        return;
      }

      const originalUrl = await UrlService.getOriginalUrl(shortCode);

      if (!originalUrl) {
        res.status(404).json({
          success: false,
          message: 'URL not found or expired',
        });
        return;
      }

      // Record the click/visit
      if (url) {
        await UrlService.recordClick(
          url.id,
          req.ip,
          req.get('User-Agent'),
          req.get('Referer')
        );

        logger.info('URL accessed', {
          shortCode,
          originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      // Redirect to the original URL
      res.redirect(301, originalUrl);
    } catch (error) {
      logger.error('Error redirecting URL:', error);
      next(error);
    }
  }
}
