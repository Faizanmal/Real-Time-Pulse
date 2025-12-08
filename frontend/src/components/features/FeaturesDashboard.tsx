'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { 
  Activity, Shield, DollarSign, FileText, CheckCircle,
  TrendingUp, Users, AlertTriangle
} from 'lucide-react';
import DataHealthDashboard from './DataHealthDashboard';
import DataValidationDashboard from './DataValidationDashboard';
import ProfitabilityDashboard from './ProfitabilityDashboard';
import ClientReportDashboard from './ClientReportDashboard';
import GDPRDashboard from './GDPRDashboard';

export default function FeaturesDashboard({ workspaceId }: { workspaceId: string }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Advanced Features</h1>
        <p className="text-gray-600 mt-2">
          Data quality, business intelligence, and compliance tools
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Data Health
          </TabsTrigger>
          <TabsTrigger value="validation">
            <CheckCircle className="h-4 w-4 mr-2" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="profitability">
            <DollarSign className="h-4 w-4 mr-2" />
            Profitability
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="gdpr">
            <Shield className="h-4 w-4 mr-2" />
            GDPR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('health')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Data Source Health</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Real-time monitoring of all data integrations with automatic alerts
                  </p>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• API health checks</li>
                    <li>• Rate limit monitoring</li>
                    <li>• Data freshness tracking</li>
                    <li>• Schema change detection</li>
                  </ul>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('validation')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Data Validation</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Automated quality checks with user-defined validation rules
                  </p>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• No negative values</li>
                    <li>• Spike detection</li>
                    <li>• Missing field checks</li>
                    <li>• Cross-source consistency</li>
                  </ul>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('profitability')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Profitability Analytics</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Track project profitability and client value in real-time
                  </p>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Billable hours tracking</li>
                    <li>• Profitability heatmaps</li>
                    <li>• Client scoring</li>
                    <li>• Resource utilization</li>
                  </ul>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('reports')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Automated Client Reporting</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    AI-powered report generation with automatic insights
                  </p>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Executive summaries</li>
                    <li>• Key insights analysis</li>
                    <li>• Automated recommendations</li>
                    <li>• Scheduled delivery</li>
                  </ul>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('gdpr')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">GDPR Compliance</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Automated compliance workflows and data request handling
                  </p>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Consent management</li>
                    <li>• Data deletion workflows</li>
                    <li>• Audit trails</li>
                    <li>• Compliance reporting</li>
                  </ul>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Impact Summary</h3>
                <div className="space-y-3 mt-4">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">60-70%</p>
                    <p className="text-sm text-gray-600">Reduction in support tickets</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">5-10h</p>
                    <p className="text-sm text-gray-600">Saved per week per manager</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-purple-600">80%</p>
                    <p className="text-sm text-gray-600">Less compliance overhead</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Feature Benefits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-blue-500" />
                  Data Quality & Reliability
                </h4>
                <p className="text-sm text-gray-600">
                  Prevent data-driven decisions on bad data. Catch quality issues before they reach clients.
                  Reduce time spent debugging stale or incorrect data.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-green-500" />
                  Business Intelligence
                </h4>
                <p className="text-sm text-gray-600">
                  Identify unprofitable clients and projects early. Track resource utilization efficiency.
                  Make informed decisions with real-time profitability insights.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-purple-500" />
                  Automated Reporting
                </h4>
                <p className="text-sm text-gray-600">
                  Generate client-ready reports automatically with AI-powered insights. Schedule delivery
                  based on project milestones. Save hours of manual report creation weekly.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-blue-500" />
                  Compliance Automation
                </h4>
                <p className="text-sm text-gray-600">
                  Handle GDPR data requests automatically. Maintain audit trails for all data access.
                  Generate compliance reports with one click. Prevent regulatory fines.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <DataHealthDashboard workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="validation">
          <DataValidationDashboard workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="profitability">
          <ProfitabilityDashboard workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="reports">
          <ClientReportDashboard workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="gdpr">
          <GDPRDashboard workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
