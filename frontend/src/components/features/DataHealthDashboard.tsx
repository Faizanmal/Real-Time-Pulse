'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, AlertTriangle, CheckCircle2, XCircle, 
  RefreshCw, Settings, TrendingUp, TrendingDown,
  Clock, Zap
} from 'lucide-react';
import { dataHealthApi } from '@/lib/api-client';

export default function DataHealthDashboard({ workspaceId }: { workspaceId: string }) {
  const [healthMonitors, setHealthMonitors] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
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
  };

  const triggerCheck = async (healthId: string) => {
    try {
      setRefreshing(true);
      await dataHealthApi.triggerCheck(healthId);
      await loadData();
    } catch (error) {
      console.error('Check failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Data Source Health</h2>
          <p className="text-gray-600 mt-1">Real-time monitoring of all data integrations</p>
        </div>
        <Button onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uptime</p>
                <p className="text-2xl font-bold mt-1">{metrics.uptimePercentage}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold mt-1">{metrics.avgResponseTime}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Checks</p>
                <p className="text-2xl font-bold mt-1">{metrics.totalChecks}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Healthy</p>
                <p className="text-2xl font-bold mt-1">{metrics.healthyChecks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Health Monitors */}
      <div className="grid grid-cols-1 gap-4">
        {healthMonitors.map((monitor) => (
          <Card key={monitor.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {getStatusIcon(monitor.status)}
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold">{monitor.integration?.accountName || monitor.integration?.provider}</h3>
                    <Badge className={getStatusColor(monitor.status)}>
                      {monitor.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Provider: {monitor.integration?.provider}
                  </p>
                  {monitor.lastError && (
                    <p className="text-sm text-red-600 mt-2">
                      Error: {monitor.lastError}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 mt-3 text-sm">
                    <span className="text-gray-600">
                      Last checked: {new Date(monitor.lastCheckAt).toLocaleString()}
                    </span>
                    {monitor.responseTime && (
                      <span className="text-gray-600">
                        Response: {monitor.responseTime.toFixed(0)}ms
                      </span>
                    )}
                    {monitor.dataFreshness !== null && (
                      <span className={monitor.dataFreshness > monitor.freshnessThreshold ? 'text-red-600' : 'text-gray-600'}>
                        Data age: {monitor.dataFreshness}min
                      </span>
                    )}
                  </div>
                  {monitor.schemaChangeDetected && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
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
        <Card className="p-12 text-center">
          <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No Health Monitors</h3>
          <p className="text-gray-600 mt-2">Add integrations to start monitoring their health</p>
        </Card>
      )}
    </div>
  );
}
