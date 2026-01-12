# 🎯 Northflank Form Quick Reference

## What to Fill in the Northflank Deployment Form

### ✅ Basic Information
```
Service name: url-shortener
Tags: backend, api, production (optional)
```

### ✅ Repository
```
Repository: snjy-kumar/url-shortener
Branch: master
```

### ⚠️ Build Options - IMPORTANT CHANGES
```
Build type: Dockerfile (NOT Buildpack!)
Dockerfile path: backend/Dockerfile
Build context: /backend (CHANGE from /)
```

### ✅ Resources
```
Compute plan: nf-compute-400-16 (4 vCPU, 16GB RAM)
Instances: 1
Autoscaling: Disabled (or enable if available)
```

### ⚠️ Networking - PORT CHANGE
```
Port: 3000 (CHANGE from 8080!)
Protocol: HTTP
Publicly expose: ✓ Yes
Name: site
```

### ✅ Environment Variables

#### Link Addons First:
1. Click "Link Addon" → Select your PostgreSQL database
   - This automatically creates `DATABASE_URL`
2. Click "Link Addon" → Select your Redis instance
   - This automatically creates `REDIS_URL`

#### Then Add These Variables:

| Variable Name | Value |
|--------------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | `YOUR_STRONG_SECRET_HERE` (min 32 chars) |
| `JWT_EXPIRES_IN` | `24h` |
| `JWT_REFRESH_SECRET` | `YOUR_DIFFERENT_STRONG_SECRET` (min 32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `BASE_URL` | Your Northflank URL (e.g., `https://site--url-shortener--44yr75b2v68c.code.run`) |
| `SHORT_CODE_LENGTH` | `7` |
| `CORS_ORIGIN` | Your frontend URL (update after frontend deployment) |
| `LOG_LEVEL` | `info` |
| `LOG_FILE_PATH` | `logs/app.log` |
| `BCRYPT_SALT_ROUNDS` | `12` |
| `MAX_LOGIN_ATTEMPTS` | `5` |
| `LOCK_TIME` | `900000` |
| `EMAIL_VERIFICATION_EXPIRES` | `86400000` |
| `PASSWORD_RESET_EXPIRES` | `3600000` |

#### Generate Strong Secrets:
Run this in your terminal to generate secrets:
```bash
# For JWT_SECRET
openssl rand -base64 32

# For JWT_REFRESH_SECRET
openssl rand -base64 32
```

### ✅ Advanced Options

#### Health Checks:
```
Enable health checks: ✓ Yes
Path: /health
Initial delay: 30 seconds
Period: 30 seconds
Timeout: 10 seconds
```

#### Buildpack Runtime Mode:
```
Not applicable - using Dockerfile
```

---

## 📋 Pre-Deployment Checklist

Before clicking "Create Service":

- [ ] Created PostgreSQL database addon
- [ ] Created Redis addon
- [ ] Changed build type to **Dockerfile**
- [ ] Changed build context to **/backend**
- [ ] Changed port to **3000**
- [ ] Linked database addon (creates DATABASE_URL)
- [ ] Linked Redis addon (creates REDIS_URL)
- [ ] Added all environment variables
- [ ] Generated strong JWT secrets
- [ ] Updated BASE_URL to match your Northflank URL
- [ ] Enabled health checks

---

## 🚀 After Deployment

### 1. Run Database Migrations
```
Go to: Service → Jobs → Run Job
Command: npm run db:migrate:prod
```

### 2. (Optional) Seed Database
```
Go to: Service → Jobs → Run Job
Command: npm run db:seed
```

### 3. Check Logs
```
Go to: Service → Logs
Look for: "Server is running on port 3000"
```

### 4. Test Health Endpoint
```
Visit: https://site--url-shortener--44yr75b2v68c.code.run/health
Should return: { "status": "OK", ... }
```

---

## ⚠️ Common Issues

### Build Fails?
- ✓ Build context is `/backend` (not `/`)
- ✓ Dockerfile path is `backend/Dockerfile`
- ✓ All dependencies in package.json

### Container Won't Start?
- ✓ DATABASE_URL is set correctly
- ✓ Port is set to 3000
- ✓ Check logs for error messages

### Database Connection Error?
- ✓ Database addon is running
- ✓ DATABASE_URL is linked correctly
- ✓ Prisma Client is generated (happens in build)

### Redis Connection Error?
- ✓ Redis addon is running
- ✓ REDIS_URL is linked correctly

---

## 💡 Pro Tips

1. **Start Small**: Use a smaller compute plan first, scale up if needed
2. **Monitor Costs**: Check Northflank billing dashboard regularly
3. **Enable Autoscaling**: Once stable, enable autoscaling for better performance
4. **Set Up Alerts**: Configure alerts for high CPU/memory usage
5. **Use Secrets**: For sensitive data, use Northflank's secret storage
6. **Custom Domain**: Add your own domain in Networking → Custom Domains
7. **CI/CD**: Enable automatic deployments on git push
8. **Backups**: Enable automated backups for your database

---

## 🎉 Ready to Deploy!

Click "Create Service" and watch your app come to life!

Check the full guide: [NORTHFLANK_DEPLOYMENT.md](./NORTHFLANK_DEPLOYMENT.md)
