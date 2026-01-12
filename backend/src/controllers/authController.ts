import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { UserRegistration, UserLogin, AuthenticatedRequest } from '../types/index.js';

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name }: UserRegistration = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        password,
        config.BCRYPT_SALT_ROUNDS
      );

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      logger.error('Error registering user:', error);
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password }: UserLogin = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal whether user exists
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingTime = Math.ceil(
          (user.lockUntil.getTime() - Date.now()) / 60000
        );
        
        logger.warn('Attempt to access locked account', {
          userId: user.id,
          email: user.email,
          ip: clientIp,
        });
        
        res.status(423).json({
          success: false,
          message: `Account is temporarily locked. Try again in ${remainingTime} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      // Check if account is active
      if (!user.isActive) {
        res.status(403).json({
          success: false,
          message: 'Account is disabled',
          code: 'ACCOUNT_DISABLED',
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        const newAttempts = user.loginAttempts + 1;
        const shouldLock = newAttempts >= config.MAX_LOGIN_ATTEMPTS;
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newAttempts,
            lockUntil: shouldLock
              ? new Date(Date.now() + config.LOCK_TIME)
              : null,
          },
        });
        
        logger.warn('Failed login attempt', {
          userId: user.id,
          email: user.email,
          attempts: newAttempts,
          locked: shouldLock,
          ip: clientIp,
        });
        
        if (shouldLock) {
          res.status(423).json({
            success: false,
            message: 'Too many failed attempts. Account locked temporarily.',
            code: 'ACCOUNT_LOCKED',
          });
        } else {
          const remainingAttempts = config.MAX_LOGIN_ATTEMPTS - newAttempts;
          res.status(401).json({
            success: false,
            message: `Invalid email or password. ${remainingAttempts} attempts remaining.`,
          });
        }
        return;
      }

      // Reset login attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        },
      });

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN, issuer: 'url-shortener' } as jwt.SignOptions
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN, issuer: 'url-shortener' } as jwt.SignOptions
      );

      // Store refresh token in database
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          ipAddress: clientIp,
          userAgent: req.get('User-Agent') || null,
        },
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: clientIp,
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
            createdAt: user.createdAt,
          },
          accessToken,
          refreshToken,
          expiresIn: config.JWT_EXPIRES_IN,
        },
      });
    } catch (error) {
      logger.error('Error logging in user:', error);
      next(error);
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
   * Refresh JWT token
   * POST /api/v1/auth/refresh
   */
  static async refreshToken(
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

      // Generate new JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email },
        config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { token },
      });
    } catch (error) {
      logger.error('Error refreshing token:', error);
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
          where: { email },
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
      if (name) {updateData.name = name;}
      if (email) {updateData.email = email;}

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
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
        message: 'Profile updated successfully',
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

      logger.info('User password changed', {
        userId: req.user.id,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
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
      // In a real app, you might want to permanently delete related data
      await prisma.user.update({
        where: { id: req.user.id },
        data: { isActive: false },
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

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response) {
    // For stateless JWT, logout is handled on the client side
    // Here we just acknowledge the logout request
    logger.info('User logged out', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  }
}
