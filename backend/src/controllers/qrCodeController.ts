import { Request, Response, NextFunction } from 'express';
import { QRCodeService } from '../services/qrCodeService';
import { logger } from '../utils/logger';

export class QRCodeController {
  /**
   * Generate QR code for a short URL
   * POST /api/v1/qr/:shortCode
   */
  static async generateQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;
      const {
        size = 256,
        color = '#000000',
        backgroundColor = '#ffffff',
        format = 'PNG',
        logoUrl,
        logoSize = 64,
      } = req.body;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const qrCodeData = await QRCodeService.generateQRCode(shortCode, {
        size: parseInt(size as string),
        color,
        backgroundColor,
        format: format as 'PNG' | 'SVG',
        logoUrl,
        logoSize: parseInt(logoSize as string),
      });

      if (!qrCodeData) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      logger.info('QR code generated', {
        shortCode,
        format,
        size,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'QR code generated successfully',
        data: qrCodeData,
      });
    } catch (error) {
      logger.error('Error generating QR code:', error);
      next(error);
    }
  }

  /**
   * Download QR code
   * GET /api/v1/qr/:shortCode/download
   */
  static async downloadQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { shortCode } = req.params;
      const {
        size = 256,
        color = '#000000',
        backgroundColor = '#ffffff',
        format = 'PNG',
      } = req.query;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const qrCodeBuffer = await QRCodeService.generateQRCodeBuffer(shortCode, {
        size: parseInt(size as string),
        color: color as string,
        backgroundColor: backgroundColor as string,
        format: format as 'PNG' | 'SVG',
      });

      if (!qrCodeBuffer) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      const contentType = format === 'SVG' ? 'image/svg+xml' : 'image/png';
      const fileExtension = format === 'SVG' ? 'svg' : 'png';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="qr-${shortCode}.${fileExtension}"`
      );
      res.send(qrCodeBuffer);

      logger.info('QR code downloaded', {
        shortCode,
        format,
        size,
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error downloading QR code:', error);
      next(error);
    }
  }
}
