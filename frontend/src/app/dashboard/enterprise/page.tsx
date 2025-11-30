'use client';

import { useState } from 'react';
import { ExportButton, WidgetExportButton } from '@/src/components/dashboard/ExportButton';
import { AIInsightsPanel } from '@/src/components/dashboard/AIInsightsPanel';
import { AlertsManager } from '@/src/components/dashboard/AlertsManager';
import { WebhooksManager } from '@/src/components/dashboard/WebhooksManager';
import { ScheduledReportsManager } from '@/src/components/dashboard/ScheduledReportsManager';
import { ShareLinksManager } from '@/src/components/dashboard/ShareLinksManager';
import { CommentsSection } from '@/src/components/dashboard/CommentsSection';
import { TemplatesMarketplace } from '@/src/components/dashboard/TemplatesMarketplace';
import { BillingDashboard } from '@/src/components/dashboard/BillingDashboard';
import { AnalyticsDashboard } from '@/src/components/dashboard/AnalyticsDashboard';
import { IntegrationsHub } from '@/src/components/dashboard/IntegrationsHub';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
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
  Plug 
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
      </Tabs>

    </div>
  );
}
