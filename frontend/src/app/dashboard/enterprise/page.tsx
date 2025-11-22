'use client';

import { ExportButton, WidgetExportButton } from '@/src/components/dashboard/ExportButton';
import { AIInsightsPanel } from '@/src/components/dashboard/AIInsightsPanel';
import { AlertsManager } from '@/src/components/dashboard/AlertsManager';
import { WebhooksManager } from '@/src/components/dashboard/WebhooksManager';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';

/**
 * Enterprise Features Dashboard
 * 
 * This page demonstrates the integration of all enterprise features:
 * - Export System (PDF, CSV, Excel)
 * - AI-Powered Insights
 * - Smart Alerts
 * - Webhooks Platform
 */
export default function EnterpriseDashboard() {
  // In a real app, these would come from your state management or API
  const portalId = 'portal-123';

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Enterprise Features</h1>
          <p className="text-gray-600">
            Manage exports, AI insights, alerts, and webhooks for your portals
          </p>
        </div>
        <Badge variant="default" className="bg-purple-600">
          Premium
        </Badge>
      </div>

      {/* Quick Actions Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <ExportButton portalId={portalId} />
          <WidgetExportButton 
            widgetId="widget-789" 
            widgetTitle="Revenue Chart"
          />
        </div>
      </Card>

      {/* AI Insights Section */}
      <AIInsightsPanel 
        portalId={portalId}
      />

      {/* Alerts Management Section */}
      <AlertsManager />

      {/* Webhooks Management Section */}
      <WebhooksManager />

      {/* Integration Examples */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Integration Guide</h2>
        <div className="prose prose-sm max-w-none">
          <h3 className="text-lg font-semibold">Using Enterprise Features</h3>
          
          <h4 className="font-semibold mt-4">1. Export System</h4>
          <p className="text-sm text-gray-600">
            Add export buttons to any portal or widget:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import { ExportButton, WidgetExportButton } from '@/components/dashboard/ExportButton';

// Portal-level export
<ExportButton portalId="your-portal-id" />

// Widget-level export
<WidgetExportButton 
  portalId="portal-id"
  widgetId="widget-id"
  widgetTitle="Chart Name"
/>`}
          </pre>

          <h4 className="font-semibold mt-4">2. AI Insights</h4>
          <p className="text-sm text-gray-600">
            Display AI-powered insights for any portal:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import { AIInsightsPanel } from '@/components/dashboard/AIInsightsPanel';

<AIInsightsPanel 
  portalId="your-portal-id"
  workspaceId="your-workspace-id"
/>`}
          </pre>

          <h4 className="font-semibold mt-4">3. Alerts</h4>
          <p className="text-sm text-gray-600">
            Manage alerts across your workspace:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import { AlertsManager } from '@/components/dashboard/AlertsManager';

<AlertsManager />`}
          </pre>

          <h4 className="font-semibold mt-4">4. Webhooks</h4>
          <p className="text-sm text-gray-600">
            Configure webhooks to receive real-time events:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import { WebhooksManager } from '@/components/dashboard/WebhooksManager';

<WebhooksManager />`}
          </pre>

          <h4 className="font-semibold mt-4">5. Direct API Usage</h4>
          <p className="text-sm text-gray-600">
            Use the enterprise API client directly for custom integrations:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import { 
  exportApi, 
  aiInsightsApi, 
  alertsApi, 
  webhooksApi 
} from '@/lib/enterprise-api';

// Generate and download PDF
const blob = await exportApi.exportPortalPDF(portalId);

// Get AI insights
const insights = await aiInsightsApi.getPortalInsights(portalId);

// Create an alert
await alertsApi.createAlert({
  name: 'High Budget Alert',
  condition: { metric: 'budget', operator: '>', threshold: 10000 },
  channels: ['email'],
  emailRecipients: ['team@company.com']
});

// Register a webhook
await webhooksApi.createWebhook({
  name: 'Portal Updates',
  url: 'https://your-api.com/webhook',
  events: ['portal.created', 'portal.updated']
});`}
          </pre>

          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">📚 Documentation</h4>
            <p className="text-sm text-blue-800">
              For complete API reference and feature guides, see:
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
              <li><code>FEATURES_GUIDE.md</code> - Comprehensive feature documentation</li>
              <li><code>API_REFERENCE.md</code> - Complete API endpoint reference</li>
              <li><code>QUICK_START.md</code> - Quick start guide</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
