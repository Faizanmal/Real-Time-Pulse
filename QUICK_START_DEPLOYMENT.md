# 🚀 Quick Start: Deploy Real-Time Pulse in 30 Minutes

This guide gets you from zero to production-deployed Real-Time Pulse in the fastest way possible.

## ⚡ 30-Minute Deployment (Docker Compose)

### Prerequisites (5 minutes)
```bash
# Install Docker and Docker Compose
# macOS: brew install docker docker-compose
# Ubuntu: sudo apt-get install docker.io docker-compose
# Windows: Download Docker Desktop

# Verify installation
docker --version
docker-compose --version
```

### Step 1: Clone & Setup (5 minutes)
```bash
cd /workspaces/Real-Time-Pulse

# Copy environment files
cp backend-nest/.env.example backend-nest/.env.production
cp frontend/.env.example frontend/.env.production

# Edit .env.production files with your settings (see configuration section below)
```

### Step 2: Configure Services (10 minutes)

**Edit `backend-nest/.env.production`:**
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/real_time_pulse

# Redis
REDIS_URL=redis://redis:6379

# Email (choose one)
SENDGRID_API_KEY=your_sendgrid_key  # OR
AWS_SES_REGION=us-east-1
AWS_SES_CREDENTIALS=...

# Push Notifications (optional)
FIREBASE_PROJECT_ID=your_firebase_project

# OAuth (for user login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWT
JWT_SECRET=generate_a_random_32_char_string

# General
NODE_ENV=production
API_URL=http://localhost:3000
```

**Edit `frontend/.env.production`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
NODE_ENV=production
```

### Step 3: Build & Deploy (10 minutes)
```bash
# Build and start all services
docker-compose -f backend-nest/docker-compose.yml up -d

# Wait for services to start
sleep 10

# Run database migrations
docker-compose -f backend-nest/docker-compose.yml exec api npx prisma migrate deploy

# Check logs
docker-compose -f backend-nest/docker-compose.yml logs -f api

# You should see: [Nest] ... NestFactory bootstrapped successfully
```

### Step 4: Verify Deployment (5 minutes)
```bash
# Test API health
curl http://localhost:3001/health
# Should return: {"status":"ok"}

# Test database connection
docker-compose -f backend-nest/docker-compose.yml exec api npx prisma db push
# Should succeed without errors

# Check running containers
docker-compose -f backend-nest/docker-compose.yml ps
# Should show: api, postgres, redis all "Up"
```

### 🎉 Done! Your System is Live

- **API**: http://localhost:3001
- **Frontend**: http://localhost:3000 (if running frontend separately)
- **Database**: PostgreSQL on localhost:5432
- **Cache**: Redis on localhost:6379

---

## 📋 Environment Variable Quick Reference

### Critical (Must Configure)
| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | PostgreSQL connection |
| `JWT_SECRET` | Any 32+ character random string | API authentication |
| `GOOGLE_CLIENT_ID` | From Google OAuth | User login |
| `GOOGLE_CLIENT_SECRET` | From Google OAuth | User login |

### Important (Should Configure)
| Variable | Example | Purpose |
|----------|---------|---------|
| `SENDGRID_API_KEY` | `SG.xxxxx` | Email delivery |
| `REDIS_URL` | `redis://localhost:6379` | Caching & jobs |
| `API_URL` | `https://api.yourdomain.com` | CORS & frontend connection |

### Optional (Nice to Have)
| Variable | Example | Purpose |
|----------|---------|---------|
| `FIREBASE_PROJECT_ID` | `my-project` | Push notifications |
| `SENTRY_DSN` | `https://key@sentry.io/...` | Error tracking |
| `DATADOG_API_KEY` | `xxx` | Performance monitoring |

---

## 🐳 Docker Compose Commands

```bash
# Start all services
docker-compose -f backend-nest/docker-compose.yml up -d

# Stop all services
docker-compose -f backend-nest/docker-compose.yml down

# View logs
docker-compose -f backend-nest/docker-compose.yml logs -f api

# Run command in container
docker-compose -f backend-nest/docker-compose.yml exec api npm run build

# See container status
docker-compose -f backend-nest/docker-compose.yml ps

# Remove all data (cleanup)
docker-compose -f backend-nest/docker-compose.yml down -v
```

---

## ☁️ Cloud Deployment (AWS/GCP/Azure)

### AWS ECS (10 minutes)
```bash
# 1. Push Docker image to ECR
aws ecr create-repository --repository-name real-time-pulse-api
docker tag real-time-pulse:latest <account>.dkr.ecr.us-east-1.amazonaws.com/real-time-pulse-api:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/real-time-pulse-api:latest

# 2. Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier real-time-pulse-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --allocated-storage 20

# 3. Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id real-time-pulse-cache \
  --cache-node-type cache.t3.micro \
  --engine redis

# 4. Deploy to ECS (use AWS Console or CDK)
# Update environment variables with RDS and ElastiCache endpoints
```

### Google Cloud Run (15 minutes)
```bash
# 1. Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/real-time-pulse-api

# 2. Deploy to Cloud Run
gcloud run deploy real-time-pulse-api \
  --image gcr.io/PROJECT_ID/real-time-pulse-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=postgresql://... \
  --memory 512Mi \
  --cpu 1

# 3. Run migrations
gcloud run execute --service real-time-pulse-api -- npx prisma migrate deploy
```

### Azure App Service (15 minutes)
```bash
# 1. Create resource group
az group create --name real-time-pulse --location eastus

# 2. Create App Service Plan
az appservice plan create \
  --name real-time-pulse-plan \
  --resource-group real-time-pulse \
  --sku B1

# 3. Create Web App
az webapp create \
  --resource-group real-time-pulse \
  --plan real-time-pulse-plan \
  --name real-time-pulse-api \
  --runtime "NODE|18-lts"

# 4. Set environment variables
az webapp config appsettings set \
  --resource-group real-time-pulse \
  --name real-time-pulse-api \
  --settings DATABASE_URL=... JWT_SECRET=...

# 5. Deploy code
git remote add azure <your-azure-repo>
git push azure master
```

---

## 🔐 Production Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable SSL/TLS certificate (Let's Encrypt or AWS/GCP/Azure)
- [ ] Set up firewall rules (only allow HTTPS)
- [ ] Enable database encryption at rest
- [ ] Set up automated backups
- [ ] Configure rate limiting and DDoS protection
- [ ] Enable audit logging
- [ ] Set up monitoring and alerting
- [ ] Create database user with minimal permissions
- [ ] Rotate JWT secret regularly
- [ ] Set up CORS with specific allowed domains
- [ ] Enable HTTP security headers (HSTS, CSP, X-Frame-Options)

---

## 📊 Monitoring & Health Checks

### Health Endpoint
```bash
curl http://api.yourdomain.com/health
# Response: {"status":"ok","timestamp":"2025-12-27T..."}
```

### Logs
```bash
# Docker Compose
docker-compose -f backend-nest/docker-compose.yml logs -f --tail=100

# Cloud (CloudWatch, Cloud Logging, etc.)
# Use your cloud provider's logging console
```

### Metrics
- Set up Prometheus scraping on `/metrics` endpoint
- Import Grafana dashboards for visualization
- Configure alerts for high error rates, slow responses

---

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose -f backend-nest/docker-compose.yml logs postgres

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Redis Connection Failed
```bash
# Check Redis is running
docker-compose -f backend-nest/docker-compose.yml logs redis

# Test connection
redis-cli -u $REDIS_URL ping
```

### API Not Starting
```bash
# Check logs
docker-compose -f backend-nest/docker-compose.yml logs api

# Rebuild image
docker-compose -f backend-nest/docker-compose.yml build --no-cache

# Restart
docker-compose -f backend-nest/docker-compose.yml restart api
```

### Frontend Can't Connect to API
```bash
# Check API is running
curl http://localhost:3001/health

# Check CORS configuration
# Frontend should be using NEXT_PUBLIC_API_URL environment variable
# API should have matching CORS_ORIGIN setting
```

---

## 📚 Complete Guides

For detailed information, see:
- **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** - Comprehensive deployment guide
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Implementation status
- **[PRODUCTION_READY.md](./PRODUCTION_READY.md)** - Feature checklist
- **[backend-nest/.env.example](./backend-nest/.env.example)** - All configuration options
- **[backend-nest/README.md](./backend-nest/README.md)** - Backend-specific docs

---

## ✅ Deployment Verification

Once deployed, verify these endpoints work:

```bash
# API health
curl https://api.yourdomain.com/health

# Authentication (should redirect to Google OAuth)
curl https://api.yourdomain.com/auth/google

# Database connectivity
# Should be able to create workspace and user

# WebSocket (real-time updates)
# Should connect without errors

# Email sending (if configured)
# Send test notification from admin panel

# Integration data (if integrations configured)
# Widgets should display real data from Asana, GA, etc.
```

---

## 🎯 Success Criteria

✅ Your deployment is successful when:
- [ ] API health endpoint responds with `{"status":"ok"}`
- [ ] Frontend loads without console errors
- [ ] Users can sign up and create workspaces
- [ ] Widgets display real integration data
- [ ] Notifications send without errors
- [ ] Database migration completed successfully
- [ ] All environment variables are set correctly
- [ ] No errors in application logs

---

**You're ready to go live! 🚀**

For production support, monitoring, and scaling guidance, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).
