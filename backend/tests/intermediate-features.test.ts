import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/config/database';

describe('Intermediate Features Integration Tests', () => {
  let authToken: string;
  let userId: number;
  let shortCode: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.analytics.deleteMany();
    await prisma.url.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.analytics.deleteMany();
    await prisma.url.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('Authentication System', () => {
    it('should register a new user', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();

      authToken = response.body.data.token;
      userId = response.body.data.user.id;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('Password-Protected URLs', () => {
    it('should create a password-protected URL when authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://example.com',
          password: 'secret123',
          title: 'Protected Example',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBeDefined();

      shortCode = response.body.data.shortCode;
    });

    it('should require password for accessing protected URL', async () => {
      const response = await request(app).get(`/${shortCode}`);

      expect(response.status).toBe(423);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    it('should verify correct password', async () => {
      const response = await request(app)
        .post(`/api/v1/urls/${shortCode}/verify-password`)
        .send({
          password: 'secret123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.originalUrl).toBe('https://example.com');
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post(`/api/v1/urls/${shortCode}/verify-password`)
        .send({
          password: 'wrongpassword',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Custom Domains Support', () => {
    it('should create URL with custom domain when authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://custom-domain-test.com',
          customDomain: 'custom.example.com',
          title: 'Custom Domain Test',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customDomain).toBe('custom.example.com');
    });
  });

  describe('User Association', () => {
    it('should associate URLs with authenticated user', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalUrl: 'https://user-associated.com',
          title: 'User Associated URL',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the URL is associated with the user
      const url = await prisma.url.findUnique({
        where: { shortCode: response.body.data.shortCode },
      });

      expect(url?.userId).toBe(userId);
    });

    it('should not associate URLs with unauthenticated requests', async () => {
      const response = await request(app).post('/api/v1/urls').send({
        originalUrl: 'https://anonymous.com',
        title: 'Anonymous URL',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the URL is not associated with any user
      const url = await prisma.url.findUnique({
        where: { shortCode: response.body.data.shortCode },
      });

      expect(url?.userId).toBeNull();
    });
  });

  describe('QR Code Generation', () => {
    it('should generate PNG QR code for existing URL', async () => {
      const response = await request(app).post(`/api/v1/qr/${shortCode}`).send({
        size: 256,
        format: 'PNG',
        color: '#000000',
        backgroundColor: '#ffffff',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.format).toBe('PNG');
      expect(response.body.data.size).toBe(256);
    });

    it('should generate SVG QR code for existing URL', async () => {
      const response = await request(app).post(`/api/v1/qr/${shortCode}`).send({
        size: 512,
        format: 'SVG',
        color: '#FF0000',
        backgroundColor: '#FFFFFF',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.format).toBe('SVG');
      expect(response.body.data.size).toBe(512);
    });

    it('should download QR code as file', async () => {
      const response = await request(app).get(
        `/api/v1/qr/${shortCode}/download?format=PNG&size=128`
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain(
        `qr-${shortCode}.png`
      );
    });

    it('should get QR code statistics', async () => {
      const response = await request(app).get(`/api/v1/qr/${shortCode}/stats`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe(shortCode);
      expect(response.body.data.clickCount).toBeDefined();
    });

    it('should return 404 for non-existent URL', async () => {
      const response = await request(app).post('/api/v1/qr/nonexistent').send({
        size: 256,
        format: 'PNG',
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Enhanced Validation', () => {
    it('should validate QR code generation parameters', async () => {
      const response = await request(app).post(`/api/v1/qr/${shortCode}`).send({
        size: 32, // Too small
        color: 'invalid-color',
        format: 'INVALID',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate registration input', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid-email',
        password: '123', // Too weak
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });
});
