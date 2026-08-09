import { Request, Response } from 'express';
import { UrlService } from '../services/urlService.js';
import { CreateUrlRequest, UpdateUrlRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { asStringParam } from '../utils/request.js';
import { AppError } from '../utils/errors.js';
import {
  deadLinkMessage,
  renderDeadLinkPage,
} from '../utils/deadLinkPage.js';

const wantsHtml = (req: Request): boolean => {
  const accept = req.get('Accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return false;
  }
  return req.accepts(['html', 'json']) === 'html' || !accept.includes('json');
};

export class UrlController {
  static createShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const urlData = await UrlService.createShortUrl(req.body as CreateUrlRequest);
    res.status(201).json({
      success: true,
      message: 'Short URL created',
      data: urlData,
    });
  });

  static listUrls = asyncHandler(async (req: Request, res: Response) => {
    const limit = Number(req.query['limit'] ?? 50);
    const offset = Number(req.query['offset'] ?? 0);
    const result = await UrlService.listUrls(
      Number.isFinite(limit) ? limit : 50,
      Number.isFinite(offset) ? offset : 0
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  static getShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    const urlData = await UrlService.getByShortCode(shortCode);
    res.status(200).json({
      success: true,
      data: urlData,
    });
  });

  static updateShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    const urlData = await UrlService.updateByShortCode(
      shortCode,
      req.body as UpdateUrlRequest
    );
    res.status(200).json({
      success: true,
      message: 'Short URL updated',
      data: urlData,
    });
  });

  static deleteShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      throw new AppError('Not found', 404);
    }

    await UrlService.deleteByShortCode(shortCode);
    res.status(200).json({
      success: true,
      message: 'Short URL deleted',
    });
  });

  static redirectToOriginal = asyncHandler(async (req: Request, res: Response) => {
    const shortCode = asStringParam(req.params['shortCode']);
    if (!shortCode) {
      if (wantsHtml(req)) {
        res.status(404).type('html').send(renderDeadLinkPage('not_found'));
        return;
      }
      throw new AppError('Not found', 404);
    }

    const resolved = await UrlService.resolveRedirect(shortCode);
    if (resolved.ok) {
      res.redirect(302, resolved.originalUrl);
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
  });
}
