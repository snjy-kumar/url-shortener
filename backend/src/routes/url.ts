import { Router } from 'express';
import { UrlController } from '../controllers/urlController.js';
import {
  validateCreateUrl,
  validateUpdateUrl,
} from '../middleware/validation.js';
import { requireClerkAuth } from '../middleware/requireClerkAuth.js';
import { authenticatedUserLimiter } from '../middleware/authenticatedUserLimiter.js';

const router = Router();

router.use(requireClerkAuth);
router.use(authenticatedUserLimiter);

router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);
router.get('/', UrlController.listUrls);
router.get('/:shortCode', UrlController.getShortUrl);
router.patch('/:shortCode', validateUpdateUrl, UrlController.updateShortUrl);
router.delete('/:shortCode', UrlController.deleteShortUrl);

export default router;
