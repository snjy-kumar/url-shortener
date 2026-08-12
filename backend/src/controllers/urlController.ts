import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { UrlService } from '../services/urlService.js';
import {
  ClaimUrlRequest,
  CreateUrlRequest,
  UpdateUrlRequest,
} from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { asStringParam } from '../utils/request.js';
import { AppError } from '../utils/errors.js';
import {
  deadLinkMessage,
  renderDeadLinkPage,
} from '../utils/deadLinkPage.js';
import { metrics } from '../utils/metrics.js';
import { verifyTurnstileIfNeeded } from '../utils/turnstile.js';
import { renderPasswordGatePage } from '../utils/passwordGatePage.js';
import { generateShortUrl, normalizeShortCode } from '../utils/url.js';
import QRCode from 'qrcode';
import type { AbuseReportRequest, BulkCreateRequest } from '../types/index.js';

const wantsHtml = (req: Request): boolean => {
  const accept = req.get('Accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return false;
  }
  return req.accepts(['html', 'json']) === 'html' || !accept.includes('json');
};

const requireUserId = (req: Request): string => {
  const auth = getAuth(req);
  if (!auth.isAuthenticated) {
    throw new AppError('Unauthorized', 401);
  }
  return auth.userId;
};

const optionalUserId = (req: Request): string | null => {
  const auth = getAuth(req);
  if (auth.isAuthenticated) {
    return auth.userId;
  }
  return null;
};

export class UrlController {
  static createShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = optionalUserId(req);
    const body = req.body as CreateUrlRequest;
    await verifyTurnstileIfNeeded(
      body.turnstileToken,
      req.ip,
      clerkUserId === null
    );
    const urlData = await UrlService.createShortUrl(body, clerkUserId);
    res.status(201).json({
      success: true,
      message: 'Short URL created',
      data: urlData,
    });
  });

  static claimShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }
    const body = req.body as ClaimUrlRequest;
    if (!body.claimToken || typeof body.claimToken !== 'string') {
      throw new AppError('claimToken required', 400);
    }
    const urlData = await UrlService.claimShortUrl(
      shortCode,
      body.claimToken,
      clerkUserId
    );
    res.status(200).json({
      success: true,
      message: 'Short URL claimed',
      data: urlData,
    });
  });

  static listUrls = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const limit = Number(req.query['limit'] ?? 50);
    const offset = Number(req.query['offset'] ?? 0);
    const result = await UrlService.listUrls(
      clerkUserId,
      Number.isFinite(limit) ? limit : 50,
      Number.isFinite(offset) ? offset : 0
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  static getShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    const urlData = await UrlService.getByShortCode(shortCode, clerkUserId);
    res.status(200).json({
      success: true,
      data: urlData,
    });
  });

  static getAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }
    const limit = Number(req.query['limit'] ?? 50);
    const data = await UrlService.getClickAnalytics(
      shortCode,
      clerkUserId,
      Number.isFinite(limit) ? limit : 50
    );
    res.status(200).json({
      success: true,
      data,
    });
  });

  static updateShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    const urlData = await UrlService.updateByShortCode(
      shortCode,
      req.body as UpdateUrlRequest,
      clerkUserId
    );
    res.status(200).json({
      success: true,
      message: 'Short URL updated',
      data: urlData,
    });
  });

  static deleteShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    await UrlService.deleteByShortCode(shortCode, clerkUserId);
    res.status(200).json({
      success: true,
      message: 'Short URL deleted',
    });
  });

  static createBulk = asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireUserId(req);
    const result = await UrlService.createBulk(
      req.body as BulkCreateRequest,
      clerkUserId
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  });

  static getQr = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }
    const code = normalizeShortCode(shortCode);
    const shortUrl = generateShortUrl(code);
    const png = await QRCode.toBuffer(shortUrl, {
      type: 'png',
      width: 512,
      margin: 2,
    });
    res.type('png').send(png);
  });

  static reportAbuse = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as AbuseReportRequest;
    if (!body.shortCode || !body.reason) {
      throw new AppError('shortCode and reason required', 400);
    }
    const data = await UrlService.reportAbuse({
      shortCode: body.shortCode,
      reason: body.reason,
      reporterEmail: body.reporterEmail,
    });
    res.status(201).json({
      success: true,
      message: 'Abuse report submitted',
      data,
    });
  });

  static unlockRedirect = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';
    if (!shortCode) {
      res.status(404).type('html').send(renderDeadLinkPage('not_found'));
      return;
    }
    try {
      const resolved = await UrlService.unlockRedirect(shortCode, password, {
        referrer: req.get('referer') || undefined,
        userAgent: req.get('user-agent') || undefined,
        ip: req.ip,
      });
      if (resolved.ok) {
        res.redirect(302, resolved.originalUrl);
        return;
      }
      if (resolved.reason === 'password_required') {
        res
          .status(401)
          .type('html')
          .send(renderPasswordGatePage(shortCode, 'Password required'));
        return;
      }
      const status = resolved.reason === 'not_found' ? 404 : 410;
      res
        .status(status)
        .type('html')
        .send(renderDeadLinkPage(resolved.reason));
    } catch {
      res
        .status(403)
        .type('html')
        .send(renderPasswordGatePage(shortCode, 'Invalid password'));
    }
  });

  static redirectToOriginal = asyncHandler(async (req: Request, res: Response) => {
    const started = performance.now();
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      metrics.recordRedirect(performance.now() - started, 'miss');
      if (wantsHtml(req)) {
        res.status(404).type('html').send(renderDeadLinkPage('not_found'));
        return;
      }
      throw new AppError('Not found', 404);
    }

    try {
      const resolved = await UrlService.resolveRedirect(shortCode, {
        referrer: req.get('referer') || undefined,
        userAgent: req.get('user-agent') || undefined,
        ip: req.ip,
      });
      if (resolved.ok) {
        metrics.recordRedirect(performance.now() - started, 'hit');
        res.redirect(302, resolved.originalUrl);
        return;
      }

      metrics.recordRedirect(performance.now() - started, 'miss');

      if (resolved.reason === 'password_required') {
        if (wantsHtml(req)) {
          res.status(401).type('html').send(renderPasswordGatePage(shortCode));
          return;
        }
        res.status(401).json({
          success: false,
          message: 'Password required',
          reason: 'password_required',
        });
        return;
      }

      const status = resolved.reason === 'not_found' ? 404 : 410;
      const message = deadLinkMessage(resolved.reason);

      if (wantsHtml(req)) {
        res.status(status).type('html').send(renderDeadLinkPage(resolved.reason));
        return;
      }

      res.status(status).json({
        success: false,
        message,
        reason: resolved.reason,
      });
    } catch (error) {
      metrics.recordRedirect(performance.now() - started, 'error');
      throw error;
    }
  });
}
