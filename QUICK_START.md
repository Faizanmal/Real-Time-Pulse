# 📋 Quick Start Guide

## 🎯 You're Here → Get Started in 3 Steps

### Step 1️⃣: Install Dependencies (2 minutes)

**Windows Users (Easiest):**
```cmd
cd backend-nest
quick-setup.bat
```

**PowerShell Users:**
```powershell
cd backend-nest
powershell -ExecutionPolicy Bypass -File install-features.ps1
```

**Manual Installation:**
```bash
cd backend-nest
npm install
npx prisma generate
npx prisma migrate dev --name add_enterprise_features
```

---

### Step 2️⃣: Configure Environment (1 minute)

Check your `.env` file has these essentials:

```bash
# ✅ Required
DATABASE_URL="postgresql://user:pass@localhost:5432/portal"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key

# ✅ For Email Alerts
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# 💡 Optional (for enhanced features)
OPENAI_API_KEY=sk-...
```

---

### Step 3️⃣: Start & Test (1 minute)

```bash
# Start the server
npm run start:dev

# Visit Swagger UI
# Open: http://localhost:3000/api/docs
```

---

## ✅ Verify Installation

Open http://localhost:3000/api/docs and look for these sections:

- ✅ **Exports** - Should show 4 endpoints
- ✅ **AI Insights** - Should show 5 endpoints
- ✅ **Alerts** - Should show 7 endpoints
- ✅ **Webhooks** - Should show 8 endpoints

---

## 🧪 Test Each Feature (5 minutes)

### 1. Test Export System

**In Swagger UI:**
1. Expand `Exports` section
2. Click `GET /exports/portal/{id}/pdf`
3. Click "Try it out"
4. Enter a portal ID
5. Click "Execute"
6. Download the PDF

**Via cURL:**
```bash
curl -X GET "http://localhost:3000/api/exports/portal/YOUR_ID/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o test.pdf
```

✅ **Success:** PDF file downloaded

---

### 2. Test AI Insights

**In Swagger UI:**
1. Expand `AI Insights` section
2. Click `POST /ai-insights/portal/{portalId}/generate`
3. Click "Try it out"
4. Enter a portal ID
5. Click "Execute"
6. Check response for generated insights

**Via cURL:**
```bash
curl -X POST "http://localhost:3000/api/ai-insights/portal/YOUR_ID/generate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

✅ **Success:** JSON with insights array returned

---

### 3. Test Alerts

**In Swagger UI:**
1. Expand `Alerts` section
2. Click `POST /alerts`
3. Click "Try it out"
4. Use this JSON:
```json
{
  "name": "Test Alert",
  "condition": {
    "metric": "testValue",
    "operator": ">",
    "threshold": 100
  },
  "channels": ["email"],
  "emailRecipients": ["your-email@example.com"]
}
```
5. Click "Execute"
6. Note the alert ID returned

**Test the Alert:**
1. Click `POST /alerts/{id}/test`
2. Enter the alert ID
3. Click "Execute"
4. Check your email

✅ **Success:** Alert created and test email received

---

### 4. Test Webhooks

**Setup webhook.site first:**
1. Visit https://webhook.site
2. Copy your unique URL

**In Swagger UI:**
1. Expand `Webhooks` section
2. Click `POST /webhooks`
3. Use this JSON:
```json
{
  "name": "Test Webhook",
  "url": "https://webhook.site/your-unique-url",
  "events": ["portal.created", "portal.updated"]
}
```
4. Click "Execute"
5. Note the webhook ID

**Test the Webhook:**
1. Click `POST /webhooks/{id}/test`
2. Enter the webhook ID
3. Click "Execute"
4. Check webhook.site for the received payload

✅ **Success:** Webhook created and test payload received

---

## 📚 Next: Deep Dive Documentation

Now that everything works, explore the features:

| Read This | To Learn |
|-----------|----------|
| **[FEATURES_GUIDE.md](FEATURES_GUIDE.md)** | Complete feature documentation with examples |
| **[API_REFERENCE.md](API_REFERENCE.md)** | Quick API reference for all endpoints |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | Technical details of what was built |

---

## 🎨 Frontend Integration Ideas

### Export Button Component
```typescript
// Add to your portal view
<button onClick={() => exportPortal('pdf')}>
  Export PDF
</button>
```

### AI Insights Panel
```typescript
// Display insights on dashboard
<InsightsPanel portalId={portalId} />
```

### Alert Management UI
```typescript
// Alert configuration page
<AlertManager workspaceId={workspaceId} />
```

### Webhook Dashboard
```typescript
// Webhook monitoring
<WebhookDeliveries webhookId={webhookId} />
```

---

## 🐛 Common Issues & Fixes

### ❌ "Cannot find module 'pdfkit'"
**Fix:**
```bash
npm install pdfkit exceljs @types/pdfkit
```

### ❌ "Prisma Client Not Found"
**Fix:**
```bash
npx prisma generate
```

### ❌ "Migration failed"
**Fix:**
```bash
# Reset and migrate (WARNING: Deletes data)
npx prisma migrate reset
npx prisma migrate dev
```

### ❌ "Email alerts not sending"
**Fix:**
1. Check EMAIL_* variables in .env
2. For Gmail, use App Password (not regular password)
3. Test with: `POST /alerts/{id}/test`

### ❌ "Webhooks not delivering"
**Fix:**
1. Check URL is accessible
2. View delivery logs: `GET /webhooks/{id}/deliveries`
3. Check webhook status is `ACTIVE`

---

## 🎯 Success Checklist

- [ ] Server starts without errors
- [ ] Swagger UI shows new sections
- [ ] PDF export works
- [ ] AI insights generate
- [ ] Test alert sends email
- [ ] Test webhook delivers payload
- [ ] All documentation reviewed

---

## 🚀 Production Ready?

Before deploying:

### Must Have:
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS enabled
- [ ] Backups configured

### Should Have:
- [ ] Monitoring setup (New Relic, DataDog)
- [ ] Error tracking (Sentry)
- [ ] Log aggregation (CloudWatch, ELK)
- [ ] Load balancing configured

### Nice to Have:
- [ ] CDN for exports (CloudFront, Cloudflare)
- [ ] Redis clustering
- [ ] Database read replicas
- [ ] Webhook retry queue (BullMQ)

---

## 💪 You're Ready!

✅ **Installation Complete**
✅ **Features Tested**
✅ **Documentation Available**

**Start building amazing client dashboards with enterprise features!** 🎉

---

## 📞 Need Help?

1. **Check Swagger:** http://localhost:3000/api/docs
2. **Review Logs:** Check terminal output
3. **Read Docs:** FEATURES_GUIDE.md has detailed examples
4. **Debug Database:** Use `npx prisma studio`

---

**Happy Coding!** 🚀
