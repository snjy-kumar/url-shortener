import { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { UrlService } from '../services/urlService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class ClerkWebhookController {
  static handle = asyncHandler(async (req: Request, res: Response) => {
    if (!config.CLERK_WEBHOOK_SIGNING_SECRET) {
      logger.error('CLERK_WEBHOOK_SIGNING_SECRET not configured');
      res.status(503).json({ success: false, message: 'Webhooks not configured' });
      return;
    }

    let evt;
    try {
      evt = await verifyWebhook(req, {
        signingSecret: config.CLERK_WEBHOOK_SIGNING_SECRET,
      });
    } catch (err) {
      logger.warn('Clerk webhook verification failed', {
        requestId: req.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
      res.status(400).json({ success: false, message: 'Invalid webhook' });
      return;
    }

    if (evt.type === 'user.deleted') {
      const userId = evt.data.id;
      if (!userId) {
        logger.warn('user.deleted webhook missing id', { requestId: req.id });
        res.status(400).json({ success: false, message: 'Missing user id' });
        return;
      }

      const deleted = await UrlService.deleteAllForClerkUser(userId);
      logger.info('Purged URLs for deleted Clerk user', {
        clerkUserId: userId,
        deleted,
        requestId: req.id,
      });
    } else {
      logger.debug('Ignored Clerk webhook event', {
        type: evt.type,
        requestId: req.id,
      });
    }

    res.status(200).json({ success: true });
  });
}
