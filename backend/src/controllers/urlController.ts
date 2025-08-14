import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/urlService';
import { CreateUrlRequest } from '../types';
import { logger } from '../utils/logger';

export class UrlController {
  /**
   * Create a short URL
   * POST /api/v1/urls
   */
  static async createShortUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        originalUrl,
        customAlias,
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
      const urlData = await UrlService.createShortUrl({
        originalUrl,
        customAlias,
        expiresAt,
        description,
      });

      logger.info('Short URL created', {
        shortCode: urlData.shortCode,
        originalUrl: urlData.originalUrl,
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

      res.json({
        success: true,
        message: 'URLs retrieved successfully',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error listing URLs:', error);
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

      const originalUrl = await UrlService.getOriginalUrl(shortCode);

      if (!originalUrl) {
        res.status(404).json({
          success: false,
          message: 'URL not found or expired',
        });
        return;
      }

      // Record the click/visit
      const url = await UrlService.getUrlByShortCode(shortCode);
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
