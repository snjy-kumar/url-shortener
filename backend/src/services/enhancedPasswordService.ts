import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';

export interface PasswordAttempt {
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAttempts: number;
  lockoutDuration: number; // in minutes
}

export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  meets: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
}

export class EnhancedPasswordService {
  private static readonly DEFAULT_POLICY: PasswordPolicy = {
    minLength: 6,
    maxLength: 128,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
    maxAttempts: 5,
    lockoutDuration: 15, // 15 minutes
  };

  private static readonly STRONG_POLICY: PasswordPolicy = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 3,
    lockoutDuration: 30, // 30 minutes
  };

  /**
   * Validate password against policy
   */
  static validatePassword(
    password: string,
    policy: PasswordPolicy = this.DEFAULT_POLICY
  ): {
    valid: boolean;
    errors: string[];
    strength: PasswordStrength;
  } {
    const errors: string[] = [];

    // Length validation
    if (password.length < policy.minLength) {
      errors.push(
        `Password must be at least ${policy.minLength} characters long`
      );
    }
    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Character type validation
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (
      policy.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    const strength = this.calculatePasswordStrength(password);

    return {
      valid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Calculate password strength
   */
  static calculatePasswordStrength(password: string): PasswordStrength {
    let score = 0;
    const feedback: string[] = [];

    const meets = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password),
    };

    // Length scoring
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    // Character variety scoring
    if (meets.hasUppercase) score += 1;
    else feedback.push('Add uppercase letters');

    if (meets.hasLowercase) score += 1;
    else feedback.push('Add lowercase letters');

    if (meets.hasNumbers) score += 1;
    else feedback.push('Add numbers');

    if (meets.hasSpecialChars) score += 1;
    else feedback.push('Add special characters');

    // Bonus for mixed character types
    const charTypes = Object.values(meets).filter(Boolean).length;
    if (charTypes >= 3) score += 1;

    // Common password patterns penalty
    if (/^(password|123456|qwerty|abc123|admin|test)/i.test(password)) {
      score = Math.max(0, score - 2);
      feedback.push('Avoid common passwords');
    }

    // Repetitive patterns penalty
    if (/(.)\1{2,}/.test(password) || /123|abc|qwe/i.test(password)) {
      score = Math.max(0, score - 1);
      feedback.push('Avoid repetitive patterns');
    }

    // Cap score at 4
    score = Math.min(4, score);

    return {
      score,
      feedback: feedback.slice(0, 3), // Limit feedback to top 3 suggestions
      meets,
    };
  }

  /**
   * Hash password with enhanced security
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = config.BCRYPT_SALT_ROUNDS;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password with rate limiting and attempt tracking
   */
  static async verifyPasswordWithRateLimit(
    shortCode: string,
    password: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{
    success: boolean;
    remainingAttempts?: number;
    lockoutTime?: Date;
    message: string;
  }> {
    try {
      // Check if IP is currently locked out
      const lockoutKey = `password_lockout:${shortCode}:${ipAddress}`;
      const lockoutData = (await CacheService.get(lockoutKey)) as {
        lockoutUntil?: string;
      } | null;

      if (lockoutData && lockoutData.lockoutUntil) {
        return {
          success: false,
          lockoutTime: new Date(lockoutData.lockoutUntil),
          message: 'Too many failed attempts. Please try again later.',
        };
      }

      // Get current attempt count
      const attemptKey = `password_attempts:${shortCode}:${ipAddress}`;
      const attempts = (await CacheService.get<number>(attemptKey)) || 0;

      // Get URL and verify password
      const url = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode }, { customAlias: shortCode }],
          isActive: true,
        },
        select: { id: true, password: true },
      });

      if (!url || !url.password) {
        return {
          success: false,
          message: 'URL not found or not password protected',
        };
      }

      const isValid = await bcrypt.compare(password, url.password);

      // Log attempt
      await this.logPasswordAttempt(url.id, {
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: isValid,
      });

      if (isValid) {
        // Clear attempts on successful verification
        await CacheService.delete(attemptKey);

        // Store successful verification in cache for a short time
        const verificationKey = `password_verified:${shortCode}:${ipAddress}`;
        await CacheService.set(verificationKey, true, { ttl: 3600 }); // 1 hour

        return {
          success: true,
          message: 'Password verified successfully',
        };
      } else {
        // Increment failed attempts
        const newAttempts = attempts + 1;
        const policy = this.DEFAULT_POLICY;

        if (newAttempts >= policy.maxAttempts) {
          // Lock out the IP
          const lockoutUntil = new Date(
            Date.now() + policy.lockoutDuration * 60 * 1000
          );
          await CacheService.set(
            lockoutKey,
            { lockoutUntil },
            {
              ttl: policy.lockoutDuration * 60,
            }
          );

          await CacheService.delete(attemptKey);

          logger.warn('Password protection lockout triggered', {
            shortCode,
            ipAddress,
            attempts: newAttempts,
            lockoutUntil,
          });

          return {
            success: false,
            lockoutTime: lockoutUntil,
            message: 'Too many failed attempts. Account locked temporarily.',
          };
        } else {
          // Store failed attempt count
          await CacheService.set(attemptKey, newAttempts, { ttl: 3600 }); // 1 hour

          return {
            success: false,
            remainingAttempts: policy.maxAttempts - newAttempts,
            message: `Invalid password. ${policy.maxAttempts - newAttempts} attempts remaining.`,
          };
        }
      }
    } catch (error) {
      logger.error('Error verifying password with rate limit:', error);
      return {
        success: false,
        message: 'Internal server error',
      };
    }
  }

  /**
   * Check if password verification is cached (user already verified)
   */
  static async isPasswordVerified(
    shortCode: string,
    ipAddress: string
  ): Promise<boolean> {
    const verificationKey = `password_verified:${shortCode}:${ipAddress}`;
    return await CacheService.exists(verificationKey);
  }

  /**
   * Generate secure temporary password
   */
  static generateTemporaryPassword(length: number = 12): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one character from each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

    // Fill remaining length
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Log password attempt for audit purposes
   */
  private static async logPasswordAttempt(
    urlId: number,
    attempt: PasswordAttempt
  ): Promise<void> {
    try {
      // In a production environment, you might want to store this in a separate audit table
      // For now, we'll just log it
      logger.info('Password attempt logged', {
        urlId,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        success: attempt.success,
        timestamp: attempt.timestamp,
      });

      // Could also store in database for detailed audit trail:
      /*
      await prisma.passwordAttempt.create({
        data: {
          urlId,
          ipAddress: attempt.ipAddress,
          userAgent: attempt.userAgent,
          success: attempt.success,
          attemptedAt: attempt.timestamp,
        },
      });
      */
    } catch (error) {
      logger.error('Error logging password attempt:', error);
    }
  }

  /**
   * Update URL password with validation
   */
  static async updateUrlPassword(
    shortCode: string,
    newPassword: string | null,
    policy: PasswordPolicy = this.DEFAULT_POLICY
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      if (newPassword) {
        const validation = this.validatePassword(newPassword, policy);
        if (!validation.valid) {
          return { success: false, errors: validation.errors };
        }
      }

      const url = await prisma.url.findFirst({
        where: { OR: [{ shortCode }, { customAlias: shortCode }] },
      });

      if (!url) {
        return { success: false, errors: ['URL not found'] };
      }

      const hashedPassword = newPassword
        ? await this.hashPassword(newPassword)
        : null;

      await prisma.url.update({
        where: { id: url.id },
        data: { password: hashedPassword },
      });

      // Invalidate cache
      await CacheService.invalidateUrl(shortCode);
      if (url.customAlias) {
        await CacheService.invalidateUrl(url.customAlias);
      }

      // Clear any existing password verifications
      const verificationPattern = `password_verified:${shortCode}:*`;
      await CacheService.deletePattern(verificationPattern);

      logger.info('URL password updated', {
        shortCode,
        hasPassword: !!newPassword,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating URL password:', error);
      return { success: false, errors: ['Internal server error'] };
    }
  }

  /**
   * Get password attempt statistics
   */
  static async getPasswordStats(shortCode: string): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    uniqueIPs: number;
    recentAttempts: Array<{
      ipAddress: string;
      timestamp: Date;
      success: boolean;
    }>;
  }> {
    try {
      // This would typically come from a database table
      // For now, return mock data structure
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        uniqueIPs: 0,
        recentAttempts: [],
      };
    } catch (error) {
      logger.error('Error getting password stats:', error);
      throw error;
    }
  }

  /**
   * Clear lockout for specific IP
   */
  static async clearLockout(
    shortCode: string,
    ipAddress: string
  ): Promise<boolean> {
    try {
      const lockoutKey = `password_lockout:${shortCode}:${ipAddress}`;
      const attemptKey = `password_attempts:${shortCode}:${ipAddress}`;

      await Promise.all([
        CacheService.delete(lockoutKey),
        CacheService.delete(attemptKey),
      ]);

      logger.info('Password lockout cleared', { shortCode, ipAddress });
      return true;
    } catch (error) {
      logger.error('Error clearing lockout:', error);
      return false;
    }
  }
}
