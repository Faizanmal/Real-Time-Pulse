'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IndustrySolutions from '@/components/features/industry-solutions';
import AIQueryInterface from '@/components/features/ai-query-interface';
import WorkflowAutomation from '@/components/features/workflow-automation';
import ComplianceDashboard from '@/components/features/compliance-dashboard';
import APIMarketplace from '@/components/features/api-marketplace';
import { Sparkles, Building2, Zap, Shield, Plug } from 'lucide-react';

export default function AdvancedFeaturesPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Advanced Features</h1>
        <p className="text-muted-foreground text-lg">
          Explore enterprise-grade capabilities to supercharge your analytics
        </p>
      </div>

      <Tabs defaultValue="industry" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="industry" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Industry Solutions
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Marketplace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="industry" className="mt-6">
          <IndustrySolutions />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <AIQueryInterface />
        </TabsContent>

        <TabsContent value="workflows" className="mt-6">
          <WorkflowAutomation />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceDashboard />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          <APIMarketplace />
        </TabsContent>
      </Tabs>
    </div>
  );
}
