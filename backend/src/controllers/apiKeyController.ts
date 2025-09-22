import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiKeyService } from '../services/apiKeyService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';

export class ApiKeyController {
  /**
   * Create a new API key
   */
  static async createApiKey(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((error) => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
          })),
        });
        return;
      }

      const userId = req.user!.id;
      const { name, expiresAt } = req.body;

      const apiKey = await ApiKeyService.createApiKey(userId, name, expiresAt);

      logger.info(`API key created for user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'API key created successfully',
        data: apiKey,
      });
    } catch (error) {
      logger.error('Error creating API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * List user's API keys
   */
  static async listApiKeys(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      const result = await ApiKeyService.listApiKeys(userId, page, limit);

      res.json({
        success: true,
        message: 'API keys retrieved successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error listing API keys:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get API key details
   */
  static async getApiKey(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          message: 'API key ID is required',
        });
        return;
      }

      const apiKey = await ApiKeyService.getApiKey(parseInt(keyId), userId);

      if (!apiKey) {
        res.status(404).json({
          success: false,
          message: 'API key not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'API key retrieved successfully',
        data: apiKey,
      });
    } catch (error) {
      logger.error('Error getting API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Update API key
   */
  static async updateApiKey(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((error) => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
          })),
        });
        return;
      }

      const userId = req.user!.id;
      const { keyId } = req.params;
      const { name, isActive } = req.body;

      if (!keyId) {
        res.status(400).json({
          success: false,
          message: 'API key ID is required',
        });
        return;
      }

      const apiKey = await ApiKeyService.updateApiKey(parseInt(keyId), userId, {
        name,
        isActive,
      });

      if (!apiKey) {
        res.status(404).json({
          success: false,
          message: 'API key not found',
        });
        return;
      }

      logger.info(`API key ${keyId} updated by user ${userId}`);

      res.json({
        success: true,
        message: 'API key updated successfully',
        data: apiKey,
      });
    } catch (error) {
      logger.error('Error updating API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Delete API key
   */
  static async deleteApiKey(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          message: 'API key ID is required',
        });
        return;
      }

      const deleted = await ApiKeyService.deleteApiKey(parseInt(keyId), userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'API key not found',
        });
        return;
      }

      logger.info(`API key ${keyId} deleted by user ${userId}`);

      res.json({
        success: true,
        message: 'API key deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Regenerate API key
   */
  static async regenerateApiKey(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          message: 'API key ID is required',
        });
        return;
      }

      const apiKey = await ApiKeyService.regenerateApiKey(
        parseInt(keyId),
        userId
      );

      if (!apiKey) {
        res.status(404).json({
          success: false,
          message: 'API key not found',
        });
        return;
      }

      logger.info(`API key ${keyId} regenerated by user ${userId}`);

      res.json({
        success: true,
        message: 'API key regenerated successfully',
        data: apiKey,
      });
    } catch (error) {
      logger.error('Error regenerating API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get API key usage statistics
   */
  static async getApiKeyStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const keyId = parseInt(req.params['keyId'] || '0');
      const userId = req.user!.id;

      if (isNaN(keyId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid API key ID',
        });
        return;
      }

      const stats = await ApiKeyService.getApiKeyStats(keyId, userId);

      if (!stats) {
        res.status(404).json({
          success: false,
          message: 'API key not found',
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting API key stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}
