# 🔐 Production Secrets - READY TO USE

## Copy these directly into Northflank Environment Variables

### Generated JWT Secrets (Use these!)
```
JWT_SECRET=VidOKPtZF3QH2vi/AzugBFeqEGBtn0XpYbGRe/SB/Ak=
JWT_REFRESH_SECRET=Tkt6qtL6Va1v4m4KCQpMgINndiomhfSanwtG1WhKae4=
```

---

## 📝 Complete Environment Variables List for Northflank

### Copy-paste these into the "Environment Variables" section:

#### 1. Link Addons (Do this first):
- Link PostgreSQL addon → This creates `DATABASE_URL`
- Link Redis addon → This creates `REDIS_URL`

#### 2. Add these variables manually:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=VidOKPtZF3QH2vi/AzugBFeqEGBtn0XpYbGRe/SB/Ak=
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=Tkt6qtL6Va1v4m4KCQpMgINndiomhfSanwtG1WhKae4=
JWT_REFRESH_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BASE_URL=https://site--url-shortener--44yr75b2v68c.code.run
SHORT_CODE_LENGTH=7
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=900000
EMAIL_VERIFICATION_EXPIRES=86400000
PASSWORD_RESET_EXPIRES=3600000
```

---

## ⚠️ IMPORTANT: Update These After Deployment

### 1. BASE_URL
After your service is deployed, Northflank will give you the actual URL.
Update `BASE_URL` to match it (e.g., `https://site--url-shortener--xyz123.code.run`)

### 2. CORS_ORIGIN
After you deploy your frontend, update this to your frontend URL.
Example: `https://frontend--url-shortener--abc456.code.run`

You can also allow multiple origins with comma separation:
```
CORS_ORIGIN=https://frontend.code.run,https://yourdomain.com
```

---

## 🔒 Security Notes

- **NEVER commit these secrets to Git**
- **Store them in a password manager**
- **Rotate them periodically (every 3-6 months)**
- **Use different secrets for staging/production**

---

## ✅ Deployment Checklist

Copy-paste this into Northflank:

| Variable | Value | Status |
|----------|-------|--------|
| NODE_ENV | `production` | [ ] |
| PORT | `3000` | [ ] |
| JWT_SECRET | `VidOKPtZF3QH2vi/AzugBFeqEGBtn0XpYbGRe/SB/Ak=` | [ ] |
| JWT_EXPIRES_IN | `24h` | [ ] |
| JWT_REFRESH_SECRET | `Tkt6qtL6Va1v4m4KCQpMgINndiomhfSanwtG1WhKae4=` | [ ] |
| JWT_REFRESH_EXPIRES_IN | `7d` | [ ] |
| RATE_LIMIT_WINDOW_MS | `900000` | [ ] |
| RATE_LIMIT_MAX_REQUESTS | `100` | [ ] |
| BASE_URL | *Your Northflank URL* | [ ] |
| SHORT_CODE_LENGTH | `7` | [ ] |
| CORS_ORIGIN | *Your frontend URL* | [ ] |
| LOG_LEVEL | `info` | [ ] |
| LOG_FILE_PATH | `logs/app.log` | [ ] |
| BCRYPT_SALT_ROUNDS | `12` | [ ] |
| MAX_LOGIN_ATTEMPTS | `5` | [ ] |
| LOCK_TIME | `900000` | [ ] |
| EMAIL_VERIFICATION_EXPIRES | `86400000` | [ ] |
| PASSWORD_RESET_EXPIRES | `3600000` | [ ] |
| DATABASE_URL | *Linked from addon* | [ ] |
| REDIS_URL | *Linked from addon* | [ ] |

---

## 🎯 Quick Copy Format for Northflank

If Northflank has a bulk import feature, use this:

```json
{
  "NODE_ENV": "production",
  "PORT": "3000",
  "JWT_SECRET": "VidOKPtZF3QH2vi/AzugBFeqEGBtn0XpYbGRe/SB/Ak=",
  "JWT_EXPIRES_IN": "24h",
  "JWT_REFRESH_SECRET": "Tkt6qtL6Va1v4m4KCQpMgINndiomhfSanwtG1WhKae4=",
  "JWT_REFRESH_EXPIRES_IN": "7d",
  "RATE_LIMIT_WINDOW_MS": "900000",
  "RATE_LIMIT_MAX_REQUESTS": "100",
  "BASE_URL": "https://site--url-shortener--44yr75b2v68c.code.run",
  "SHORT_CODE_LENGTH": "7",
  "CORS_ORIGIN": "http://localhost:3001",
  "LOG_LEVEL": "info",
  "LOG_FILE_PATH": "logs/app.log",
  "BCRYPT_SALT_ROUNDS": "12",
  "MAX_LOGIN_ATTEMPTS": "5",
  "LOCK_TIME": "900000",
  "EMAIL_VERIFICATION_EXPIRES": "86400000",
  "PASSWORD_RESET_EXPIRES": "3600000"
}
```

---

## 🚀 You're Ready!

All secrets generated and ready to use. Follow the [DEPLOYMENT_QUICK_REFERENCE.md](./DEPLOYMENT_QUICK_REFERENCE.md) to complete your deployment!
