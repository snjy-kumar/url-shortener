# Northflank Deployment Guide

## 🚀 Complete Deployment Steps for URL Shortener

### Prerequisites
- Northflank account created
- GitHub repository access
- Credit card added (for paid resources)

---

## Step 1: Create PostgreSQL Database

Before deploying your service, you need a PostgreSQL database:

1. **Go to Northflank Dashboard** → Select your project
2. **Click "Add New" → "Addon"**
3. **Select "PostgreSQL"**
4. Configure:
   - **Name**: `url-shortener-db`
   - **Plan**: `nf-storage-200` (2GB storage minimum recommended)
   - **Version**: PostgreSQL 15 or higher
   - **Backup Enabled**: Yes (recommended)
5. **Deploy the database**
6. **Copy the connection string** from the addon details (will use later)

---

## Step 2: Create Redis Addon

Your app requires Redis for caching:

1. **Click "Add New" → "Addon"**
2. **Select "Redis"**
3. Configure:
   - **Name**: `url-shortener-redis`
   - **Plan**: `nf-redis-50` (minimum)
4. **Deploy Redis**
5. **Copy the Redis URL** (will use later)

---

## Step 3: Deploy Backend Service

Now configure your combined service with the details you've provided:

### Basic Information
- **Service name**: `url-shortener` ✓ (you've already set this)
- **Tags**: (optional) Add tags like `backend`, `api`, `production`

### Repository
- **Repository**: `snjy-kumar/url-shortener` ✓
- **Branch**: `master` ✓

### Build Options
⚠️ **IMPORTANT CHANGE**:
- **Build type**: Select **Dockerfile** (I've created one for you)
- **Dockerfile path**: `backend/Dockerfile`
- **Build context**: `/backend` ⬅️ **Change this from `/` to `/backend`**

### Resources
Based on your requirements:
- **Compute plan**: `nf-compute-400-16` ✓ (4 vCPU, 16GB RAM)
- **GPU enabled**: You mentioned GPU, but your app doesn't need it. Use CPU plan instead.
- **Instances**: Start with `1`, can scale later

### Networking
⚠️ **IMPORTANT PORT CHANGE**:
Your backend runs on port **3000**, not 8080:
- **Port**: `3000` ⬅️ **Change from 8080 to 3000**
- **Protocol**: `HTTP` ✓
- **Publicly expose**: ✓ Yes
- **Name**: `site` ✓

### Environment Variables

Click "Add variable" for each of these **CRITICAL** variables:

#### Required Variables:
```env
# Database - Use the connection string from Step 1
DATABASE_URL=postgresql://username:password@host:port/database

# OR if using Prisma Accelerate (your current setup):
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY

# Server
NODE_ENV=production
PORT=3000

# JWT - CHANGE THESE IN PRODUCTION!
JWT_SECRET=your-super-strong-random-secret-min-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-strong-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# URL Configuration
BASE_URL=https://site--url-shortener--44yr75b2v68c.code.run
SHORT_CODE_LENGTH=7

# CORS - Add your frontend URL once deployed
CORS_ORIGIN=https://your-frontend-url.code.run

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log

# Redis - Use the Redis URL from Step 2
REDIS_URL=redis://username:password@host:port

# Security
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=900000
EMAIL_VERIFICATION_EXPIRES=86400000
PASSWORD_RESET_EXPIRES=3600000
```

#### How to Link Database & Redis:
In Northflank, you can link addons automatically:
1. Under "Environment Variables" section
2. Click "Link Addon"
3. Select your `url-shortener-db` → This creates `DATABASE_URL`
4. Click "Link Addon" again
5. Select your `url-shortener-redis` → This creates `REDIS_URL`

### Advanced Options

#### Health Checks (Recommended):
- **Enable health checks**: Yes
- **Path**: `/api/health` or `/health` (add this endpoint to your backend)
- **Initial delay**: 30 seconds
- **Period**: 30 seconds

---

## Step 4: Post-Deployment Tasks

After clicking "Create Service":

### 1. Run Database Migrations
Once the service is deployed:
1. Go to your service → **Jobs tab**
2. Click "Run job"
3. **Command**: `npm run db:migrate:prod`
4. This applies all Prisma migrations to your database

### 2. (Optional) Seed Database
If you want initial data:
1. Run another job
2. **Command**: `npm run db:seed`

### 3. Monitor Logs
- Go to **Logs tab** to see if the service started correctly
- Look for: `Server is running on port 3000`

---

## Step 5: Deploy Frontend (Next.js)

You'll need a separate service for the frontend:

### Create New Combined Service:
- **Name**: `url-shortener-frontend`
- **Repository**: `snjy-kumar/url-shortener`
- **Branch**: `master`
- **Build type**: `Buildpack` (Heroku)
- **Buildpack**: `heroku/nodejs`
- **Build context**: `/frontend`
- **Port**: `3000` (Next.js default)

### Frontend Environment Variables:
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://site--url-shortener--44yr75b2v68c.code.run/api
```

---

## Important Configuration Changes Needed

### 1. Update CORS Origin
After frontend is deployed, update backend's `CORS_ORIGIN`:
- Go to backend service → Environment Variables
- Update `CORS_ORIGIN` to your frontend URL

### 2. Add Health Check Endpoint
Add this to your backend if not present:

**File**: `backend/src/index.ts`
```typescript
// Add this route before other routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 3. Update BASE_URL
After deployment, update `BASE_URL` in backend environment variables to match your actual Northflank URL.

---

## Troubleshooting

### Build Fails?
- Check build logs in Northflank
- Ensure Docker build context is `/backend`
- Verify Dockerfile path is `backend/Dockerfile`

### Database Connection Issues?
- Verify `DATABASE_URL` is correctly linked
- Check database addon is running
- Ensure IP whitelist allows Northflank IPs (if using external DB)

### Port Issues?
- Backend must use port 3000 (or update Dockerfile)
- Northflank port mapping must match

### Migration Errors?
- Run migrations as a job, not in the container startup
- Check Prisma schema is valid
- Ensure database is accessible

---

## Cost Estimate

Based on your selections:
- **Backend**: `nf-compute-400-16` (~$100-150/month)
- **Database**: `nf-storage-200` (~$20-30/month)
- **Redis**: `nf-redis-50` (~$10-15/month)
- **Frontend**: `nf-compute-10` (free tier or ~$5/month)

**Total**: ~$135-200/month

⚠️ **Note**: These are estimates. Check Northflank pricing for exact costs.

---

## Quick Checklist

- [ ] PostgreSQL database created and running
- [ ] Redis addon created and running
- [ ] Backend service configured with Dockerfile build
- [ ] Build context set to `/backend`
- [ ] Port changed to `3000`
- [ ] All environment variables added
- [ ] Database and Redis linked
- [ ] Service deployed successfully
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Frontend service created (if needed)
- [ ] CORS origin updated with frontend URL
- [ ] Custom domain configured (optional)

---

## Security Recommendations

1. **Change JWT secrets** - Use strong random strings (min 32 characters)
2. **Enable HTTPS** - Northflank does this by default
3. **Set up monitoring** - Use Northflank's built-in monitoring
4. **Enable backups** - For database addon
5. **Rotate secrets** - Periodically update JWT secrets
6. **Use secrets manager** - For sensitive environment variables

---

## Next Steps

1. Deploy the backend following this guide
2. Test the API endpoints
3. Deploy the frontend
4. Configure custom domain (optional)
5. Set up monitoring and alerts
6. Configure CI/CD webhooks (optional)

Good luck with your deployment! 🎉
