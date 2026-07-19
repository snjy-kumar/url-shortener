import { Request, Response } from 'express';
import { UrlService } from '../services/urlService.js';
import { CreateUrlRequest, UpdateUrlRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { asStringParam } from '../utils/request.js';
import { AppError } from '../utils/errors.js';

export class UrlController {
  static createShortUrl = asyncHandler(async (req: Request, res: Response) => {
    const urlData = await UrlService.createShortUrl(req.body as CreateUrlRequest);
    res.status(201).json({
      success: true,
      message: 'Short URL created',
      data: urlData,
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
      throw new AppError('Not found', 404);
    }

    const resolved = await UrlService.resolveRedirect(shortCode);
    if (!resolved) {
      throw new AppError('URL not found', 404);
    }

    res.redirect(302, resolved.originalUrl);
  });
}
