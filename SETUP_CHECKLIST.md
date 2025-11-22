# ✅ Setup Checklist

Complete these steps to finalize the new features implementation.

## 📋 Pre-Installation

- [ ] Backup your database before running migrations
- [ ] Review the `.env` file and ensure all required variables are set
- [ ] Stop any running backend servers

## 🔧 Installation Steps

### 1. Install Dependencies
```bash
cd backend-nest
npm install
```
Expected output: `pdfkit`, `exceljs`, and `@types/pdfkit` installed

---

### 2. Generate Prisma Client
```bash
npx prisma generate
```
Expected output: Prisma Client generated successfully

---

### 3. Run Database Migrations
```bash
npx prisma migrate dev --name add_new_features
```
Expected output: 10 new tables created (ShareLink, Alert, AlertHistory, etc.)

**Note:** If you're in production, use:
```bash
npx prisma migrate deploy
```

---

### 4. Verify Installation
```bash
npm run start:dev
```
Expected output: Server starts without errors on port 3000

---

## ✅ Feature Verification

### Test Export System
```bash
# Terminal 1: Ensure server is running
npm run start:dev

# Terminal 2: Test PDF export
curl -X GET "http://localhost:3000/api/exports/portal/YOUR_PORTAL_ID/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o test-export.pdf
```
✅ Success: `test-export.pdf` downloaded successfully

---

### Test AI Insights
```bash
# Generate insights
curl -X POST "http://localhost:3000/api/ai-insights/portal/YOUR_PORTAL_ID/generate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```
✅ Success: JSON response with generated insights

---

### Test Alerts
```bash
# Create test alert
curl -X POST "http://localhost:3000/api/alerts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alert",
    "condition": {
      "metric": "testValue",
      "operator": ">",
      "threshold": 100
    },
    "channels": ["email"],
    "emailRecipients": ["your-email@example.com"]
  }'
```
✅ Success: Alert created with ID returned

---

### Test Webhooks
```bash
# Create test webhook (use https://webhook.site for testing)
curl -X POST "http://localhost:3000/api/webhooks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/your-unique-url",
    "events": ["portal.created", "portal.updated"]
  }'
```
✅ Success: Webhook created with secret returned

---

## 🔍 Swagger API Documentation

Visit: `http://localhost:3000/api/docs`

Verify these new sections appear:
- [ ] Exports
- [ ] AI Insights
- [ ] Alerts
- [ ] Webhooks

---

## 📊 Database Verification

Check that new tables exist:
```bash
npx prisma studio
```

Verify these tables:
- [ ] AIInsight
- [ ] Alert
- [ ] AlertHistory
- [ ] Comment
- [ ] ReportRun
- [ ] ScheduledReport
- [ ] ShareLink
- [ ] Webhook
- [ ] WebhookDelivery

---

## ⚙️ Optional Configuration

### For AI Insights Enhancement:
Add to `.env`:
```bash
# Optional: For enhanced AI insights
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### For Slack Alerts:
1. Create a Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Copy webhook URL (starts with https://hooks.slack.com/services/...)
4. Use in alert creation

### For Email Alerts:
Ensure these are set in `.env`:
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🧪 End-to-End Test Scenario

### Scenario: Complete Feature Test

1. **Create a Portal** (if you don't have one)
2. **Add Some Widgets** to the portal
3. **Generate AI Insights:**
   ```bash
   POST /ai-insights/portal/:id/generate
   ```
4. **Create an Alert:**
   ```bash
   POST /alerts
   # Set condition based on your widget data
   ```
5. **Create a Webhook:**
   ```bash
   POST /webhooks
   # Use webhook.site for testing
   ```
6. **Export the Portal:**
   ```bash
   GET /exports/portal/:id/pdf
   GET /exports/portal/:id/excel
   ```
7. **Trigger a Test Alert:**
   ```bash
   POST /alerts/:id/test
   # Check your email
   ```
8. **Trigger a Test Webhook:**
   ```bash
   POST /webhooks/:id/test
   # Check webhook.site
   ```

---

## 📚 Documentation Review

Ensure you've reviewed:
- [ ] `FEATURES_GUIDE.md` - Comprehensive feature documentation
- [ ] `API_REFERENCE.md` - Quick API reference
- [ ] `IMPLEMENTATION_SUMMARY.md` - What was implemented
- [ ] Updated `README.md` - Project overview with new features

---

## 🚨 Troubleshooting

### Issue: "Module not found" errors
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prisma errors
**Solution:**
```bash
npx prisma generate
npx prisma migrate reset  # WARNING: This will delete all data
npx prisma migrate dev
```

### Issue: PDF export fails
**Solution:** Ensure `pdfkit` is installed:
```bash
npm install pdfkit @types/pdfkit
```

### Issue: Excel export fails
**Solution:** Ensure `exceljs` is installed:
```bash
npm install exceljs
```

### Issue: Email alerts not sending
**Solution:** Check email configuration in `.env` and verify SMTP credentials

### Issue: Webhooks not delivering
**Solution:** 
1. Check webhook URL is accessible
2. Verify webhook secret is correct
3. Check webhook delivery logs: `GET /webhooks/:id/deliveries`

---

## ✅ Final Verification

Run this command to ensure everything works:
```bash
npm run start:dev
```

Visit:
- [ ] `http://localhost:3000/api/docs` - Swagger works
- [ ] `http://localhost:3000/health` - Health check passes
- [ ] All new endpoints respond correctly

---

## 🎯 Next Steps

After completing setup:

1. **Frontend Integration:**
   - Add export buttons to portal views
   - Display AI insights panel
   - Create alert management UI
   - Add webhook configuration page

2. **Additional Features:**
   - Implement scheduled reports
   - Add public share links UI
   - Build comments/collaboration system
   - Expand integrations (Jira, HubSpot, etc.)

3. **Production Preparation:**
   - Set up monitoring for webhooks
   - Configure alert channels
   - Add rate limiting for exports
   - Set up S3/R2 for file storage

---

## 📞 Need Help?

- Check `FEATURES_GUIDE.md` for detailed examples
- Check `API_REFERENCE.md` for quick reference
- Review error logs: Check console output
- Database issues: Use `npx prisma studio`

---

**Status:** 
- [ ] Installation Complete
- [ ] Features Tested
- [ ] Documentation Reviewed
- [ ] Ready for Development

Good luck! 🚀
