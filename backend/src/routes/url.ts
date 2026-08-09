import { Router } from 'express';
import { UrlController } from '../controllers/urlController.js';
import {
  validateCreateUrl,
  validateUpdateUrl,
} from '../middleware/validation.js';

const router = Router();

router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);
router.get('/', UrlController.listUrls);
router.get('/:shortCode', UrlController.getShortUrl);
router.patch('/:shortCode', validateUpdateUrl, UrlController.updateShortUrl);
router.delete('/:shortCode', UrlController.deleteShortUrl);

export default router;
