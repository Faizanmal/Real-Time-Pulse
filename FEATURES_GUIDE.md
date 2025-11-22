# 🚀 New Features Implementation Guide

This document outlines the newly implemented enterprise features for Real-Time Pulse.

## 📦 Implemented Features

### ✅ 1. Export Functionality
**Module:** `src/exports/`

Export portal and widget data in multiple formats for reporting and analysis.

#### Features:
- **PDF Export**: Generate professionally formatted PDF reports of portals
- **CSV Export**: Export widget data for spreadsheet analysis
- **Excel Export**: Rich Excel workbooks with multiple sheets
- **Widget Export**: Export individual widget data in JSON, CSV, or Excel

#### API Endpoints:
```typescript
GET /exports/portal/:id/pdf       // Export portal to PDF
GET /exports/portal/:id/csv       // Export portal to CSV
GET /exports/portal/:id/excel     // Export portal to Excel
GET /exports/widget/:id/:format   // Export widget (csv|json|excel)
```

#### Usage Example:
```typescript
// Frontend: Download portal as PDF
const response = await fetch('/api/exports/portal/abc123/pdf', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'portal-report.pdf';
a.click();
```

---

### ✅ 2. AI-Powered Insights
**Module:** `src/ai-insights/`

Automatically generate intelligent insights from portal and widget data.

#### Features:
- **Anomaly Detection**: Identify unusual patterns (stale data, sync failures)
- **Trend Analysis**: Spot usage patterns and growth opportunities
- **Recommendations**: Actionable suggestions for improvement
- **Predictive Analytics**: (Placeholder for ML model integration)

#### Insight Types:
- `ANOMALY` - Unusual patterns detected
- `TREND` - Usage pattern analysis
- `PREDICTION` - Future projections
- `RECOMMENDATION` - Actionable suggestions
- `SUMMARY` - Executive summaries

#### API Endpoints:
```typescript
GET    /ai-insights                        // Get workspace insights
GET    /ai-insights/portal/:portalId      // Get portal-specific insights
POST   /ai-insights/portal/:portalId/generate  // Generate new insights
PATCH  /ai-insights/:id/dismiss           // Dismiss insight
PATCH  /ai-insights/:id/action            // Mark as actioned
```

#### Usage Example:
```typescript
// Generate insights for a portal
const insights = await fetch('/api/ai-insights/portal/abc123/generate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Response:
{
  "generated": 3,
  "insights": [
    {
      "type": "ANOMALY",
      "title": "Stale Widget Data Detected",
      "severity": "MEDIUM",
      "confidence": 0.95,
      "recommendations": {
        "actions": [
          "Check integration connection status",
          "Verify widget refresh intervals"
        ]
      }
    }
  ]
}
```

---

### ✅ 3. Smart Alerts System
**Module:** `src/alerts/`

Create threshold-based alerts with multi-channel notifications.

#### Features:
- **Condition-Based Triggers**: Set custom thresholds and operators
- **Multi-Channel Notifications**: Email, Slack, Webhooks
- **Alert History**: Track all alert triggers
- **Test Mode**: Test alert configuration before deploying

#### Supported Operators:
- `>`, `>=`, `<`, `<=`, `==`, `!=`

#### API Endpoints:
```typescript
POST   /alerts              // Create alert
GET    /alerts              // Get all alerts
GET    /alerts/:id          // Get alert details
PATCH  /alerts/:id          // Update alert
DELETE /alerts/:id          // Delete alert
GET    /alerts/:id/history  // Get trigger history
POST   /alerts/:id/test     // Test alert
```

#### Alert Configuration Example:
```json
{
  "name": "High Budget Alert",
  "description": "Notify when budget exceeds 80%",
  "portalId": "portal-id",
  "widgetId": "widget-id",
  "condition": {
    "metric": "budgetUsage",
    "operator": ">",
    "threshold": 0.8
  },
  "channels": ["email", "slack", "webhook"],
  "emailRecipients": ["team@example.com"],
  "slackWebhook": "https://hooks.slack.com/...",
  "webhookUrl": "https://yourapi.com/webhook",
  "isActive": true
}
```

#### Slack Notification Format:
```json
{
  "text": "🚨 Alert Triggered: High Budget Alert",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🚨 High Budget Alert" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Description:*\nNotify when budget exceeds 80%" },
        { "type": "mrkdwn", "text": "*Value:*\n{\"budgetUsage\": 0.85}" }
      ]
    }
  ]
}
```

---

### ✅ 4. Webhooks Platform
**Module:** `src/webhooks/`

Build integrations with external systems using webhooks.

#### Features:
- **Event Subscriptions**: Subscribe to specific events
- **Automatic Retries**: Configurable retry logic
- **Signature Verification**: HMAC-SHA256 signatures
- **Delivery History**: Track all webhook deliveries
- **Custom Headers**: Add authentication headers

#### Available Events:
```typescript
// Portal events
'portal.created'
'portal.updated'
'portal.deleted'

// Widget events
'widget.added'
'widget.updated'
'widget.deleted'

// Integration events
'integration.connected'
'integration.synced'
'integration.failed'

// Alert events
'alert.triggered'

// Report events
'report.generated'
```

#### API Endpoints:
```typescript
POST   /webhooks                    // Create webhook
GET    /webhooks                    // Get all webhooks
GET    /webhooks/:id                // Get webhook details
PATCH  /webhooks/:id                // Update webhook
DELETE /webhooks/:id                // Delete webhook
GET    /webhooks/:id/deliveries     // Get delivery history
POST   /webhooks/:id/test           // Test webhook
POST   /webhooks/:id/regenerate-secret  // Regenerate secret
```

#### Webhook Configuration Example:
```json
{
  "name": "Portal Updates",
  "url": "https://yourapi.com/webhooks/portal-updates",
  "events": [
    "portal.created",
    "portal.updated",
    "widget.added"
  ],
  "headers": {
    "X-API-Key": "your-api-key"
  },
  "maxRetries": 3,
  "retryDelay": 60,
  "timeoutSeconds": 30,
  "isActive": true
}
```

#### Webhook Payload Structure:
```json
{
  "event": "portal.created",
  "timestamp": "2025-11-20T10:30:00Z",
  "workspaceId": "workspace-id",
  "data": {
    "portal": {
      "id": "portal-id",
      "name": "Client Dashboard",
      "slug": "client-dashboard",
      "createdAt": "2025-11-20T10:30:00Z"
    }
  }
}
```

#### Webhook Signature Verification:
```typescript
// Headers sent with webhook:
X-Webhook-Signature: hmac_sha256_signature
X-Webhook-Timestamp: 1700479800000
X-Webhook-Event: portal.created

// Verify signature (Node.js):
const crypto = require('crypto');
const signature = request.headers['x-webhook-signature'];
const timestamp = request.headers['x-webhook-timestamp'];
const payload = JSON.stringify(request.body);
const secret = 'your-webhook-secret';

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

if (signature === expectedSignature) {
  // Signature valid
}
```

---

## 🗄️ Database Schema Updates

New tables added to Prisma schema:

### Core Tables:
- `ShareLink` - Public portal sharing with access control
- `Alert` - Alert configurations
- `AlertHistory` - Alert trigger history
- `ScheduledReport` - Automated report scheduling
- `ReportRun` - Report execution tracking
- `Webhook` - Webhook configurations
- `WebhookDelivery` - Webhook delivery tracking
- `Comment` - Collaboration comments
- `AIInsight` - AI-generated insights

### Run Migrations:
```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_new_features

# Apply migration to production
npx prisma migrate deploy
```

---

## 📦 Installation

### 1. Install Dependencies:
```bash
cd backend-nest
npm install
```

### New dependencies added:
- `pdfkit` - PDF generation
- `exceljs` - Excel file generation
- `@types/pdfkit` - TypeScript types

### 2. Update Database:
```bash
npx prisma generate
npx prisma migrate dev --name add_new_features
```

### 3. Environment Variables:
Add to your `.env`:
```bash
# AI/ML Service (optional - for advanced insights)
OPENAI_API_KEY=your-openai-key
# or
ANTHROPIC_API_KEY=your-claude-key

# Webhook Configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=60
WEBHOOK_TIMEOUT=30
```

---

## 🧪 Testing

### Test Export Functionality:
```bash
curl -X GET http://localhost:3000/api/exports/portal/abc123/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o portal.pdf
```

### Test AI Insights:
```bash
curl -X POST http://localhost:3000/api/ai-insights/portal/abc123/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Test Alerts:
```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alert",
    "condition": {"metric": "value", "operator": ">", "threshold": 100},
    "channels": ["email"],
    "emailRecipients": ["test@example.com"]
  }'
```

### Test Webhooks:
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/unique-url",
    "events": ["portal.created"]
  }'
```

---

## 📊 Frontend Integration Examples

### Export Button Component:
```typescript
// components/ExportButton.tsx
import { useState } from 'react';

export function ExportButton({ portalId, format = 'pdf' }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/exports/portal/${portalId}/${format}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portal-${portalId}.${format}`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={loading}>
      {loading ? 'Exporting...' : `Export ${format.toUpperCase()}`}
    </button>
  );
}
```

### AI Insights Display:
```typescript
// components/InsightsPanel.tsx
import { useEffect, useState } from 'react';

export function InsightsPanel({ portalId }) {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    fetch(`/api/ai-insights/portal/${portalId}`)
      .then(res => res.json())
      .then(setInsights);
  }, [portalId]);

  return (
    <div className="insights-panel">
      {insights.map(insight => (
        <div key={insight.id} className={`insight ${insight.severity}`}>
          <h3>{insight.title}</h3>
          <p>{insight.description}</p>
          {insight.recommendations && (
            <ul>
              {insight.recommendations.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          )}
          <button onClick={() => dismissInsight(insight.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔐 Security Considerations

### 1. Webhook Signature Verification:
Always verify webhook signatures to prevent spoofing:
```typescript
import crypto from 'crypto';

function verifyWebhook(signature, timestamp, payload, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 2. Rate Limiting:
All endpoints are protected by global rate limiting (100 req/min)

### 3. Access Control:
- All endpoints require JWT authentication
- Workspace isolation enforced at database level
- Share links can be password-protected and time-limited

---

## 🚀 Next Steps

### Still To Implement:
1. **Scheduled Reports Module** - Automated PDF/email reports
2. **Public Share Links UI** - Frontend for managing share links
3. **Comments System** - In-dashboard collaboration
4. **Extended Integrations** - Jira, Monday.com, HubSpot, GitHub, Stripe

### AI Enhancement Opportunities:
- Integrate OpenAI GPT-4 for natural language insights
- Add ML models for predictive analytics
- Implement anomaly detection algorithms
- Create custom recommendation engine

### Production Checklist:
- [ ] Set up monitoring for webhook deliveries
- [ ] Configure alert channels (Slack, PagerDuty)
- [ ] Implement webhook retry queue with BullMQ
- [ ] Add webhook delivery logs to S3 for compliance
- [ ] Set up AI model endpoints (OpenAI/Anthropic)
- [ ] Configure export file storage (S3/R2)
- [ ] Add rate limiting for export endpoints
- [ ] Implement export queue for large datasets

---

## 📝 API Documentation

Full API documentation available at: `http://localhost:3000/api/docs` (Swagger UI)

### Quick Links:
- Exports: `/api/docs#/Exports`
- AI Insights: `/api/docs#/AI%20Insights`
- Alerts: `/api/docs#/Alerts`
- Webhooks: `/api/docs#/Webhooks`

---

## 💡 Feature Highlights

### Export System
✅ Multiple formats (PDF, CSV, Excel)
✅ Streaming responses for large files
✅ Professional PDF formatting
✅ Excel with multiple sheets
✅ Widget-level exports

### AI Insights
✅ Automatic anomaly detection
✅ Trend identification
✅ Actionable recommendations
✅ Confidence scoring
✅ Insight dismissal/tracking

### Alerts
✅ Flexible condition system
✅ Multi-channel notifications
✅ Alert history tracking
✅ Test mode
✅ Automatic retry logic

### Webhooks
✅ Event-based subscriptions
✅ HMAC signature verification
✅ Automatic retries
✅ Delivery tracking
✅ Custom headers support

---

**Need help?** Check the API documentation or create an issue in the repository.
