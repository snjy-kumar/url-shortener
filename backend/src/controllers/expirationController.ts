import { Request, Response } from 'express';
import { ExpirationService } from '../services/expirationService';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

export class ExpirationController {
  /**
   * Get expiration statistics
   * GET /api/v1/expiration/stats
   */
  static async getStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const stats = await ExpirationService.getExpirationStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting expiration stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Manually trigger cleanup
   * POST /api/v1/expiration/cleanup
   */
  static async triggerCleanup(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const result = await ExpirationService.performCleanup();

      res.json({
        success: true,
        message: 'Cleanup completed successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error triggering cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Extend expiration for URLs
   * POST /api/v1/expiration/extend
   */
  static async extendExpiration(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { urlIds, newExpirationDate } = req.body;

      if (!Array.isArray(urlIds) || urlIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'URL IDs array is required and must not be empty',
        });
        return;
      }

      if (!newExpirationDate) {
        res.status(400).json({
          success: false,
          message: 'New expiration date is required',
        });
        return;
      }

      // Validate expiration date
      let validatedDate: Date;
      try {
        validatedDate =
          ExpirationService.validateExpirationDate(newExpirationDate);
      } catch (validationError) {
        res.status(400).json({
          success: false,
          message:
            validationError instanceof Error
              ? validationError.message
              : 'Invalid expiration date',
        });
        return;
      }

      const result = await ExpirationService.extendExpiration(
        urlIds,
        validatedDate
      );

      res.json({
        success: true,
        message: `Successfully extended expiration for ${result.updated} URLs`,
        data: result,
      });
    } catch (error) {
      logger.error('Error extending expiration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Clean up specific URLs
   * POST /api/v1/expiration/cleanup-specific
   */
  static async cleanupSpecific(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { urlIds } = req.body;

      if (!Array.isArray(urlIds) || urlIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'URL IDs array is required and must not be empty',
        });
        return;
      }

      const result = await ExpirationService.cleanupSpecificUrls(urlIds);

      res.json({
        success: true,
        message: `Successfully cleaned up ${result.cleaned} URLs`,
        data: result,
      });
    } catch (error) {
      logger.error('Error cleaning up specific URLs:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get expiration service status
   * GET /api/v1/expiration/status
   */
  static async getStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const status = ExpirationService.getStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error getting expiration service status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}
