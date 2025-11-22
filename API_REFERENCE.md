# 📚 API Quick Reference - New Features

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints require JWT Bearer token:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📤 Export Endpoints

### Export Portal to PDF
```http
GET /exports/portal/:portalId/pdf
```

**Response:** Binary PDF file

**Example:**
```bash
curl -X GET "http://localhost:3000/api/exports/portal/abc123/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o report.pdf
```

---

### Export Portal to CSV
```http
GET /exports/portal/:portalId/csv
```

**Response:** CSV file with widget data

---

### Export Portal to Excel
```http
GET /exports/portal/:portalId/excel
```

**Response:** Excel workbook with multiple sheets

---

### Export Widget Data
```http
GET /exports/widget/:widgetId/:format
```

**Params:**
- `format`: `csv` | `json` | `excel`

---

## 🤖 AI Insights Endpoints

### Get Workspace Insights
```http
GET /ai-insights?status=NEW&type=ANOMALY
```

**Query Params:**
- `status` (optional): `NEW` | `VIEWED` | `ACTIONED` | `DISMISSED`
- `type` (optional): `ANOMALY` | `TREND` | `PREDICTION` | `RECOMMENDATION` | `SUMMARY`

**Response:**
```json
[
  {
    "id": "insight-id",
    "type": "ANOMALY",
    "title": "Stale Widget Data Detected",
    "description": "3 widgets haven't refreshed in 24+ hours",
    "severity": "MEDIUM",
    "confidence": 0.95,
    "status": "NEW",
    "data": {
      "affectedWidgets": [...]
    },
    "recommendations": {
      "actions": ["Check integration status", "Verify refresh intervals"]
    },
    "createdAt": "2025-11-20T10:00:00Z"
  }
]
```

---

### Get Portal Insights
```http
GET /ai-insights/portal/:portalId
```

**Response:** Array of insights for specific portal

---

### Generate New Insights
```http
POST /ai-insights/portal/:portalId/generate
```

**Response:**
```json
{
  "generated": 3,
  "insights": [...]
}
```

---

### Dismiss Insight
```http
PATCH /ai-insights/:insightId/dismiss
```

**Response:** Updated insight object

---

### Mark Insight as Actioned
```http
PATCH /ai-insights/:insightId/action
```

---

## 🚨 Alert Endpoints

### Create Alert
```http
POST /alerts
```

**Request Body:**
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
  "slackWebhook": "https://hooks.slack.com/services/...",
  "webhookUrl": "https://yourapi.com/webhook",
  "isActive": true
}
```

**Response:**
```json
{
  "id": "alert-id",
  "name": "High Budget Alert",
  "condition": {...},
  "channels": ["email", "slack"],
  "isActive": true,
  "lastTriggeredAt": null,
  "triggerCount": 0,
  "createdAt": "2025-11-20T10:00:00Z"
}
```

---

### Get All Alerts
```http
GET /alerts
```

**Response:** Array of all workspace alerts

---

### Get Alert Details
```http
GET /alerts/:alertId
```

**Response:** Alert object with history

---

### Update Alert
```http
PATCH /alerts/:alertId
```

**Request Body:** Partial alert object

---

### Delete Alert
```http
DELETE /alerts/:alertId
```

**Response:** 204 No Content

---

### Get Alert History
```http
GET /alerts/:alertId/history
```

**Response:**
```json
[
  {
    "id": "history-id",
    "alertId": "alert-id",
    "triggeredValue": {"budgetUsage": 0.85},
    "condition": {...},
    "notificationsSent": {
      "email": true,
      "slack": true,
      "webhook": false
    },
    "triggeredAt": "2025-11-20T15:30:00Z"
  }
]
```

---

### Test Alert
```http
POST /alerts/:alertId/test
```

**Response:**
```json
{
  "message": "Test alert sent successfully"
}
```

---

## 🔌 Webhook Endpoints

### Create Webhook
```http
POST /webhooks
```

**Request Body:**
```json
{
  "name": "Portal Updates Webhook",
  "url": "https://yourapi.com/webhooks/portal-updates",
  "events": [
    "portal.created",
    "portal.updated",
    "widget.added",
    "widget.updated"
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

**Response:**
```json
{
  "id": "webhook-id",
  "name": "Portal Updates Webhook",
  "url": "https://yourapi.com/webhooks/portal-updates",
  "secret": "webhook_secret_key",
  "events": ["portal.created", "portal.updated"],
  "isActive": true,
  "createdAt": "2025-11-20T10:00:00Z"
}
```

---

### Get All Webhooks
```http
GET /webhooks
```

**Response:** Array of all workspace webhooks

---

### Get Webhook Details
```http
GET /webhooks/:webhookId
```

**Response:** Webhook object with recent deliveries

---

### Update Webhook
```http
PATCH /webhooks/:webhookId
```

**Request Body:** Partial webhook object

---

### Delete Webhook
```http
DELETE /webhooks/:webhookId
```

**Response:** 204 No Content

---

### Get Webhook Deliveries
```http
GET /webhooks/:webhookId/deliveries
```

**Response:**
```json
[
  {
    "id": "delivery-id",
    "webhookId": "webhook-id",
    "event": "portal.created",
    "payload": {...},
    "status": "SUCCESS",
    "responseCode": 200,
    "responseBody": "OK",
    "responseTime": 245,
    "attempts": 1,
    "createdAt": "2025-11-20T10:00:00Z",
    "lastAttemptAt": "2025-11-20T10:00:00Z"
  }
]
```

---

### Test Webhook
```http
POST /webhooks/:webhookId/test
```

**Response:**
```json
{
  "message": "Test webhook triggered successfully"
}
```

---

### Regenerate Webhook Secret
```http
POST /webhooks/:webhookId/regenerate-secret
```

**Response:** Webhook object with new secret

---

## 📨 Webhook Payload Structure

When a webhook is triggered, it sends a POST request with:

### Headers
```
Content-Type: application/json
X-Webhook-Signature: hmac_sha256_signature
X-Webhook-Timestamp: 1700479800000
X-Webhook-Event: portal.created
```

### Body
```json
{
  "event": "portal.created",
  "timestamp": "2025-11-20T10:00:00Z",
  "workspaceId": "workspace-id",
  "data": {
    "portal": {
      "id": "portal-id",
      "name": "Client Dashboard",
      "slug": "client-dashboard",
      "createdAt": "2025-11-20T10:00:00Z"
    }
  }
}
```

### Signature Verification (Node.js)
```javascript
const crypto = require('crypto');

const signature = req.headers['x-webhook-signature'];
const timestamp = req.headers['x-webhook-timestamp'];
const payload = JSON.stringify(req.body);
const secret = 'your-webhook-secret';

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

if (signature === expectedSignature) {
  // Signature is valid
}
```

---

## 🎯 Available Webhook Events

### Portal Events
- `portal.created` - Portal created
- `portal.updated` - Portal updated
- `portal.deleted` - Portal deleted

### Widget Events
- `widget.added` - Widget added to portal
- `widget.updated` - Widget updated
- `widget.deleted` - Widget deleted

### Integration Events
- `integration.connected` - Integration connected
- `integration.synced` - Integration data synced
- `integration.failed` - Integration sync failed

### Alert Events
- `alert.triggered` - Alert condition met

### Report Events
- `report.generated` - Scheduled report generated

---

## 🔒 Security Notes

### Rate Limiting
All endpoints are rate-limited to 100 requests per minute per IP.

### Webhook Signatures
Always verify webhook signatures to prevent spoofing attacks.

### API Keys
Store API keys securely and never commit them to version control.

---

## 📊 Response Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no response body
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## 🧪 Testing with cURL

### Create an Alert
```bash
curl -X POST "http://localhost:3000/api/alerts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alert",
    "condition": {
      "metric": "value",
      "operator": ">",
      "threshold": 100
    },
    "channels": ["email"],
    "emailRecipients": ["test@example.com"]
  }'
```

### Export Portal to PDF
```bash
curl -X GET "http://localhost:3000/api/exports/portal/YOUR_PORTAL_ID/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o portal-report.pdf
```

### Generate AI Insights
```bash
curl -X POST "http://localhost:3000/api/ai-insights/portal/YOUR_PORTAL_ID/generate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📖 Full Documentation

For complete API documentation, start the server and visit:
```
http://localhost:3000/api/docs
```

This provides an interactive Swagger UI with all endpoints, schemas, and examples.
