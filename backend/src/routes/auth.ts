import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateRegister, validateLogin } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// User registration
router.post('/register', validateRegister, AuthController.register);

// User login
router.post('/login', validateLogin, AuthController.login);

// User profile (protected route)
router.get('/profile', authenticateToken, AuthController.getProfile);

// Refresh token
router.post('/refresh', authenticateToken, AuthController.refreshToken);

// Logout
router.post('/logout', AuthController.logout);

export default router;
