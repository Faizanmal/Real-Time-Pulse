# 🚀 Quick Reference - Enterprise Features

## Frontend Components Cheat Sheet

### 📤 Export System

```tsx
// Portal-level export
import { ExportButton } from '@/components/dashboard/ExportButton';
<ExportButton portalId="portal-123" />

// Widget-level export
import { WidgetExportButton } from '@/components/dashboard/ExportButton';
<WidgetExportButton 
  portalId="portal-123"
  widgetId="widget-456"
  widgetTitle="Revenue Chart"
/>

// Direct API usage
import { exportApi } from '@/lib/enterprise-api';
const blob = await exportApi.exportPortalPDF(portalId);
const blob = await exportApi.exportPortalCSV(portalId);
const blob = await exportApi.exportPortalExcel(portalId);
const blob = await exportApi.exportWidget(portalId, widgetId);
```

### 🤖 AI Insights

```tsx
// Display insights panel
import { AIInsightsPanel } from '@/components/dashboard/AIInsightsPanel';
<AIInsightsPanel 
  portalId="portal-123"
  workspaceId="workspace-456"
/>

// Direct API usage
import { aiInsightsApi } from '@/lib/enterprise-api';
const insights = await aiInsightsApi.getPortalInsights(portalId);
const insights = await aiInsightsApi.getWorkspaceInsights(workspaceId);
await aiInsightsApi.generateInsights(portalId);
await aiInsightsApi.dismissInsight(insightId);
await aiInsightsApi.actionInsight(insightId);
```

### 🔔 Alerts System

```tsx
// Display alerts manager
import { AlertsManager } from '@/components/dashboard/AlertsManager';
<AlertsManager />

// Direct API usage
import { alertsApi } from '@/lib/enterprise-api';

// Create alert
await alertsApi.createAlert({
  name: 'High Budget Alert',
  description: 'Notify when budget exceeds $10k',
  condition: {
    metric: 'totalBudget',
    operator: '>',
    threshold: 10000
  },
  channels: ['email', 'slack'],
  emailRecipients: ['team@company.com'],
  slackWebhook: 'https://hooks.slack.com/services/...',
  isActive: true
});

// Manage alerts
const alerts = await alertsApi.getAllAlerts();
const alert = await alertsApi.getAlert(alertId);
await alertsApi.updateAlert(alertId, { isActive: false });
await alertsApi.deleteAlert(alertId);
await alertsApi.testAlert(alertId);
const history = await alertsApi.getAlertHistory(alertId);
```

### 🔌 Webhooks Platform

```tsx
// Display webhooks manager
import { WebhooksManager } from '@/components/dashboard/WebhooksManager';
<WebhooksManager />

// Direct API usage
import { webhooksApi, WEBHOOK_EVENTS } from '@/lib/enterprise-api';

// Create webhook
await webhooksApi.createWebhook({
  name: 'Portal Updates',
  url: 'https://your-api.com/webhook',
  events: [
    'portal.created',
    'portal.updated',
    'widget.created',
    'data.sync.completed'
  ],
  description: 'Receives all portal events',
  isActive: true
});

// Manage webhooks
const webhooks = await webhooksApi.getAllWebhooks();
const webhook = await webhooksApi.getWebhook(webhookId);
await webhooksApi.updateWebhook(webhookId, { isActive: false });
await webhooksApi.deleteWebhook(webhookId);
await webhooksApi.testWebhook(webhookId);
const deliveries = await webhooksApi.getDeliveries(webhookId);
const result = await webhooksApi.regenerateSecret(webhookId);

// Available events
console.log(WEBHOOK_EVENTS);
/*
[
  'portal.created', 'portal.updated', 'portal.deleted', 'portal.shared',
  'widget.created', 'widget.updated', 'widget.deleted', 'widget.data_refreshed',
  'data.source_connected', 'data.sync_completed', 'data.sync_failed',
  'user.invited', 'user.role_changed', 'user.removed',
  'alert.triggered', 'alert.resolved',
  'export.completed', 'export.failed'
]
*/
```

## Backend API Endpoints

### Export System
```
GET  /api/exports/portal/:portalId/pdf         # Export portal as PDF
GET  /api/exports/portal/:portalId/csv         # Export portal as CSV
GET  /api/exports/portal/:portalId/excel       # Export portal as Excel
POST /api/exports/widget                       # Export widget data
```

### AI Insights
```
GET  /api/ai-insights/portal/:portalId         # Get portal insights
GET  /api/ai-insights/workspace/:workspaceId   # Get workspace insights
POST /api/ai-insights/generate/:portalId       # Generate new insights
POST /api/ai-insights/:insightId/dismiss       # Dismiss insight
POST /api/ai-insights/:insightId/action        # Mark as actioned
```

### Alerts
```
POST   /api/alerts                   # Create alert
GET    /api/alerts                   # List all alerts
GET    /api/alerts/:id               # Get alert details
PUT    /api/alerts/:id               # Update alert
DELETE /api/alerts/:id               # Delete alert
POST   /api/alerts/:id/test          # Test alert
GET    /api/alerts/:id/history       # Get alert history
```

### Webhooks
```
POST   /api/webhooks                    # Create webhook
GET    /api/webhooks                    # List all webhooks
GET    /api/webhooks/:id                # Get webhook details
PUT    /api/webhooks/:id                # Update webhook
DELETE /api/webhooks/:id                # Delete webhook
GET    /api/webhooks/:id/deliveries     # Get delivery history
POST   /api/webhooks/:id/test           # Test webhook
POST   /api/webhooks/:id/regenerate     # Regenerate secret
```

## TypeScript Types

### Export Types
```typescript
interface ExportWidgetDto {
  portalId: string;
  widgetId: string;
  format: 'csv' | 'json';
}
```

### AI Insights Types
```typescript
interface AIInsight {
  id: string;
  portalId?: string;
  workspaceId?: string;
  type: 'ANOMALY' | 'TREND' | 'RECOMMENDATION' | 'PERFORMANCE' | 'FORECAST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO';
  title: string;
  description: string;
  recommendations?: string[];
  status: 'NEW' | 'DISMISSED' | 'ACTIONED';
  createdAt: string;
}
```

### Alert Types
```typescript
interface Alert {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  condition: {
    metric: string;
    operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
    threshold: number;
  };
  channels: ('email' | 'slack' | 'webhook')[];
  emailRecipients?: string[];
  slackWebhook?: string;
  webhookUrl?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
}

interface CreateAlertDto {
  name: string;
  description?: string;
  condition: {
    metric: string;
    operator: string;
    threshold: number;
  };
  channels: string[];
  emailRecipients?: string[];
  slackWebhook?: string;
  webhookUrl?: string;
  isActive?: boolean;
}
```

### Webhook Types
```typescript
interface Webhook {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  description?: string;
  isActive: boolean;
  lastDeliveryAt?: string;
  successCount: number;
  failureCount: number;
}

interface CreateWebhookDto {
  name: string;
  url: string;
  events: string[];
  description?: string;
  isActive?: boolean;
}
```

## Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Redis (for jobs)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# Email (for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password

# AWS S3 (optional, for exports)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Quick Setup Commands

### Backend Setup
```bash
cd backend-nest

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Start development server
npm run start:dev
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with API URL

# Start development server
npm run dev
```

### Docker Setup (Fastest)
```bash
cd backend-nest
docker-compose up -d
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

## Testing Webhooks

### Using curl
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/unique-id",
    "events": ["portal.created", "portal.updated"]
  }'

# Test alert
curl -X POST http://localhost:3000/api/alerts/ALERT_ID/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Webhook Signature Verification
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === hash;
}

// Usage in your webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook event
  console.log('Webhook event:', req.body);
  res.json({ received: true });
});
```

## Common Patterns

### Loading States
```tsx
const [loading, setLoading] = useState(false);

const handleExport = async () => {
  setLoading(true);
  try {
    await exportApi.exportPortalPDF(portalId);
    toast.success('Export complete!');
  } catch (error) {
    toast.error('Export failed');
  } finally {
    setLoading(false);
  }
};
```

### Error Handling
```tsx
try {
  await alertsApi.createAlert(data);
  toast.success('Alert created');
} catch (error: any) {
  const message = error.response?.data?.message || 'Failed to create alert';
  toast.error(message);
}
```

### Real-time Updates
```tsx
useEffect(() => {
  const interval = setInterval(async () => {
    const insights = await aiInsightsApi.getPortalInsights(portalId);
    setInsights(insights);
  }, 30000); // Refresh every 30s

  return () => clearInterval(interval);
}, [portalId]);
```

## Troubleshooting

### Common Issues

**"Failed to fetch"**
- Verify backend is running: `curl http://localhost:3000/api/health`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings in backend

**Export not downloading**
- Check browser console for errors
- Verify Content-Type headers
- Check popup blocker settings

**Webhooks not firing**
- Ensure webhook is active
- Check delivery history for errors
- Verify URL is accessible
- Test with webhook.site

**Alerts not sending**
- Check email configuration in backend `.env`
- Verify alert is active
- Test alert manually via UI or API
- Check alert history for errors

## Resources

- **Backend Docs**: `/backend-nest/FEATURES_GUIDE.md`
- **API Reference**: `/backend-nest/API_REFERENCE.md`
- **Frontend Guide**: `/frontend/FRONTEND_INTEGRATION.md`
- **Quick Start**: `/backend-nest/QUICK_START.md`

---

**Need help?** Check the example dashboard at `frontend/src/app/dashboard/enterprise/page.tsx`
