import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/urlService';
import { CreateUrlRequest, AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { EnhancedPasswordService } from '../services/enhancedPasswordService';

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

      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent');

      // Check if already verified for this IP
      const alreadyVerified = await EnhancedPasswordService.isPasswordVerified(
        shortCode,
        ipAddress
      );
      if (alreadyVerified) {
        const originalUrl = await UrlService.getOriginalUrl(shortCode);
        if (originalUrl) {
          res.json({
            success: true,
            message: 'Password already verified',
            data: { originalUrl },
          });
          return;
        }
      }

      // Verify password with rate limiting
      const result = await EnhancedPasswordService.verifyPasswordWithRateLimit(
        shortCode,
        password,
        ipAddress,
        userAgent
      );

      if (!result.success) {
        const status = result.lockoutTime ? 429 : 401;
        res.status(status).json({
          success: false,
          message: result.message,
          data: {
            remainingAttempts: result.remainingAttempts,
            lockoutTime: result.lockoutTime,
          },
        });
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
        message: result.message,
        data: { originalUrl },
      });
    } catch (error) {
      logger.error('Error verifying URL password:', error);
      next(error);
    }
  }

  /**
   * Check password strength
   * POST /api/v1/urls/check-password-strength
   */
  static async checkPasswordStrength(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { password } = req.body;

      if (!password) {
        res.status(400).json({
          success: false,
          message: 'Password is required',
        });
        return;
      }

      const validation = EnhancedPasswordService.validatePassword(password);

      res.json({
        success: true,
        data: {
          valid: validation.valid,
          errors: validation.errors,
          strength: validation.strength,
        },
      });
    } catch (error) {
      logger.error('Error checking password strength:', error);
      next(error);
    }
  }

  /**
   * Generate secure password
   * POST /api/v1/urls/generate-password
   */
  static async generateSecurePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { length = 12 } = req.body;

      if (length < 8 || length > 128) {
        res.status(400).json({
          success: false,
          message: 'Password length must be between 8 and 128 characters',
        });
        return;
      }

      const password =
        EnhancedPasswordService.generateTemporaryPassword(length);
      const validation = EnhancedPasswordService.validatePassword(password);

      res.json({
        success: true,
        data: {
          password,
          strength: validation.strength,
        },
      });
    } catch (error) {
      logger.error('Error generating secure password:', error);
      next(error);
    }
  }

  /**
   * Update URL password
   * PUT /api/v1/urls/:shortCode/password
   */
  static async updateUrlPassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { shortCode } = req.params;
      const { password } = req.body;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const result = await EnhancedPasswordService.updateUrlPassword(
        shortCode,
        password
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Failed to update password',
          errors: result.errors,
        });
        return;
      }

      res.json({
        success: true,
        message: password
          ? 'Password updated successfully'
          : 'Password removed successfully',
      });
    } catch (error) {
      logger.error('Error updating URL password:', error);
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

  /**
   * Verify password for password-protected URL
   * POST /:shortCode/verify-password
   */
  static async verifyPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;
      const { password } = req.body;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          success: false,
          message: 'Password is required',
        });
        return;
      }

      const result = await EnhancedPasswordService.verifyPasswordWithRateLimit(
        shortCode,
        password,
        req.ip || '',
        req.get('User-Agent')
      );

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: result.message,
          attemptsRemaining: result.remainingAttempts,
          lockoutExpiry: result.lockoutTime,
        });
        return;
      }

      // Get the original URL for redirect
      const originalUrl = await UrlService.getOriginalUrl(shortCode);
      if (!originalUrl) {
        res.status(404).json({
          success: false,
          message: 'URL not found or expired',
        });
        return;
      }

      // Record the click/visit
      const url = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode }, { customAlias: shortCode }],
          isActive: true,
        },
        select: { id: true },
      });

      if (url) {
        await UrlService.recordClick(
          url.id,
          req.ip,
          req.get('User-Agent'),
          req.get('Referer')
        );

        logger.info('Password-protected URL accessed', {
          shortCode,
          originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      res.json({
        success: true,
        message: 'Password verified successfully',
        originalUrl: originalUrl,
      });
    } catch (error) {
      logger.error('Error verifying URL password:', error);
      next(error);
    }
  }

  /**
   * Bulk create short URLs
   * POST /api/v1/urls/bulk
   */
  static async bulkCreateUrls(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({
          success: false,
          message: 'URLs array is required and must not be empty',
        });
        return;
      }

      if (urls.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Maximum 100 URLs can be created at once',
        });
        return;
      }

      const results = await UrlService.bulkCreateUrls(urls, req.user?.id);

      res.status(201).json({
        success: true,
        message: `Successfully created ${results.successful.length} URLs`,
        data: {
          successful: results.successful,
          failed: results.failed,
          summary: {
            total: urls.length,
            successful: results.successful.length,
            failed: results.failed.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error bulk creating URLs:', error);
      next(error);
    }
  }

  /**
   * Bulk delete URLs
   * DELETE /api/v1/urls/bulk
   */
  static async bulkDeleteUrls(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { shortCodes } = req.body;

      if (!Array.isArray(shortCodes) || shortCodes.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Short codes array is required and must not be empty',
        });
        return;
      }

      if (shortCodes.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Maximum 100 URLs can be deleted at once',
        });
        return;
      }

      const results = await UrlService.bulkDeleteUrls(shortCodes, req.user?.id);

      res.json({
        success: true,
        message: `Successfully deleted ${results.successful.length} URLs`,
        data: {
          successful: results.successful,
          failed: results.failed,
          summary: {
            total: shortCodes.length,
            successful: results.successful.length,
            failed: results.failed.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error bulk deleting URLs:', error);
      next(error);
    }
  }

  /**
   * Bulk update URLs
   * PUT /api/v1/urls/bulk
   */
  static async bulkUpdateUrls(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Updates array is required and must not be empty',
        });
        return;
      }

      if (updates.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Maximum 100 URLs can be updated at once',
        });
        return;
      }

      const results = await UrlService.bulkUpdateUrls(updates, req.user?.id);

      res.json({
        success: true,
        message: `Successfully updated ${results.successful.length} URLs`,
        data: {
          successful: results.successful,
          failed: results.failed,
          summary: {
            total: updates.length,
            successful: results.successful.length,
            failed: results.failed.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error bulk updating URLs:', error);
      next(error);
    }
  }
}
