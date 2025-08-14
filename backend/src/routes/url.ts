import { Router } from 'express';
import { UrlController } from '../controllers/urlController';
import { validateCreateUrl } from '../middleware/validation';

const router = Router();

// Create a short URL
router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);

// List URLs with pagination
router.get('/', UrlController.listUrls);

// Get URL details by short code
router.get('/:shortCode', UrlController.getUrlDetails);

// Delete URL by short code
router.delete('/:shortCode', UrlController.deleteUrl);

export default router;
