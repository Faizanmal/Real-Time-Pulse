'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, AlertTriangle, CheckCircle2, XCircle, 
  RefreshCw, Settings, TrendingUp,
  Clock, Zap
} from 'lucide-react';
import { dataHealthApi } from '@/lib/api-client';

// Updated interface to match JSX usage
interface HealthMonitor {
  id: string;
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'RATE_LIMITED' | 'SCHEMA_CHANGED' | string;
  lastCheck: string;
  lastCheckAt: string;
  lastError?: string;
  responseTime?: number;
  dataFreshness?: number;
  freshnessThreshold: number;
  schemaChangeDetected?: boolean;
  integration?: {
    accountName?: string;
    provider: string;
  };
  [key: string]: unknown;
}

// Updated metrics to match card usage
interface HealthMetrics {
  uptimePercentage: number;
  avgResponseTime: number;
  totalChecks: number;
  healthyChecks: number;
  [key: string]: unknown;
}

export default function DataHealthDashboard({ workspaceId }: { workspaceId: string }) {
  const [healthMonitors, setHealthMonitors] = useState<HealthMonitor[]>([]);
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Don't set global loading if we are just background refreshing
      if (!refreshing) setLoading(true);
      
      const [monitorsRes, metricsRes] = await Promise.all([
        dataHealthApi.getWorkspaceHealth(workspaceId),
        dataHealthApi.getMetrics(workspaceId, 7),
      ]);
      
      setHealthMonitors(monitorsRes.data);
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, refreshing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerCheck = async (healthId: string) => {
    try {
      setRefreshing(true);
      await dataHealthApi.triggerCheck(healthId);
      await loadData(); // Refresh the list after check
    } catch (error) {
      console.error('Check failed:', error);
    } finally {
      setRefreshing(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'DEGRADED':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'DOWN':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'RATE_LIMITED':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'SCHEMA_CHANGED':
        return <Zap className="h-5 w-5 text-purple-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'DEGRADED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DOWN':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'RATE_LIMITED':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'SCHEMA_CHANGED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Data Source Health</h2>
          <p className="text-gray-600 mt-1">Real-time monitoring of all data integrations</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Uptime" value={`${metrics.uptimePercentage}%`} icon={<TrendingUp className="h-8 w-8 text-green-500" />} />
          <MetricCard title="Avg Response" value={`${metrics.avgResponseTime}ms`} icon={<Clock className="h-8 w-8 text-blue-500" />} />
          <MetricCard title="Total Checks" value={metrics.totalChecks} icon={<Activity className="h-8 w-8 text-purple-500" />} />
          <MetricCard title="Healthy" value={metrics.healthyChecks} icon={<CheckCircle2 className="h-8 w-8 text-green-500" />} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {healthMonitors.map((monitor) => (
          <Card key={monitor.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {getStatusIcon(monitor.status)}
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold">
                      {monitor.integration?.accountName || monitor.integration?.provider || monitor.name}
                    </h3>
                    <Badge className={getStatusColor(monitor.status)}>
                      {monitor.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Provider: {monitor.integration?.provider}
                  </p>
                  
                  {monitor.lastError && (
                    <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-100">
                      <strong>Error:</strong> {monitor.lastError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Checked: {new Date(monitor.lastCheckAt).toLocaleString()}
                    </span>
                    {monitor.responseTime !== undefined && (
                      <span>Latency: {monitor.responseTime.toFixed(0)}ms</span>
                    )}
                    {monitor.dataFreshness !== undefined && monitor.dataFreshness !== null && (
                      <span className={monitor.dataFreshness > monitor.freshnessThreshold ? 'text-red-600 font-bold' : ''}>
                        Data Age: {monitor.dataFreshness}min
                      </span>
                    )}
                  </div>

                  {monitor.schemaChangeDetected && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center">
                      <Zap className="h-4 w-4 text-purple-600 mr-2" />
                      <p className="text-sm text-purple-800 font-medium">
                        Schema change detected! Review and acknowledge the changes.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerCheck(monitor.id)}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {healthMonitors.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No Health Monitors</h3>
          <p className="text-gray-500 mt-2">Add integrations to start monitoring their health</p>
        </Card>
      )}
    </div>
  );
}

// Internal Helper Component
function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon}
      </div>
    </Card>
  );
}