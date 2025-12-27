# Real-Time Pulse - Production Deployment Guide

## Overview

Real-Time Pulse is now production-ready with all incomplete features fully implemented and tested. This guide covers deployment, configuration, and verification steps.

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (for containerized deployment)
- Environment variables configured (see .env.example)

## Quick Start - Local Development

### 1. Clone and Install Dependencies

```bash
cd /workspaces/Real-Time-Pulse
npm install
cd backend-nest && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
# Backend
cp backend-nest/.env.example backend-nest/.env
# Edit backend-nest/.env with your credentials

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your API URL
```

### 3. Database Setup

```bash
cd backend-nest
npx prisma generate
npx prisma migrate deploy
npx prisma db seed  # Optional: seed with sample data
```

### 4. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend-nest
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the application at `http://localhost:3000`

## Production Deployment

### Docker Deployment

#### 1. Build Docker Images

```bash
# Backend
cd backend-nest
docker build -t real-time-pulse-api:latest .

# Frontend
cd ../frontend
docker build -t real-time-pulse-web:latest .
```

#### 2. Deploy with Docker Compose

```bash
cd /workspaces/Real-Time-Pulse
docker-compose up -d
```

#### 3. Run Database Migrations

```bash
docker-compose exec api npx prisma migrate deploy
```

### Cloud Deployment (AWS/GCP/Azure)

#### Option 1: AWS Elastic Beanstalk

**Backend:**
```bash
cd backend-nest
# Create .ebignore file
echo "node_modules" > .ebignore
echo "dist" >> .ebignore

# Deploy
eb init
eb create real-time-pulse-api
eb deploy
```

**Frontend:**
```bash
cd frontend
# Build static export
npm run build
# Deploy to CloudFront/S3
aws s3 sync .next/static s3://your-bucket/
```

#### Option 2: Heroku

**Backend:**
```bash
cd backend-nest
heroku create real-time-pulse-api
heroku config:set DATABASE_URL="postgresql://..."
git push heroku main
```

**Frontend:**
```bash
cd frontend
heroku create real-time-pulse-web
npm run build && git push heroku main
```

#### Option 3: DigitalOcean App Platform

1. Connect your GitHub repository
2. Create new app with two components:
   - Backend service: `backend-nest/`
   - Frontend service: `frontend/`
3. Configure environment variables
4. Deploy

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace real-time-pulse

# Create secrets
kubectl create secret generic app-secrets \
  --from-env-file=backend-nest/.env \
  -n real-time-pulse

# Apply manifests (update manifests with your values)
kubectl apply -f k8s/
```

## Environment Configuration

### Critical Production Settings

```env
# Security
JWT_SECRET=<generate-secure-random-32-char>
ENCRYPTION_KEY=<generate-secure-32-char-key>
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Email Service (Required for reports and notifications)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=<your-api-key>

# Redis (Recommended for production)
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# OAuth (At least one required)
GOOGLE_CLIENT_ID=<your-id>
GOOGLE_CLIENT_SECRET=<your-secret>

# API Integrations (Configure at least one)
ASANA_CLIENT_ID=<your-id>
ASANA_CLIENT_SECRET=<your-secret>
```

## Verification Checklist

### Backend

- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] All APIs responding
- [ ] Authentication working (login/signup)
- [ ] Email notifications sending
- [ ] Push notifications configured
- [ ] Integrations connecting properly
- [ ] Reports generating and emailing
- [ ] Audit logs recording
- [ ] WebSocket connections active

```bash
# Test backend health
curl http://localhost:3333/health

# Check database
npx prisma db execute --stdin < database-check.sql

# Verify Redis
redis-cli PING
```

### Frontend

- [ ] Build completes without errors
- [ ] Application loads on homepage
- [ ] Authentication pages working
- [ ] Dashboard loads and displays data
- [ ] WebSocket connections active (real-time updates)
- [ ] File uploads working
- [ ] Reports downloading
- [ ] PWA offline mode functional
- [ ] All main features accessible

```bash
# Build and test
npm run build
npm run start

# Check performance
npm run lighthouse
```

### Integration Tests

```bash
# Run E2E tests
cd e2e
npm install
npx playwright test

# Generate coverage report
npm run test:coverage
```

## Security Hardening

### Network Security

```nginx
# Configure HTTPS/TLS
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### Database Security

```bash
# Backups
pg_dump -h localhost -U postgres real_time_pulse > backup.sql
# Restore
psql -h localhost -U postgres real_time_pulse < backup.sql

# Enable SSL connections
sslmode=require in DATABASE_URL
```

### Secrets Management

```bash
# Use environment secrets, never commit to git
# Example with AWS Secrets Manager
aws secretsmanager create-secret --name real-time-pulse/api

# Or HashiCorp Vault
vault kv put secret/real-time-pulse/api JWT_SECRET=xxxxx
```

## Monitoring & Logging

### Application Monitoring

```bash
# With Sentry
SENTRY_DSN=https://xxx@sentry.io/xxxx npm run start

# With DataDog
dd-trace npm run start

# With New Relic
NEW_RELIC_HOME=. newrelic npm run start
```

### Log Aggregation

```bash
# Winston logging configured
# Logs automatically:
# - Errors with stack traces
# - API requests/responses
# - Database queries
# - External service calls
# - User actions (audit trail)

# View logs
docker logs -f real-time-pulse-api

# Stream to ELK
# Configured in winston transports
```

### Performance Monitoring

```bash
# Frontend metrics (built-in)
# - Core Web Vitals
# - Page load times
# - API response times
# - Memory usage

# Backend metrics
# - Database query performance
# - Redis operation times
# - API endpoint response times
# - Queue processing times
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error logs
- Check database size
- Verify backups completed

**Weekly:**
- Review performance metrics
- Update dependencies (security patches)
- Check SSL certificate expiration

**Monthly:**
- Full backup verification
- Security audit
- Capacity planning review

### Scaling

```bash
# Horizontal scaling - run multiple backend instances
# Use load balancer (nginx, AWS ELB, GCP Load Balancer)
# Database: Add read replicas for read-heavy workloads
# Redis: Use Redis Cluster for high availability
# Storage: Use S3/GCS for file storage instead of local filesystem
```

## Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify DATABASE_URL format
# postgresql://user:password@host:5432/database
```

**Redis Connection Error**
```bash
# Check Redis is running
redis-cli PING
# Should return: PONG
```

**Email Not Sending**
```bash
# Verify SendGrid API key
curl -X GET "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"

# Check email logs in backend
docker logs real-time-pulse-api | grep email
```

**WebSocket Connection Failed**
```bash
# Verify WebSocket proxy configuration
# Check firewall allows WebSocket (ws:// on port 3333)
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3333
```

## Performance Optimization

### Database

```sql
-- Enable query analysis
EXPLAIN ANALYZE SELECT * FROM widgets;

-- Add indexes for frequently queried fields
CREATE INDEX idx_widgets_portalid ON widgets(portalId);
CREATE INDEX idx_auditlogs_userid ON audit_logs(userId);
CREATE INDEX idx_auditlogs_timestamp ON audit_logs(createdAt);
```

### Redis Caching

```typescript
// Cache TTLs configured
const CACHE_TTL = {
  user: 3600,        // 1 hour
  workspace: 1800,   // 30 mins
  portal: 900,       // 15 mins
  widget: 300,       // 5 mins
  analytics: 60,     // 1 min
};
```

### Frontend Optimization

```bash
# Bundle analysis
npm run analyze

# Lighthouse audit
npm run lighthouse

# Next.js optimization
# - Image optimization
# - Code splitting
# - Static generation where possible
# - ISR for dynamic pages
```

## Support & Documentation

- **API Documentation**: `/api/docs` (Swagger)
- **Features Guide**: [FEATURES_GUIDE.md](../FEATURES_GUIDE.md)
- **API Reference**: [API_REFERENCE.md](../API_REFERENCE.md)
- **Frontend Integration**: [FRONTEND_INTEGRATION.md](../frontend/FRONTEND_INTEGRATION.md)

## License

Proprietary - All rights reserved
