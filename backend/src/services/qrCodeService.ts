import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface QRCodeOptions {
  size?: number;
  color?: string;
  backgroundColor?: string;
  format?: 'PNG' | 'SVG';
  logoUrl?: string;
  logoSize?: number;
}

export interface QRCodeResponse {
  qrCode: string;
  format: string;
  size: number;
  shortUrl: string;
  originalUrl: string;
}

export class QRCodeService {
  /**
   * Generate QR code for a short URL
   */
  static async generateQRCode(
    shortCode: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResponse | null> {
    try {
      // Find the URL in database
      const url = await prisma.url.findUnique({
        where: { shortCode },
      });

      if (!url) {
        return null;
      }

      const {
        size = 256,
        color = '#000000',
        backgroundColor = '#ffffff',
        format = 'PNG',
      } = options;

      // Construct the full short URL
      const baseUrl = process.env['BASE_URL'] || 'http://localhost:3001';
      const shortUrl = `${baseUrl}/${shortCode}`;

      let qrCodeData: string;

      if (format === 'SVG') {
        qrCodeData = await QRCode.toString(shortUrl, {
          type: 'svg',
          width: size,
          color: {
            dark: color,
            light: backgroundColor,
          },
          margin: 2,
          errorCorrectionLevel: 'M',
        });
      } else {
        qrCodeData = await QRCode.toDataURL(shortUrl, {
          width: size,
          color: {
            dark: color,
            light: backgroundColor,
          },
          margin: 2,
          errorCorrectionLevel: 'M',
        });
      }

      // Update click count for analytics
      await prisma.url.update({
        where: { id: url.id },
        data: {
          clickCount: {
            increment: 1,
          },
        },
      });

      logger.info('QR code generated for URL', {
        shortCode,
        originalUrl: url.originalUrl,
        format,
        size,
      });

      return {
        qrCode: qrCodeData,
        format,
        size,
        shortUrl,
        originalUrl: url.originalUrl,
      };
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Generate QR code as buffer for download
   */
  static async generateQRCodeBuffer(
    shortCode: string,
    options: QRCodeOptions = {}
  ): Promise<Buffer | null> {
    try {
      // Find the URL in database
      const url = await prisma.url.findUnique({
        where: { shortCode },
      });

      if (!url) {
        return null;
      }

      const {
        size = 256,
        color = '#000000',
        backgroundColor = '#ffffff',
        format = 'PNG',
      } = options;

      // Construct the full short URL
      const baseUrl = process.env['BASE_URL'] || 'http://localhost:3001';
      const shortUrl = `${baseUrl}/${shortCode}`;

      let qrCodeBuffer: Buffer;

      if (format === 'SVG') {
        const svgString = await QRCode.toString(shortUrl, {
          type: 'svg',
          width: size,
          color: {
            dark: color,
            light: backgroundColor,
          },
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        qrCodeBuffer = Buffer.from(svgString, 'utf-8');
      } else {
        qrCodeBuffer = await QRCode.toBuffer(shortUrl, {
          width: size,
          color: {
            dark: color,
            light: backgroundColor,
          },
          margin: 2,
          errorCorrectionLevel: 'M',
        });
      }

      // Update click count for analytics
      await prisma.url.update({
        where: { id: url.id },
        data: {
          clickCount: {
            increment: 1,
          },
        },
      });

      logger.info('QR code buffer generated for URL', {
        shortCode,
        originalUrl: url.originalUrl,
        format,
        size,
      });

      return qrCodeBuffer;
    } catch (error) {
      logger.error('Error generating QR code buffer:', error);
      throw error;
    }
  }

  /**
   * Get QR code statistics
   */
  static async getQRCodeStats(shortCode: string) {
    try {
      const url = await prisma.url.findUnique({
        where: { shortCode },
        include: {
          analytics: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
        },
      });

      if (!url) {
        return null;
      }

      return {
        shortCode,
        originalUrl: url.originalUrl,
        clickCount: url.clickCount,
        createdAt: url.createdAt,
        recentAnalytics: url.analytics,
      };
    } catch (error) {
      logger.error('Error getting QR code stats:', error);
      throw error;
    }
  }
}
