'use client';

import { useState } from 'react';
import { ExportButton, WidgetExportButton } from '@/components/dashboard/ExportButton';
import { AIInsightsPanel } from '@/components/dashboard/AIInsightsPanel';
import { AlertsManager } from '@/components/dashboard/AlertsManager';
import { WebhooksManager } from '@/components/dashboard/WebhooksManager';
import { ScheduledReportsManager } from '@/components/dashboard/ScheduledReportsManager';
import { ShareLinksManager } from '@/components/dashboard/ShareLinksManager';
import { CommentsSection } from '@/components/dashboard/CommentsSection';
import { TemplatesMarketplace } from '@/components/dashboard/TemplatesMarketplace';
import { BillingDashboard } from '@/components/dashboard/BillingDashboard';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { IntegrationsHub } from '@/components/dashboard/IntegrationsHub';
import { AuditLogViewer } from '@/components/dashboard/AuditLogViewer';
import { RoleManagementPanel } from '@/components/dashboard/RoleManagementPanel';
import { FederatedSearchPanel } from '@/components/dashboard/FederatedSearchPanel';
import { MLMarketplacePanel } from '@/components/dashboard/MLMarketplacePanel';
import { VoiceDashboardPanel } from '@/components/dashboard/VoiceDashboardPanel';
import { BlockchainAuditPanel } from '@/components/dashboard/BlockchainAuditPanel';
import { ARVisualizationPanel } from '@/components/dashboard/ARVisualizationPanel';
import { APIMarketplacePanel } from '@/components/dashboard/APIMarketplacePanel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Brain,
  Bell,
  Webhook,
  Calendar,
  Share2,
  MessageSquare,
  Palette,
  CreditCard,
  BarChart3,
  Plug,
  Users,
  Search,
  Activity,
  Zap,
  Puzzle
} from 'lucide-react';

/**
 * Enterprise Features Dashboard
 * 
 * This page demonstrates the integration of all enterprise features:
 * - Export System (PDF, CSV, Excel)
 * - AI-Powered Insights
 * - Smart Alerts
 * - Webhooks Platform
 * - Scheduled Reports
 * - Share Links
 * - Comments & Collaboration
 * - Templates Marketplace
 * - Billing & Subscriptions
 * - Analytics Dashboard
 * - Integrations Hub
 */
export default function EnterpriseDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // In a real app, these would come from your state management or API
  const portalId = 'portal-123';

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Enterprise Features</h1>
          <p className="text-gray-600">
            Manage exports, AI insights, alerts, webhooks, and all enterprise capabilities
          </p>
        </div>
        <Badge variant="default" className="bg-purple-600">
          Premium
        </Badge>
      </div>

      {/* Feature Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 mb-6 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-2 px-3 py-2">
            <Download className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="flex items-center gap-2 px-3 py-2">
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2 px-3 py-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2 px-3 py-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="scheduled-reports" className="flex items-center gap-2 px-3 py-2">
            <Calendar className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="share-links" className="flex items-center gap-2 px-3 py-2">
            <Share2 className="h-4 w-4" />
            Share
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2 px-3 py-2">
            <MessageSquare className="h-4 w-4" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2 px-3 py-2">
            <Palette className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2 px-3 py-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 px-3 py-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2 px-3 py-2">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2 px-3 py-2">
            <Download className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2 px-3 py-2">
            <Users className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="federated-search" className="flex items-center gap-2 px-3 py-2">
            <Search className="h-4 w-4" />
            Federated Search
          </TabsTrigger>
          <TabsTrigger value="ml-marketplace" className="flex items-center gap-2 px-3 py-2">
            <Brain className="h-4 w-4" />
            ML Marketplace
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2 px-3 py-2">
            <MessageSquare className="h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="blockchain" className="flex items-center gap-2 px-3 py-2">
            <Activity className="h-4 w-4" />
            Blockchain
          </TabsTrigger>
          <TabsTrigger value="ar" className="flex items-center gap-2 px-3 py-2">
            <Zap className="h-4 w-4" />
            AR
          </TabsTrigger>
          <TabsTrigger value="api-marketplace" className="flex items-center gap-2 px-3 py-2">
            <Puzzle className="h-4 w-4" />
            API Marketplace
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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

          {/* Feature Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('ai-insights')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Insights</h3>
                  <p className="text-sm text-gray-600">Get AI-powered analytics</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('alerts')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Bell className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Smart Alerts</h3>
                  <p className="text-sm text-gray-600">Configure threshold alerts</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('webhooks')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Webhook className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Webhooks</h3>
                  <p className="text-sm text-gray-600">Real-time event notifications</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('scheduled-reports')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Scheduled Reports</h3>
                  <p className="text-sm text-gray-600">Automated report delivery</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('share-links')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Share2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Share Links</h3>
                  <p className="text-sm text-gray-600">Share portals securely</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('comments')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Comments</h3>
                  <p className="text-sm text-gray-600">Collaborate with your team</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('templates')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Palette className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Templates</h3>
                  <p className="text-sm text-gray-600">Browse the marketplace</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('billing')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Billing</h3>
                  <p className="text-sm text-gray-600">Manage your subscription</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('analytics')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Analytics</h3>
                  <p className="text-sm text-gray-600">Usage & performance metrics</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('integrations')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Plug className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Integrations</h3>
                  <p className="text-sm text-gray-600">Connect external services</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('audit')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Download className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Audit Logs</h3>
                  <p className="text-sm text-gray-600">Track system activity</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('roles')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Users className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Role Management</h3>
                  <p className="text-sm text-gray-600">Manage user permissions</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('federated-search')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Federated Search</h3>
                  <p className="text-sm text-gray-600">Search across data sources</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('ml-marketplace')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fuchsia-100 rounded-lg">
                  <Brain className="h-5 w-5 text-fuchsia-600" />
                </div>
                <div>
                  <h3 className="font-semibold">ML Marketplace</h3>
                  <p className="text-sm text-gray-600">Deploy AI models</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('voice')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Voice Dashboard</h3>
                  <p className="text-sm text-gray-600">Voice command analytics</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('blockchain')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Activity className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Blockchain Audit</h3>
                  <p className="text-sm text-gray-600">Immutable audit trails</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('ar')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Zap className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold">AR Visualization</h3>
                  <p className="text-sm text-gray-600">Augmented reality views</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('api-marketplace')}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Puzzle className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold">API Marketplace</h3>
                  <p className="text-sm text-gray-600">Connect external APIs</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai-insights">
          <AIInsightsPanel portalId={portalId} />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <AlertsManager />
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          <WebhooksManager />
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled-reports">
          <ScheduledReportsManager />
        </TabsContent>

        {/* Share Links Tab */}
        <TabsContent value="share-links">
          <ShareLinksManager resourceType="portal" resourceId={portalId} />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <CommentsSection resourceType="portal" resourceId={portalId} />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <TemplatesMarketplace />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <BillingDashboard />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <IntegrationsHub />
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>

        {/* Roles */}
        <TabsContent value="roles">
          <RoleManagementPanel />
        </TabsContent>

        {/* Federated Search */}
        <TabsContent value="federated-search">
          <FederatedSearchPanel />
        </TabsContent>

        {/* ML Marketplace */}
        <TabsContent value="ml-marketplace">
          <MLMarketplacePanel />
        </TabsContent>

        {/* Voice */}
        <TabsContent value="voice">
          <VoiceDashboardPanel />
        </TabsContent>

        {/* Blockchain */}
        <TabsContent value="blockchain">
          <BlockchainAuditPanel />
        </TabsContent>

        {/* AR Visualization */}
        <TabsContent value="ar">
          <ARVisualizationPanel />
        </TabsContent>

        {/* API Marketplace */}
        <TabsContent value="api-marketplace">
          <APIMarketplacePanel />
        </TabsContent>
      </Tabs>

    </div>
  );
}
