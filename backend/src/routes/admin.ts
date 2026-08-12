import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { requireClerkAuth } from '../middleware/requireClerkAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { authenticatedUserLimiter } from '../middleware/authenticatedUserLimiter.js';

const router = Router();

router.use(requireClerkAuth);
router.use(authenticatedUserLimiter);

/** Any signed-in user can ask if they are admin (for nav). */
router.get('/me', AdminController.me);

router.use(requireAdmin);
router.get('/metrics', AdminController.metrics);
router.get('/audit', AdminController.audit);
router.get('/abuse', AdminController.listAbuse);
router.post('/abuse/:id/resolve', AdminController.resolveAbuse);
router.get('/urls/:shortCode', AdminController.getUrl);
router.post('/urls/:shortCode/disable', AdminController.disableUrl);

export default router;
