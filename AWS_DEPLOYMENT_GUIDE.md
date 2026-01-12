# 🚀 AWS EC2 Deployment Guide - URL Shortener

## Quick Overview
Deploy URL shortener on AWS with EC2, RDS PostgreSQL, ElastiCache Redis - Production-ready in 30 minutes.

---

## 💰 Cost Estimate
- **EC2 t3.small**: ~$15/month
- **RDS db.t3.micro**: ~$15/month  
- **ElastiCache t3.micro**: ~$12/month
- **Total**: ~$42/month (with reserved instances can be ~$25/month)

---

## Prerequisites
- AWS Account
- AWS CLI installed locally
- GitHub repository access
- Domain name (optional but recommended)

---

## Step 1: Setup RDS PostgreSQL (10 min)

### 1.1 Create Database
```bash
# Via AWS Console:
1. Go to RDS → Create database
2. Choose: PostgreSQL 15.x
3. Template: Free tier (or Production for real use)
4. DB instance: db.t3.micro
5. DB name: urlshortener
6. Master username: postgres
7. Auto-generate password (SAVE IT!)
8. VPC: Default
9. Public access: Yes (for now, restrict later)
10. Security group: Create new (urlshortener-db-sg)
11. Initial database: urlshortener_db
12. Create database
```

### 1.2 Configure Security Group
```bash
# Add inbound rule to urlshortener-db-sg:
Type: PostgreSQL
Port: 5432
Source: Your EC2 security group (create in next step)
```

### 1.3 Get Connection String
```
postgresql://postgres:YOUR_PASSWORD@your-rds-endpoint.region.rds.amazonaws.com:5432/urlshortener_db
```

---

## Step 2: Setup ElastiCache Redis (5 min)

### 2.1 Create Redis Cluster
```bash
# Via AWS Console:
1. Go to ElastiCache → Redis → Create
2. Cluster mode: Disabled
3. Node type: cache.t3.micro
4. Number of replicas: 0 (1 for production)
5. Subnet group: Create new
6. Security group: Create new (urlshortener-redis-sg)
7. Create
```

### 2.2 Configure Security Group
```bash
# Add inbound rule to urlshortener-redis-sg:
Type: Custom TCP
Port: 6379
Source: Your EC2 security group
```

### 2.3 Get Connection String
```
redis://your-redis-endpoint.cache.amazonaws.com:6379
```

---

## Step 3: Launch EC2 Instance (10 min)

### 3.1 Create EC2 Instance
```bash
# Via AWS Console:
1. EC2 → Launch Instance
2. Name: url-shortener-backend
3. AMI: Ubuntu Server 22.04 LTS
4. Instance type: t3.small (2 vCPU, 2GB RAM)
5. Key pair: Create new or use existing
6. Network: Default VPC
7. Security group: Create new (urlshortener-app-sg)
   - SSH (22) from Your IP
   - HTTP (80) from Anywhere
   - HTTPS (443) from Anywhere
   - Custom TCP (3000) from Anywhere (for testing)
8. Storage: 20GB gp3
9. Launch instance
```

### 3.2 Allocate Elastic IP (Important!)
```bash
# Prevent IP change on restart
1. EC2 → Elastic IPs → Allocate
2. Associate with your instance
```

---

## Step 4: Setup Server (10 min)

### 4.1 Connect to EC2
```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 4.2 Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Verify installations
node --version  # Should be v20.x
npm --version
pm2 --version
nginx -v
```

### 4.3 Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/snjy-kumar/url-shortener.git
cd url-shortener/backend
```

### 4.4 Install Project Dependencies
```bash
npm ci --only=production
```

### 4.5 Setup Environment Variables
```bash
# Create production .env
nano .env
```

Paste this (replace with YOUR values):
```env
NODE_ENV=production
PORT=3000
TRUST_PROXY=true

# From Step 1
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@your-rds-endpoint.region.rds.amazonaws.com:5432/urlshortener_db

# Generate with: openssl rand -base64 32
JWT_SECRET=YOUR_GENERATED_SECRET_HERE
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=YOUR_DIFFERENT_SECRET_HERE
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Your Elastic IP or domain
BASE_URL=http://YOUR_ELASTIC_IP
SHORT_CODE_LENGTH=7

# Update after frontend deployment
CORS_ORIGIN=http://YOUR_ELASTIC_IP,http://localhost:3001

LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log

# From Step 2
REDIS_URL=redis://your-redis-endpoint.cache.amazonaws.com:6379

BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=900000
EMAIL_VERIFICATION_EXPIRES=86400000
PASSWORD_RESET_EXPIRES=3600000
```

Save: `Ctrl+X`, `Y`, `Enter`

### 4.6 Generate Prisma Client & Run Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Seed database
npm run db:seed
```

### 4.7 Build TypeScript
```bash
npm run build
```

### 4.8 Start with PM2
```bash
# Start application
pm2 start dist/index.js --name url-shortener

# Enable startup script
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs url-shortener
```

---

## Step 5: Configure Nginx (5 min)

### 5.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/url-shortener
```

Paste:
```nginx
server {
    listen 80;
    server_name YOUR_ELASTIC_IP;  # or your domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/url-shortener-access.log;
    error_log /var/log/nginx/url-shortener-error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Pass real client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        
        # WebSocket support (if needed later)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/url-shortener /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 6: SSL with Let's Encrypt (Optional, 5 min)

### 6.1 Point Domain to EC2
```bash
# In your DNS provider:
A Record: @ → YOUR_ELASTIC_IP
A Record: www → YOUR_ELASTIC_IP
```

### 6.2 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.3 Get SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 6.4 Update .env
```bash
nano /home/ubuntu/url-shortener/backend/.env
# Change BASE_URL to https://yourdomain.com
# Update CORS_ORIGIN to https://yourdomain.com

pm2 restart url-shortener
```

---

## Step 7: Monitoring & Maintenance

### 7.1 Setup CloudWatch (Optional)
```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

### 7.2 PM2 Monitoring
```bash
pm2 monit                 # Real-time monitoring
pm2 logs url-shortener    # View logs
pm2 restart url-shortener # Restart app
pm2 reload url-shortener  # Zero-downtime restart
```

### 7.3 Nginx Logs
```bash
sudo tail -f /var/log/nginx/url-shortener-access.log
sudo tail -f /var/log/nginx/url-shortener-error.log
```

---

## 🔒 Security Hardening (CRITICAL for Production)

### 1. Update Security Groups
```bash
# RDS Security Group:
- Remove public access
- Allow only from EC2 security group

# Redis Security Group:
- Allow only from EC2 security group

# EC2 Security Group:
- Remove port 3000 from public
- Restrict SSH to your IP only
```

### 2. Setup Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. Enable Automatic Updates
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 4. Setup Fail2Ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🔄 Deployment Updates

### Deploy New Changes
```bash
# On EC2:
cd /home/ubuntu/url-shortener/backend
git pull origin master
npm ci --only=production
npm run build
npx prisma migrate deploy
pm2 reload url-shortener
```

### Rollback
```bash
git checkout <previous-commit-hash>
npm ci --only=production
npm run build
pm2 reload url-shortener
```

---

## ⚠️ Troubleshooting

### App Won't Start
```bash
# Check logs
pm2 logs url-shortener --lines 100

# Check if port is in use
sudo lsof -i :3000

# Restart
pm2 restart url-shortener
```

### Database Connection Issues
```bash
# Test connection from EC2
sudo apt install -y postgresql-client
psql "postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/urlshortener_db"

# Check security groups
# Check RDS is running
```

### Nginx Issues
```bash
sudo nginx -t                                    # Test config
sudo systemctl status nginx                      # Check status
sudo tail -f /var/log/nginx/error.log           # View errors
```

---

## 📊 Performance Optimization

### Enable Gzip in Nginx
```nginx
# Add to http block in /etc/nginx/nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml;
```

### PM2 Cluster Mode
```bash
pm2 delete url-shortener
pm2 start dist/index.js --name url-shortener -i 2  # 2 instances
pm2 save
```

---

## 📈 Scaling Tips

1. **Upgrade EC2**: t3.small → t3.medium when needed
2. **RDS Read Replica**: For high read workloads
3. **ElastiCache Cluster**: Add replica for high availability
4. **Load Balancer**: Add ALB when multiple EC2 instances
5. **Auto Scaling**: Setup auto scaling group

---

## ✅ Final Checklist

- [ ] RDS PostgreSQL running and accessible
- [ ] ElastiCache Redis running and accessible
- [ ] EC2 instance with Elastic IP
- [ ] Node.js 20.x installed
- [ ] Repository cloned and dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] App built and running with PM2
- [ ] Nginx configured and running
- [ ] SSL certificate installed (if using domain)
- [ ] Security groups properly configured
- [ ] Firewall enabled
- [ ] Health check passing: http://YOUR_IP/health
- [ ] Can create short URL via API
- [ ] Logs being written properly

---

## 🎉 You're Live!

Test your API:
```bash
curl http://YOUR_IP/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T...",
  "uptime": 123.45,
  "environment": "production",
  "services": {
    "database": "healthy",
    "cache": {"status": "connected", "latency": 5}
  }
}
```

---

## 📞 Support

Check logs first:
- PM2: `pm2 logs url-shortener`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- Application: `/home/ubuntu/url-shortener/backend/logs/app.log`

**Estimated Total Time: 30-40 minutes**
