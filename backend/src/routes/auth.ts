import { Router } from 'express';
import { AuthControllerEnhanced } from '../controllers/authControllerEnhanced';
import { validateRegister, validateLogin } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// User registration
router.post('/register', validateRegister, AuthControllerEnhanced.register);

// Email verification
router.get('/verify-email', AuthControllerEnhanced.verifyEmail);

// Resend verification email
router.post('/resend-verification', AuthControllerEnhanced.resendVerification);

// User login
router.post('/login', validateLogin, AuthControllerEnhanced.login);

// Refresh access token
router.post('/refresh-token', AuthControllerEnhanced.refreshToken);

// Forgot password - request reset
router.post('/forgot-password', AuthControllerEnhanced.forgotPassword);

// Reset password with token
router.post('/reset-password', AuthControllerEnhanced.resetPassword);

// Logout
router.post('/logout', AuthControllerEnhanced.logout);

// ==================== PROTECTED ROUTES ====================

// User profile
router.get('/profile', authenticateToken, AuthControllerEnhanced.getProfile);

// Update profile
router.put('/profile', authenticateToken, AuthControllerEnhanced.updateProfile);

// Change password
router.put(
  '/change-password',
  authenticateToken,
  AuthControllerEnhanced.changePassword
);

// Delete account
router.delete(
  '/account',
  authenticateToken,
  AuthControllerEnhanced.deleteAccount
);

// ==================== TWO-FACTOR AUTHENTICATION ====================

// Setup 2FA (get secret and QR code)
router.post('/2fa/setup', authenticateToken, AuthControllerEnhanced.setup2FA);

// Verify and enable 2FA
router.post('/2fa/verify', authenticateToken, AuthControllerEnhanced.verify2FA);

// Disable 2FA
router.post(
  '/2fa/disable',
  authenticateToken,
  AuthControllerEnhanced.disable2FA
);

export default router;
