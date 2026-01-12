# 🎯 Northflank Deployment - Step by Step

## 📌 What We've Prepared for You

✅ Created Dockerfile for your backend  
✅ Created .dockerignore  
✅ Generated strong JWT secrets  
✅ Created comprehensive deployment guides  
✅ Your app already has health checks  

---

## 🚀 Deployment Steps (Follow in Order)

### STEP 1: Create Database (5 minutes)
```
Northflank Dashboard → Add New → Addon → PostgreSQL
Name: url-shortener-db
Plan: nf-storage-200 (2GB)
Click Deploy
```
📝 **Note**: Wait for it to become "Ready" before proceeding

---

### STEP 2: Create Redis (3 minutes)
```
Add New → Addon → Redis
Name: url-shortener-redis
Plan: nf-redis-50
Click Deploy
```
📝 **Note**: Wait for it to become "Ready"

---

### STEP 3: Configure Your Service

You're on this page now! Fill in:

#### ✅ Already Correct:
- Service name: `url-shortener` ✓
- Repository: `snjy-kumar/url-shortener` ✓
- Branch: `master` ✓

#### ⚠️ CHANGE THESE:

**Build Options:**
```diff
- Build type: Buildpack
+ Build type: Dockerfile

+ Dockerfile path: backend/Dockerfile

- Build context: /
+ Build context: /backend
```

**Resources:**
```
✓ Plan: nf-compute-400-16 (4 vCPU, 16GB)
✓ Instances: 1
```

**Networking:**
```diff
- Port: 8080
+ Port: 3000

✓ Protocol: HTTP
✓ Publicly expose: Yes
✓ Name: site
```

**Health Checks (in Advanced):**
```
✓ Enable health checks: Yes
+ Path: /health
+ Initial delay: 30 seconds
+ Period: 30 seconds
```

---

### STEP 4: Environment Variables

#### A. Link Addons (Do this first!)
```
1. Click "Link Addon"
2. Select "url-shortener-db"
3. Click "Link Addon" again
4. Select "url-shortener-redis"
```

#### B. Add Variables (Click "Add variable" for each)

Open [PRODUCTION_SECRETS.md](./PRODUCTION_SECRETS.md) and copy the values:

**Core Variables:**
- `NODE_ENV` = `production`
- `PORT` = `3000`

**JWT Secrets (from PRODUCTION_SECRETS.md):**
- `JWT_SECRET` = `VidOKPtZF3QH2vi/AzugBFeqEGBtn0XpYbGRe/SB/Ak=`
- `JWT_EXPIRES_IN` = `24h`
- `JWT_REFRESH_SECRET` = `Tkt6qtL6Va1v4m4KCQpMgINndiomhfSanwtG1WhKae4=`
- `JWT_REFRESH_EXPIRES_IN` = `7d`

**Rate Limiting:**
- `RATE_LIMIT_WINDOW_MS` = `900000`
- `RATE_LIMIT_MAX_REQUESTS` = `100`

**URL Configuration:**
- `BASE_URL` = `https://site--url-shortener--44yr75b2v68c.code.run`
- `SHORT_CODE_LENGTH` = `7`
- `CORS_ORIGIN` = `http://localhost:3001` (update after frontend deploy)

**Logging:**
- `LOG_LEVEL` = `info`
- `LOG_FILE_PATH` = `logs/app.log`

**Security:**
- `BCRYPT_SALT_ROUNDS` = `12`
- `MAX_LOGIN_ATTEMPTS` = `5`
- `LOCK_TIME` = `900000`
- `EMAIL_VERIFICATION_EXPIRES` = `86400000`
- `PASSWORD_RESET_EXPIRES` = `3600000`

---

### STEP 5: Deploy! 🚀
```
Click "Create Service" button
```

Wait 5-10 minutes for:
- Building Docker image
- Deploying container
- Starting application

---

### STEP 6: Run Database Migrations

Once deployed and running:

```
1. Go to your service page
2. Click "Jobs" tab
3. Click "Run job"
4. Command: npm run db:migrate:prod
5. Click "Run"
```

Wait for the job to complete successfully.

---

### STEP 7: Test Your Deployment

**Check Health:**
```
Visit: https://site--url-shortener--44yr75b2v68c.code.run/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T...",
  "uptime": 123.45,
  "services": {
    "database": "healthy",
    "cache": "connected"
  }
}
```

**Check Logs:**
```
Service → Logs tab
Look for: "Server is running on port 3000"
```

---

## ✅ Final Checklist

- [ ] Database addon created and ready
- [ ] Redis addon created and ready
- [ ] Build type changed to **Dockerfile**
- [ ] Build context changed to **/backend**
- [ ] Port changed to **3000**
- [ ] Health check enabled with path **/health**
- [ ] Linked database addon
- [ ] Linked Redis addon
- [ ] Added all 18 environment variables
- [ ] Created service
- [ ] Ran database migrations
- [ ] Tested /health endpoint
- [ ] Checked logs for successful startup

---

## 🎉 Success Indicators

You're successfully deployed if you see:

✅ Service status: **Running** (green)  
✅ Health checks: **Passing** (green)  
✅ `/health` endpoint returns `{"status": "OK"}`  
✅ Logs show: `Server is running on port 3000`  

---

## ❌ Common Errors & Fixes

### "Build Failed"
**Cause**: Wrong build context  
**Fix**: Set build context to `/backend`

### "Container Exited"
**Cause**: Database not connected  
**Fix**: Check DATABASE_URL is linked correctly

### "Port is not responding"
**Cause**: Wrong port number  
**Fix**: Set port to `3000`, not `8080`

### "Health check failing"
**Cause**: Path is wrong  
**Fix**: Health check path should be `/health` (not `/api/health`)

---

## 📚 Documentation Files Created

1. **[NORTHFLANK_DEPLOYMENT.md](./NORTHFLANK_DEPLOYMENT.md)** - Complete detailed guide
2. **[DEPLOYMENT_QUICK_REFERENCE.md](./DEPLOYMENT_QUICK_REFERENCE.md)** - Quick form reference
3. **[PRODUCTION_SECRETS.md](./PRODUCTION_SECRETS.md)** - Your generated secrets
4. **THIS FILE** - Step-by-step visual guide

---

## 🔜 Next Steps (After Backend is Running)

1. **Deploy Frontend** - Create another service for Next.js
2. **Update CORS** - Add frontend URL to `CORS_ORIGIN`
3. **Custom Domain** - Add your domain in Networking settings
4. **Monitoring** - Set up alerts for errors/high load
5. **Backups** - Configure database backups
6. **CI/CD** - Enable auto-deploy on git push

---

## 💰 Estimated Costs

Monthly estimate for your configuration:
- Backend (nf-compute-400-16): ~$100-150
- Database (nf-storage-200): ~$20-30
- Redis (nf-redis-50): ~$10-15
- **Total**: ~$130-195/month

💡 **Tip**: Start with smaller plans and scale up as needed!

---

## 🆘 Need Help?

If you run into issues:
1. Check the logs in Northflank
2. Review [NORTHFLANK_DEPLOYMENT.md](./NORTHFLANK_DEPLOYMENT.md)
3. Verify all environment variables are set
4. Ensure database and Redis are running
5. Check build context and Dockerfile path

---

## 🎊 You're All Set!

Everything is ready for deployment. Just follow the steps above and you'll be live in 20 minutes!

Good luck! 🚀
