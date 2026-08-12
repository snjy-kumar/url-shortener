import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { UrlService } from '../services/urlService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { asStringParam } from '../utils/request.js';
import { AppError } from '../utils/errors.js';
import { isAdminUserId } from '../middleware/requireAdmin.js';
import { metrics } from '../utils/metrics.js';
import { prisma } from '../config/database.js';
import { getRedirectCacheMode } from '../utils/redirectCache.js';

export class AdminController {
  static me = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.isAuthenticated ? auth.userId : null;
    res.status(200).json({
      success: true,
      data: {
        isAdmin: userId ? isAdminUserId(userId) : false,
      },
    });
  });

  static metrics = asyncHandler(async (_req: Request, res: Response) => {
    let database: 'healthy' | 'unhealthy' = 'unhealthy';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'healthy';
    } catch {
      database = 'unhealthy';
    }

    res.status(200).json({
      success: true,
      data: {
        ...metrics.snapshot(),
        services: { database },
        redirectCache: getRedirectCacheMode(),
      },
    });
  });

  static audit = asyncHandler(async (req: Request, res: Response) => {
    const limit = Number(req.query['limit'] ?? 50);
    const data = await UrlService.adminListAudit(
      Number.isFinite(limit) ? limit : 50
    );
    res.status(200).json({
      success: true,
      data,
    });
  });

  static getUrl = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }
    const data = await UrlService.adminGetByShortCode(shortCode);
    res.status(200).json({
      success: true,
      data,
    });
  });

  static disableUrl = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }
    const auth = getAuth(req);
    const adminUserId = auth.isAuthenticated ? auth.userId : 'unknown';
    const data = await UrlService.adminDisableByShortCode(
      shortCode,
      adminUserId
    );
    res.status(200).json({
      success: true,
      message: 'Short URL disabled',
      data,
    });
  });

  static listAbuse = asyncHandler(async (req: Request, res: Response) => {
    const status = String(req.query['status'] ?? 'open');
    const limit = Number(req.query['limit'] ?? 50);
    const data = await UrlService.adminListAbuse(
      status,
      Number.isFinite(limit) ? limit : 50
    );
    res.status(200).json({ success: true, data });
  });

  static resolveAbuse = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params['id']);
    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400);
    }
    const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
    const auth = getAuth(req);
    const adminUserId = auth.isAuthenticated ? auth.userId : 'unknown';
    const row = await UrlService.adminResolveAbuse(id, adminUserId, status);
    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        status: row.status,
      },
    });
  });
}
