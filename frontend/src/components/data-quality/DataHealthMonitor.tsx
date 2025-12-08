'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Activity, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface HealthStatus {
  id: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'RATE_LIMITED' | 'SCHEMA_CHANGED';
  integration: {
    provider: string;
    accountName: string;
  };
  lastCheckAt: string;
  lastSuccessAt: string;
  lastErrorAt: string;
  consecutiveErrors: number;
  responseTime: number;
  dataFreshness: number;
  freshnessThreshold: number;
  lastError: string;
  healthChecks: HealthCheck[];
}

interface HealthCheck {
  id: string;
  timestamp: string;
  status: string;
  responseTime: number;
  errorMessage: string;
  dataFreshness: number;
}

interface HealthMetrics {
  totalChecks: number;
  healthyChecks: number;
  uptimePercentage: number;
  avgResponseTime: number;
  period: string;
}

export default function DataHealthMonitor() {
  const [healthData, setHealthData] = useState<HealthStatus[]>([]);
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    try {
      // Replace with actual workspace ID
      const workspaceId = 'your-workspace-id';
      
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`/api/data-health/workspace/${workspaceId}`),
        fetch(`/api/data-health/workspace/${workspaceId}/metrics?days=7`)
      ]);

      const health = await healthRes.json();
      const metricsData = await metricsRes.json();

      setHealthData(health);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerHealthCheck = async (healthId: string) => {
    try {
      await fetch(`/api/data-health/${healthId}/check`, { method: 'POST' });
      fetchHealthData();
    } catch (error) {
      console.error('Failed to trigger health check:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-500';
      case 'DEGRADED': return 'bg-yellow-500';
      case 'DOWN': return 'bg-red-500';
      case 'RATE_LIMITED': return 'bg-orange-500';
      case 'SCHEMA_CHANGED': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'DEGRADED': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'DOWN': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'RATE_LIMITED': return <Clock className="h-5 w-5 text-orange-500" />;
      case 'SCHEMA_CHANGED': return <Activity className="h-5 w-5 text-purple-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const healthSummary = healthData.reduce((acc, source) => {
    acc[source.status] = (acc[source.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(healthSummary).map(([status, count]) => ({
    name: status,
    value: count,
    color: getStatusColor(status).replace('bg-', '#')
  }));

  const COLORS = {
    HEALTHY: '#10b981',
    DEGRADED: '#f59e0b',
    DOWN: '#ef4444',
    RATE_LIMITED: '#fb923c',
    SCHEMA_CHANGED: '#a855f7'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Source Health Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of all integrated data sources
          </p>
        </div>
        <Button onClick={fetchHealthData}>
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.length}</div>
            <p className="text-xs text-muted-foreground">
              Active integrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.uptimePercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Last {metrics?.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              Across all sources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData.filter(s => s.status !== 'HEALTHY').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Health Status Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health Distribution</CardTitle>
            <CardDescription>Status breakdown of data sources</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>Average response time over last checks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={healthData.flatMap(s => 
                  s.healthChecks.slice(0, 10).map(check => ({
                    timestamp: new Date(check.timestamp).toLocaleTimeString(),
                    responseTime: check.responseTime,
                    source: s.integration.provider
                  }))
                )}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="responseTime" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Data Source List */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Detailed status of each integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthData.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                onClick={() => setSelectedSource(source.id)}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent">
                    {getStatusIcon(source.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{source.integration.provider}</h3>
                      <Badge variant={source.status === 'HEALTHY' ? 'default' : 'destructive'}>
                        {source.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {source.integration.accountName}
                    </p>
                    {source.lastError && (
                      <p className="text-xs text-red-500 mt-1">{source.lastError}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Response Time</p>
                    <p className="font-semibold">{source.responseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data Freshness</p>
                    <p className="font-semibold">{source.dataFreshness}min</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Errors</p>
                    <p className="font-semibold">{source.consecutiveErrors}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHealthCheck(source.id);
                    }}
                  >
                    Check Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
