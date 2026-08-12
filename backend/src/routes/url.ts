import { Router } from 'express';
import { UrlController } from '../controllers/urlController.js';
import {
  validateCreateUrl,
  validateUpdateUrl,
} from '../middleware/validation.js';
import { requireClerkAuth } from '../middleware/requireClerkAuth.js';
import {
  authenticatedCreateLimiter,
  authenticatedUserLimiter,
  guestCreateLimiter,
} from '../middleware/authenticatedUserLimiter.js';

const router = Router();

router.post(
  '/shorten',
  guestCreateLimiter,
  authenticatedCreateLimiter,
  validateCreateUrl,
  UrlController.createShortUrl
);

router.post('/abuse', guestCreateLimiter, UrlController.reportAbuse);

router.use(requireClerkAuth);
router.use(authenticatedUserLimiter);

router.get('/', UrlController.listUrls);
router.post('/bulk', UrlController.createBulk);
router.post('/:shortCode/claim', UrlController.claimShortUrl);
router.get('/:shortCode/analytics', UrlController.getAnalytics);
router.get('/:shortCode/qr', UrlController.getQr);
router.get('/:shortCode', UrlController.getShortUrl);
router.patch('/:shortCode', validateUpdateUrl, UrlController.updateShortUrl);
router.delete('/:shortCode', UrlController.deleteShortUrl);

export default router;
