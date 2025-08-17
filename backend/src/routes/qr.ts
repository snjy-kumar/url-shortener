import { Router } from 'express';
import { QRCodeController } from '../controllers/qrCodeController';
import { validateQRCodeGeneration } from '../middleware/qrValidation';

const router = Router();

/**
 * @route   POST /api/v1/qr/:shortCode
 * @desc    Generate QR code for a short URL
 * @access  Public
 */
router.post(
  '/:shortCode',
  validateQRCodeGeneration,
  QRCodeController.generateQRCode
);

/**
 * @route   GET /api/v1/qr/:shortCode/download
 * @desc    Download QR code
 * @access  Public
 */
router.get('/:shortCode/download', QRCodeController.downloadQRCode);

/**
 * @route   GET /api/v1/qr/:shortCode/stats
 * @desc    Get QR code statistics
 * @access  Public
 */
router.get('/:shortCode/stats', async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { QRCodeService } = await import('../services/qrCodeService');

    const stats = await QRCodeService.getQRCodeStats(shortCode);

    if (!stats) {
      res.status(404).json({
        success: false,
        message: 'URL not found',
      });
      return;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
