# Enterprise Features Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
# Backend
cd backend-nest
npm install @nestjs/schedule bull @nestjs/bull

# Frontend
cd ../frontend
npm install localforage
```

### 2. Setup Environment Variables

Add to `backend-nest/.env`:
```env
BACKUP_ENCRYPTION_KEY=generate-a-random-32-byte-key-here
BACKUP_RETENTION_DAYS=30
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Run Database Migration

```bash
cd backend-nest
npx prisma migrate dev
```

### 4. Start Redis (for rate limiting)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (Mac)
brew services start redis
```

### 5. Start the Application

```bash
# Backend
cd backend-nest
npm run start:dev

# Frontend (new terminal)
cd frontend
npm run dev
```

## ✨ Try the Features

### Voice Control
1. Open the dashboard
2. Look for the voice control panel (microphone icon)
3. Click the microphone and say: **"Show me dashboard overview"**
4. System will respond with voice feedback and navigate

### Offline Mode
1. Open Chrome DevTools (F12)
2. Go to Network tab → Check "Offline"
3. Make changes to dashboard
4. Go back online → Changes sync automatically
5. See the offline indicator in bottom-right corner

### Backup & Recovery
1. Navigate to Settings → Backups
2. Click "Create Backup"
3. View backup history
4. Test restore (be careful - use test data!)

### Custom Integrations
1. Go to Integrations → Custom Integrations
2. Click "New Integration"
3. Import from OpenAPI spec or configure manually
4. Add data transformations
5. Create custom widgets

### Rate Limit Monitoring
1. Navigate to Monitoring → Rate Limits
2. See real-time API usage
3. View queue statistics
4. Configure rate limits per integration

## 📊 Feature URLs

- **Backups:** `/settings/backups`
- **Custom Integrations:** `/integrations/custom`
- **Rate Monitoring:** `/monitoring/rate-limits`
- **Voice Control:** Available on all pages (floating panel)
- **Offline Indicator:** Bottom-right corner (appears when offline)

## 🎯 Example Voice Commands

| Command | Action |
|---------|--------|
| "Show me project X status" | Navigate to project X |
| "Create alert for budget overruns" | Open alert creation form |
| "Generate weekly report" | Create weekly report |
| "Go to analytics" | Navigate to analytics page |
| "Show dashboard overview" | Display main dashboard |
| "Filter projects by priority" | Apply priority filter |

## 🔧 Troubleshooting

### Voice Control Not Working?
- ✅ Ensure microphone permissions granted
- ✅ Use Chrome or Edge browser
- ✅ Check HTTPS connection (localhost is OK)

### Offline Mode Issues?
- ✅ Service Worker registered? Check DevTools → Application → Service Workers
- ✅ Check console for errors
- ✅ Clear cache and reload

### Rate Limiting Errors?
- ✅ Redis running? `redis-cli ping` should return "PONG"
- ✅ Check Redis connection in backend logs

### Backup Failed?
- ✅ Check BACKUP_ENCRYPTION_KEY is set
- ✅ Verify database connection
- ✅ Check disk space

## 📚 Documentation

For detailed documentation, see:
- **Full Implementation Guide:** `ENTERPRISE_FEATURES_IMPLEMENTATION.md`
- **API Reference:** Each feature has inline JSDoc comments
- **Component Usage:** Check component files for props and examples

## 🎉 You're Ready!

All five enterprise features are now active:
1. ✅ Data Backup & Point-in-Time Recovery
2. ✅ Custom Integration Builder
3. ✅ API Rate Limit Optimization
4. ✅ Offline Dashboard Mode
5. ✅ Voice-Activated Dashboard Control

Enjoy your enhanced Real-Time Pulse dashboard! 🚀
