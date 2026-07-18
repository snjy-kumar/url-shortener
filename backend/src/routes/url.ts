import { Router } from 'express';
import { UrlController } from '../controllers/urlController.js';
import { validateCreateUrl } from '../middleware/validation.js';

const router = Router();

router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);

export default router;
