'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Shield, DollarSign, FileText, CheckCircle } from 'lucide-react';
import DataHealthMonitor from '../data-quality/DataHealthMonitor';
import DataValidationDashboard from '../data-quality/DataValidationDashboard';
import ProfitabilityDashboard from '../profitability/ProfitabilityDashboard';
import ClientReportingDashboard from '../reporting/ClientReportingDashboard';
import GDPRComplianceDashboard from '../compliance/GDPRComplianceDashboard';

export default function FeaturesDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto p-6">
          <h1 className="text-4xl font-bold mb-2">Enterprise Features</h1>
          <p className="text-muted-foreground">
            Advanced data quality, business intelligence, and compliance tools
          </p>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Data Health</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="reporting">Client Reports</TabsTrigger>
            <TabsTrigger value="compliance">GDPR</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Data Quality Card */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Activity className="h-8 w-8 text-blue-600" />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>Data Source Health</CardTitle>
                  <CardDescription>
                    Real-time monitoring of all integrated APIs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Features:</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• API error detection</li>
                      <li>• Rate limit monitoring</li>
                      <li>• Data freshness tracking</li>
                      <li>• Schema change detection</li>
                    </ul>
                    <Button className="w-full mt-4" variant="outline" onClick={() => document.querySelector('[value="health"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Data Validation Card */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Shield className="h-8 w-8 text-green-600" />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>Data Validation</CardTitle>
                  <CardDescription>
                    Automated quality checks and alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Features:</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Custom validation rules</li>
                      <li>• Negative value detection</li>
                      <li>• Spike/anomaly detection</li>
                      <li>• Cross-source consistency</li>
                    </ul>
                    <Button className="w-full mt-4" variant="outline" onClick={() => document.querySelector('[value="validation"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Profitability Card */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-8 w-8 text-emerald-600" />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>Profitability Analytics</CardTitle>
                  <CardDescription>
                    Track project and client profitability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Features:</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Project profitability heatmaps</li>
                      <li>• Client scoring system</li>
                      <li>• Resource utilization metrics</li>
                      <li>• Billable hours tracking</li>
                    </ul>
                    <Button className="w-full mt-4" variant="outline" onClick={() => document.querySelector('[value="profitability"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Client Reporting Card */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <FileText className="h-8 w-8 text-purple-600" />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>Automated Reporting</CardTitle>
                  <CardDescription>
                    AI-powered client report generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Features:</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• AI-generated insights</li>
                      <li>• Executive summaries</li>
                      <li>• Automated scheduling</li>
                      <li>• Custom presentations</li>
                    </ul>
                    <Button className="w-full mt-4" variant="outline" onClick={() => document.querySelector('[value="reporting"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* GDPR Compliance Card */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Shield className="h-8 w-8 text-red-600" />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>GDPR Compliance</CardTitle>
                  <CardDescription>
                    Automated compliance management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Features:</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Consent tracking</li>
                      <li>• Data deletion workflows</li>
                      <li>• Audit trails</li>
                      <li>• Compliance reporting</li>
                    </ul>
                    <Button className="w-full mt-4" variant="outline" onClick={() => document.querySelector('[value="compliance"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Impact Summary Card */}
              <Card className="md:col-span-2 lg:col-span-1 border-2 border-blue-500">
                <CardHeader>
                  <CardTitle>Impact Summary</CardTitle>
                  <CardDescription>Expected benefits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium">Support Tickets</span>
                      <span className="text-lg font-bold text-blue-600">-60%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium">Time Saved/Week</span>
                      <span className="text-lg font-bold text-green-600">15h</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                      <span className="text-sm font-medium">Compliance Score</span>
                      <span className="text-lg font-bold text-purple-600">+40%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                      <span className="text-sm font-medium">Data Quality</span>
                      <span className="text-lg font-bold text-orange-600">+85%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health">
            <DataHealthMonitor />
          </TabsContent>

          <TabsContent value="validation">
            <DataValidationDashboard />
          </TabsContent>

          <TabsContent value="profitability">
            <ProfitabilityDashboard />
          </TabsContent>

          <TabsContent value="reporting">
            <ClientReportingDashboard />
          </TabsContent>

          <TabsContent value="compliance">
            <GDPRComplianceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
