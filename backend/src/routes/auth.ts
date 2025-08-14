import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented later
router.post('/register', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Auth routes not implemented yet',
  });
});

router.post('/login', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Auth routes not implemented yet',
  });
});

export default router;
