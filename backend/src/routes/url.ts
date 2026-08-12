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

// Hybrid create: optional auth; guests get strict IP limit, signed-in get per-user limit.
router.post(
  '/shorten',
  guestCreateLimiter,
  authenticatedCreateLimiter,
  validateCreateUrl,
  UrlController.createShortUrl
);

router.use(requireClerkAuth);
router.use(authenticatedUserLimiter);

router.get('/', UrlController.listUrls);
router.get('/:shortCode', UrlController.getShortUrl);
router.patch('/:shortCode', validateUpdateUrl, UrlController.updateShortUrl);
router.delete('/:shortCode', UrlController.deleteShortUrl);

export default router;
