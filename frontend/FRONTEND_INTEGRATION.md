# Frontend Enterprise Features Integration

Complete React/Next.js components for the Real-Time Pulse enterprise features.

## 📁 Files Added

### API Client
- **`src/lib/enterprise-api.ts`** - Complete TypeScript API client for all enterprise features
  - `exportApi` - PDF, CSV, Excel, and widget exports
  - `aiInsightsApi` - AI-powered insights management
  - `alertsApi` - Smart alerts with multi-channel notifications
  - `webhooksApi` - Webhook platform for real-time events

### UI Components
- **`src/components/dashboard/ExportButton.tsx`** - Export functionality components
  - `ExportButton` - Portal-level export dropdown
  - `WidgetExportButton` - Widget-level export dropdown
  
- **`src/components/dashboard/AIInsightsPanel.tsx`** - AI insights display
  - `AIInsightsPanel` - Main insights panel with generation
  - `InsightCard` - Individual insight display with actions
  
- **`src/components/dashboard/AlertsManager.tsx`** - Alert management system
  - `AlertsManager` - Full alert CRUD interface
  - `AlertCard` - Individual alert display
  - `AlertForm` - Create/edit alert form
  
- **`src/components/dashboard/WebhooksManager.tsx`** - Webhook management
  - `WebhooksManager` - Full webhook CRUD interface
  - `WebhookCard` - Individual webhook display
  - `WebhookDeliveries` - Delivery history viewer
  - `WebhookForm` - Create/edit webhook form

### Example Pages
- **`src/app/dashboard/enterprise/page.tsx`** - Complete integration example

## 🚀 Quick Start

### 1. Install Dependencies

Make sure you have all required UI components installed:

```bash
# Navigate to frontend directory
cd frontend

# If using shadcn/ui, install required components
npx shadcn-ui@latest add button card badge dialog input label textarea select switch
```

### 2. Configure API Client

Ensure your `src/lib/api.ts` exports `apiClient`:

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Use Components in Your App

#### Portal Dashboard

```tsx
import { ExportButton } from '@/components/dashboard/ExportButton';
import { AIInsightsPanel } from '@/components/dashboard/AIInsightsPanel';

export default function PortalPage({ portalId }: { portalId: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Portal Dashboard</h1>
        <ExportButton portalId={portalId} />
      </div>
      
      <AIInsightsPanel 
        portalId={portalId}
        workspaceId="workspace-id"
      />
      
      {/* Your portal widgets */}
    </div>
  );
}
```

#### Settings Page

```tsx
import { AlertsManager } from '@/components/dashboard/AlertsManager';
import { WebhooksManager } from '@/components/dashboard/WebhooksManager';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <AlertsManager />
      <WebhooksManager />
    </div>
  );
}
```

#### Widget Export

```tsx
import { WidgetExportButton } from '@/components/dashboard/ExportButton';

export default function Widget({ id, title, portalId }: WidgetProps) {
  return (
    <div className="widget">
      <div className="widget-header">
        <h3>{title}</h3>
        <WidgetExportButton 
          portalId={portalId}
          widgetId={id}
          widgetTitle={title}
        />
      </div>
      {/* Widget content */}
    </div>
  );
}
```

## 📊 Component Features

### Export System

**Features:**
- Multi-format exports (PDF, CSV, Excel)
- Portal-level and widget-level exports
- Loading states with toast notifications
- Automatic file downloads
- Error handling

**Usage:**
```tsx
<ExportButton portalId="portal-123" />
<WidgetExportButton 
  portalId="portal-123"
  widgetId="widget-456"
  widgetTitle="Revenue Chart"
/>
```

### AI Insights Panel

**Features:**
- Display all insights for a portal
- Generate new insights on demand
- Dismiss individual insights
- Mark insights as actioned
- Color-coded severity levels
- Icon-based insight types
- Loading and empty states

**Insight Types:**
- 🔺 Anomaly Detection
- 📈 Trend Analysis
- 💡 Recommendations
- 🎯 Performance Insights
- 🔮 Forecasts

**Usage:**
```tsx
<AIInsightsPanel 
  portalId="portal-123"
  workspaceId="workspace-456"
/>
```

### Alerts Manager

**Features:**
- Create, edit, delete alerts
- Multi-channel notifications (Email, Slack, Webhook)
- Condition builder (metric, operator, threshold)
- Test alerts functionality
- Enable/disable alerts
- Alert history tracking
- Email recipient management

**Alert Channels:**
- 📧 Email notifications
- 💬 Slack webhooks
- 🔗 Custom webhooks

**Usage:**
```tsx
<AlertsManager />
```

### Webhooks Manager

**Features:**
- Full webhook CRUD operations
- Event subscription management
- Secret key management with regeneration
- Test webhook functionality
- Delivery history viewer
- Enable/disable webhooks
- Success/failure tracking

**Available Events:**
- Portal events (created, updated, deleted, shared)
- Widget events (created, updated, deleted, data refreshed)
- Data events (source connected, sync completed, failed)
- User events (invited, role changed, removed)
- Alert events (triggered, resolved)
- Export events (completed, failed)

**Usage:**
```tsx
<WebhooksManager />
```

## 🔧 Direct API Usage

For custom integrations, use the API client directly:

```typescript
import { 
  exportApi, 
  aiInsightsApi, 
  alertsApi, 
  webhooksApi 
} from '@/lib/enterprise-api';

// Export portal as PDF
async function downloadPortalPDF(portalId: string) {
  const blob = await exportApi.exportPortalPDF(portalId);
  // Blob is automatically downloaded
}

// Generate AI insights
async function generateInsights(portalId: string) {
  const insights = await aiInsightsApi.generateInsights(portalId);
  console.log('Generated insights:', insights);
}

// Create alert
async function createBudgetAlert() {
  await alertsApi.createAlert({
    name: 'High Budget Alert',
    description: 'Alert when budget exceeds limit',
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
}

// Register webhook
async function registerWebhook() {
  await webhooksApi.createWebhook({
    name: 'Portal Updates Webhook',
    url: 'https://your-api.com/webhook',
    events: [
      'portal.created',
      'portal.updated',
      'widget.created',
      'data.sync.completed'
    ],
    description: 'Receives all portal and data events',
    isActive: true
  });
}
```

## 🎨 Styling

All components use:
- **shadcn/ui** - Base UI components
- **Tailwind CSS** - Utility classes
- **lucide-react** - Icons
- **sonner** - Toast notifications

### Color Scheme

```css
/* Severity levels */
.critical { @apply text-red-600 bg-red-50; }
.high { @apply text-orange-600 bg-orange-50; }
.medium { @apply text-yellow-600 bg-yellow-50; }
.low { @apply text-blue-600 bg-blue-50; }
.info { @apply text-gray-600 bg-gray-50; }

/* Status badges */
.active { @apply bg-green-500; }
.inactive { @apply bg-gray-400; }
.success { @apply bg-green-600; }
.failed { @apply bg-red-600; }
```

## 🔐 Authentication

All API calls automatically include JWT tokens from localStorage:

```typescript
// Token is automatically added via axios interceptor
const token = localStorage.getItem('token');
config.headers.Authorization = `Bearer ${token}`;
```

## 📱 Responsive Design

All components are mobile-responsive:
- Stacked layouts on small screens
- Horizontal layouts on desktop
- Touch-friendly buttons and controls
- Scrollable content areas

## ⚡ Performance

- Lazy loading of delivery history
- Optimistic UI updates
- Debounced form inputs
- Efficient re-rendering with React keys

## 🧪 Testing

Example test setup:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from '@/components/dashboard/ExportButton';

describe('ExportButton', () => {
  it('renders export options', () => {
    render(<ExportButton portalId="test-123" />);
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
  });
});
```

## 🐛 Troubleshooting

### "Failed to fetch" errors
- Ensure backend is running on correct port
- Check `NEXT_PUBLIC_API_URL` environment variable
- Verify CORS settings in backend

### Export downloads not working
- Check browser popup blockers
- Verify Content-Type headers in API response
- Ensure blob URLs are properly created

### Components not styled correctly
- Install all shadcn/ui dependencies
- Verify Tailwind CSS configuration
- Check that global styles are imported

### Webhook events not firing
- Ensure webhooks are active
- Check webhook URL is accessible
- Verify event names match backend constants

## 📖 Additional Resources

- **Backend API Documentation**: `/backend-nest/API_REFERENCE.md`
- **Feature Guide**: `/backend-nest/FEATURES_GUIDE.md`
- **Quick Start**: `/backend-nest/QUICK_START.md`
- **Setup Checklist**: `/backend-nest/SETUP_CHECKLIST.md`

## 🆘 Support

For issues or questions:
1. Check backend logs for API errors
2. Review browser console for client errors
3. Verify database migrations are up to date
4. Ensure all environment variables are set

## 📝 Next Steps

1. Customize component styling to match your brand
2. Add additional export formats (JSON, XML)
3. Implement scheduled reports UI
4. Add public share links interface
5. Build comments/collaboration system
6. Extend webhook event types
7. Add real-time notifications via WebSockets

---

**Need Help?** Check the example page at `src/app/dashboard/enterprise/page.tsx` for complete integration examples.
