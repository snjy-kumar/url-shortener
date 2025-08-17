import { Router } from 'express';
import { UrlController } from '../controllers/urlController';
import { validateCreateUrl } from '../middleware/validation';
import { optionalAuthentication } from '../middleware/auth';

const router = Router();

// Apply optional authentication to all routes (allows logged-in users to associate URLs)
router.use(optionalAuthentication);

// Create a short URL
router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);

// List URLs with pagination
router.get('/', UrlController.listUrls);

// Get analytics for a URL
router.get('/:shortCode/analytics', UrlController.getUrlAnalytics);

// Verify password for password-protected URL
router.post('/:shortCode/verify-password', UrlController.verifyUrlPassword);

// Get URL details by short code
router.get('/:shortCode', UrlController.getUrlDetails);

// Update URL by short code
router.put('/:shortCode', UrlController.updateUrl);

// Delete URL by short code
router.delete('/:shortCode', UrlController.deleteUrl);

export default router;
