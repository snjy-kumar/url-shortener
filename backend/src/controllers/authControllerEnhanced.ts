import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';
import { UserRegistration, UserLogin, AuthenticatedRequest } from '../types';

export class AuthControllerEnhanced {
  /**
   * Register a new user with email verification
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name }: UserRegistration = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
        return;
      }

      // Hash password with high salt rounds
      const hashedPassword = await bcrypt.hash(
        password,
        config.BCRYPT_SALT_ROUNDS
      );

      // Generate email verification token
      const emailVerificationToken = uuidv4();

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name: name || null,
          emailVerificationToken,
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      // Send verification email
      await emailService.sendVerificationEmail(
        user.email,
        user.name || 'User',
        emailVerificationToken
      );

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message:
          'Registration successful! Please check your email to verify your account.',
        data: {
          user,
          emailVerificationRequired: true,
        },
      });
    } catch (error) {
      logger.error('Error registering user:', error);
      next(error);
    }
  }

  /**
   * Verify email address
   * GET /api/v1/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid or missing verification token',
        });
        return;
      }

      // Find user with this token
      const user = await prisma.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerified: false,
        },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message:
            'Invalid or expired verification token. Please request a new one.',
        });
        return;
      }

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
        },
      });

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.name || 'User');

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      );

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
          ipAddress: req.ip || null,
          userAgent: req.get('User-Agent') || null,
        },
      });

      logger.info('Email verified successfully', {
        userId: user.id,
        email: user.email,
      });

      // Redirect to frontend with success message
      const frontendUrl = config.CORS_ORIGIN || 'http://localhost:3001';
      res.redirect(
        `${frontendUrl}/auth/email-verified?success=true&token=${accessToken}&refreshToken=${refreshToken}`
      );
    } catch (error) {
      logger.error('Error verifying email:', error);
      next(error);
    }
  }

  /**
   * Resend verification email
   * POST /api/v1/auth/resend-verification
   */
  static async resendVerification(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if user exists
        res.json({
          success: true,
          message:
            'If an account exists with this email, a verification link has been sent.',
        });
        return;
      }

      if (user.emailVerified) {
        res.status(400).json({
          success: false,
          message: 'Email is already verified',
        });
        return;
      }

      // Generate new token
      const emailVerificationToken = uuidv4();

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken },
      });

      // Send verification email
      await emailService.sendVerificationEmail(
        user.email,
        user.name || 'User',
        emailVerificationToken
      );

      res.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    } catch (error) {
      logger.error('Error resending verification:', error);
      next(error);
    }
  }

  /**
   * Login user with enhanced security
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        password,
        twoFactorCode,
      }: UserLogin & {
        twoFactorCode?: string;
      } = req.body;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
        return;
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingTime = Math.ceil(
          (user.lockUntil.getTime() - Date.now()) / 1000 / 60
        );
        res.status(423).json({
          success: false,
          message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Increment login attempts
        const loginAttempts = user.loginAttempts + 1;
        const updateData: any = { loginAttempts };

        // Lock account if max attempts reached
        if (loginAttempts >= config.MAX_LOGIN_ATTEMPTS) {
          updateData.lockUntil = new Date(Date.now() + config.LOCK_TIME);
          logger.warn('Account locked due to too many login attempts', {
            userId: user.id,
            email: user.email,
            ip: req.ip,
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          remainingAttempts:
            config.MAX_LOGIN_ATTEMPTS - loginAttempts > 0
              ? config.MAX_LOGIN_ATTEMPTS - loginAttempts
              : 0,
        });
        return;
      }

      // Check if email is verified
      if (!user.emailVerified) {
        res.status(403).json({
          success: false,
          message:
            'Please verify your email address before logging in. Check your inbox for the verification link.',
          emailVerificationRequired: true,
        });
        return;
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          res.status(200).json({
            success: false,
            message: '2FA code required',
            twoFactorRequired: true,
            userId: user.id,
          });
          return;
        }

        const isValid = speakeasy.totp.verify({
          secret: user.twoFactorSecret!,
          encoding: 'base32',
          token: twoFactorCode,
          window: 2,
        });

        if (!isValid) {
          res.status(401).json({
            success: false,
            message: 'Invalid 2FA code',
          });
          return;
        }
      }

      // Reset login attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: req.ip || null,
        },
      });

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      );

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
          ipAddress: req.ip || null,
          userAgent: req.get('User-Agent') || null,
        },
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            createdAt: user.createdAt,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error('Error logging in user:', error);
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        config.JWT_REFRESH_SECRET
      ) as any;

      // Check if token exists and is not revoked
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: decoded.userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
        return;
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: 'User not found or inactive',
        });
        return;
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      logger.info('Token refreshed successfully', {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { accessToken },
      });
    } catch (error) {
      logger.error('Error refreshing token:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Don't reveal if user exists
      if (!user) {
        res.json({
          success: true,
          message:
            'If an account exists with this email, a password reset link has been sent.',
        });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + config.PASSWORD_RESET_EXPIRES);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Send reset email
      await emailService.sendPasswordResetEmail(
        user.email,
        user.name || 'User',
        resetToken
      );

      logger.info('Password reset requested', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Password reset link has been sent to your email',
      });
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      next(error);
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required',
        });
        return;
      }

      // Find user with valid token
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        config.BCRYPT_SALT_ROUNDS
      );

      // Update password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          loginAttempts: 0,
          lockUntil: null,
        },
      });

      // Revoke all existing refresh tokens for security
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      logger.info('Password reset successfully', {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message:
          'Password reset successfully. You can now login with your new password.',
      });
    } catch (error) {
      logger.error('Error resetting password:', error);
      next(error);
    }
  }

  /**
   * Setup 2FA
   * POST /api/v1/auth/2fa/setup
   */
  static async setup2FA(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `URL Shortener (${req.user.email})`,
        issuer: 'URL Shortener',
      });

      // Store secret temporarily (will be confirmed after verification)
      await prisma.user.update({
        where: { id: req.user.id },
        data: { twoFactorSecret: secret.base32 },
      });

      res.json({
        success: true,
        message: '2FA setup initiated',
        data: {
          secret: secret.base32,
          qrCode: secret.otpauth_url,
        },
      });
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      next(error);
    }
  }

  /**
   * Verify and enable 2FA
   * POST /api/v1/auth/2fa/verify
   */
  static async verify2FA(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          message: '2FA code is required',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user?.twoFactorSecret) {
        res.status(400).json({
          success: false,
          message: '2FA setup not initiated',
        });
        return;
      }

      // Verify code
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!isValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid 2FA code',
        });
        return;
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });

      // Send confirmation email
      await emailService.send2FASetupEmail(user.email, user.name || 'User');

      logger.info('2FA enabled', {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message: '2FA enabled successfully',
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      next(error);
    }
  }

  /**
   * Disable 2FA
   * POST /api/v1/auth/2fa/disable
   */
  static async disable2FA(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { code, password } = req.body;

      if (!code || !password) {
        res.status(400).json({
          success: false,
          message: '2FA code and password are required',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid password',
        });
        return;
      }

      // Verify 2FA code
      if (user.twoFactorSecret) {
        const isValid = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: code,
          window: 2,
        });

        if (!isValid) {
          res.status(401).json({
            success: false,
            message: 'Invalid 2FA code',
          });
          return;
        }
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      logger.info('2FA disabled', {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message: '2FA disabled successfully',
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  static async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // Revoke the specific refresh token
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { isRevoked: true },
        });
      }

      if (req.user) {
        logger.info('User logged out', {
          userId: req.user.id,
          email: req.user.email,
          ip: req.ip,
        });
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Error during logout:', error);
      res.json({
        success: true,
        message: 'Logout successful',
      });
    }
  }

  /**
   * Get user profile
   * GET /api/v1/auth/profile
   */
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          emailVerified: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              urls: { where: { isActive: true } },
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          ...user,
          totalUrls: user._count.urls,
        },
      });
    } catch (error) {
      logger.error('Error getting user profile:', error);
      next(error);
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { name, email } = req.body;

      // Check if new email is already taken
      if (email && email !== req.user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (existingUser) {
          res.status(409).json({
            success: false,
            message: 'Email already in use',
          });
          return;
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) {
        updateData.email = email.toLowerCase();
        // Require email verification for new email
        updateData.emailVerified = false;
        updateData.emailVerificationToken = uuidv4();

        // Send verification email to new address
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
        });
        if (user) {
          await emailService.sendVerificationEmail(
            email,
            name || user.name || 'User',
            updateData.emailVerificationToken
          );
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('User profile updated', {
        userId: req.user.id,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: email
          ? 'Profile updated. Please verify your new email address.'
          : 'Profile updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      next(error);
    }
  }

  /**
   * Change user password
   * PUT /api/v1/auth/change-password
   */
  static async changePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current and new passwords are required',
        });
        return;
      }

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        config.BCRYPT_SALT_ROUNDS
      );

      // Update password
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      });

      // Revoke all refresh tokens for security
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      logger.info('User password changed', {
        userId: req.user.id,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      logger.error('Error changing password:', error);
      next(error);
    }
  }

  /**
   * Delete user account
   * DELETE /api/v1/auth/account
   */
  static async deleteAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Soft delete: deactivate the account
      await prisma.user.update({
        where: { id: req.user.id },
        data: { isActive: false },
      });

      // Revoke all refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId: req.user.id },
        data: { isRevoked: true },
      });

      logger.info('User account deleted', {
        userId: req.user.id,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting user account:', error);
      next(error);
    }
  }
}
