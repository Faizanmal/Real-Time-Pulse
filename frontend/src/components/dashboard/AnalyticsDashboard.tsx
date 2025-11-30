'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  analyticsApi,
  AnalyticsData,
  SystemHealth,
  UserActivity,
  UsageMetrics,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface AnalyticsDashboardProps {
  className?: string;
  portalId?: string;
}

export function AnalyticsDashboard({ className, portalId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [dateRange, portalId]);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();

    switch (dateRange) {
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const loadData = async () => {
    try {
      const { startDate, endDate } = getDateRange();

      const [analyticsData, healthData, activityData, metricsData] = await Promise.all([
        portalId
          ? analyticsApi.getPortalAnalytics(portalId, startDate, endDate)
          : analyticsApi.getOverview(startDate, endDate),
        analyticsApi.getSystemHealth(),
        analyticsApi.getUserActivity({ limit: 20 }),
        analyticsApi.getUsageMetrics(),
      ]);

      setAnalytics(analyticsData);
      setSystemHealth(healthData);
      setActivity(activityData);
      setUsageMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Analytics refreshed');
  };

  // Calculate totals from analytics data
  const totals = analytics.reduce(
    (acc, curr) => ({
      pageViews: acc.pageViews + curr.metrics.pageViews,
      uniqueVisitors: acc.uniqueVisitors + curr.metrics.uniqueVisitors,
      avgSessionDuration: acc.avgSessionDuration + curr.metrics.avgSessionDuration,
      bounceRate: acc.bounceRate + curr.metrics.bounceRate,
    }),
    { pageViews: 0, uniqueVisitors: 0, avgSessionDuration: 0, bounceRate: 0 }
  );

  if (analytics.length > 0) {
    totals.avgSessionDuration = totals.avgSessionDuration / analytics.length;
    totals.bounceRate = totals.bounceRate / analytics.length;
  }

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Page Views"
              value={totals.pageViews.toLocaleString()}
              icon={BarChart3}
              trend="+12%"
              trendUp
            />
            <StatCard
              title="Unique Visitors"
              value={totals.uniqueVisitors.toLocaleString()}
              icon={Users}
              trend="+8%"
              trendUp
            />
            <StatCard
              title="Avg. Session"
              value={`${Math.floor(totals.avgSessionDuration / 60)}m ${Math.floor(totals.avgSessionDuration % 60)}s`}
              icon={Clock}
              trend="-3%"
              trendUp={false}
            />
            <StatCard
              title="Bounce Rate"
              value={`${totals.bounceRate.toFixed(1)}%`}
              icon={Activity}
              trend="-2%"
              trendUp
            />
          </div>

          {/* Charts would go here - simplified view */}
          <div className="border rounded-lg p-6">
            <h4 className="font-medium mb-4">Traffic Over Time</h4>
            {analytics.length > 0 ? (
              <div className="h-64 flex items-end gap-2">
                {analytics.map((data, i) => {
                  const maxViews = Math.max(...analytics.map((a) => a.metrics.pageViews));
                  const height = (data.metrics.pageViews / maxViews) * 100;

                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                        title={`${data.metrics.pageViews} views`}
                      />
                      <span className="text-xs text-gray-500 truncate w-full text-center">
                        {new Date(data.period).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available for this period
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="health">
          {systemHealth ? (
            <SystemHealthSection health={systemHealth} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>System health data not available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivitySection activity={activity} />
        </TabsContent>

        <TabsContent value="usage">
          {usageMetrics ? (
            <UsageMetricsSection metrics={usageMetrics} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Usage metrics not available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <span
          className={cn(
            'text-xs font-medium',
            trendUp ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend}
        </span>
      </div>
    </div>
  );
}

interface SystemHealthSectionProps {
  health: SystemHealth;
}

function SystemHealthSection({ health }: SystemHealthSectionProps) {
  const statusColors: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unhealthy: 'bg-red-100 text-red-800',
    up: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    healthy: <CheckCircle className="h-4 w-4 text-green-500" />,
    degraded: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    unhealthy: <AlertTriangle className="h-4 w-4 text-red-500" />,
    up: <CheckCircle className="h-4 w-4 text-green-500" />,
    down: <AlertTriangle className="h-4 w-4 text-red-500" />,
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          {statusIcons[health.status]}
          <div>
            <h4 className="font-medium">System Status</h4>
            <p className="text-sm text-gray-500 capitalize">{health.status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Uptime</p>
          <p className="font-medium">{formatUptime(health.uptime)}</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Response Time</span>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold">{health.responseTime}ms</span>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Error Rate</span>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold">{health.errorRate.toFixed(2)}%</span>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Services</span>
            <Server className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold">
            {health.services.filter((s) => s.status === 'up').length}/
            {health.services.length}
          </span>
        </div>
      </div>

      {/* Services */}
      <div>
        <h4 className="font-medium mb-3">Services Status</h4>
        <div className="border rounded-lg divide-y">
          {health.services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                {statusIcons[service.status]}
                <span className="font-medium">{service.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{service.latency}ms</span>
                <Badge className={statusColors[service.status]}>
                  {service.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActivitySectionProps {
  activity: UserActivity[];
}

function ActivitySection({ activity }: ActivitySectionProps) {
  if (activity.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>
    );
  }

  const getActivityIcon = (action: string) => {
    if (action.includes('create')) return '➕';
    if (action.includes('update')) return '✏️';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('login')) return '🔐';
    if (action.includes('export')) return '📤';
    return '📌';
  };

  return (
    <div className="border rounded-lg divide-y">
      {activity.map((item) => (
        <div key={`${item.userId}-${item.timestamp}`} className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">{getActivityIcon(item.action)}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {item.user.firstName && item.user.lastName
                    ? `${item.user.firstName} ${item.user.lastName}`
                    : item.user.email}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {item.action}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {item.resourceType} • {item.resourceId}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(item.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface UsageMetricsSectionProps {
  metrics: UsageMetrics;
}

function UsageMetricsSection({ metrics }: UsageMetricsSectionProps) {
  return (
    <div className="space-y-6">
      {/* API Calls */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">API Calls</h4>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold">
            {metrics.apiCalls.total.toLocaleString()}
          </span>
          <span className="text-gray-500">total requests</span>
        </div>
        <div className="space-y-2">
          {Object.entries(metrics.apiCalls.byEndpoint)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([endpoint, count]) => (
              <div key={endpoint} className="flex items-center justify-between">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {endpoint}
                </code>
                <span className="text-sm text-gray-500">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Storage */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">Storage</h4>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold">
            {(metrics.storage.total / 1024 / 1024).toFixed(2)}
          </span>
          <span className="text-gray-500">MB used</span>
        </div>
        <div className="space-y-2">
          {Object.entries(metrics.storage.byType).map(([type, size]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="capitalize">{type}</span>
              <span className="text-sm text-gray-500">
                {(size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bandwidth */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">Bandwidth</h4>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold">
            {(metrics.bandwidth.total / 1024 / 1024).toFixed(2)}
          </span>
          <span className="text-gray-500">MB transferred</span>
        </div>
        <div className="h-32 flex items-end gap-1">
          {Object.entries(metrics.bandwidth.byDay)
            .slice(-7)
            .map(([day, bandwidth]) => {
              const maxBandwidth = Math.max(
                ...Object.values(metrics.bandwidth.byDay)
              );
              const height = maxBandwidth > 0 ? (bandwidth / maxBandwidth) * 100 : 0;

              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t min-h-[4px]"
                    style={{ height: `${height}%` }}
                    title={`${(bandwidth / 1024 / 1024).toFixed(2)} MB`}
                  />
                  <span className="text-xs text-gray-500">
                    {new Date(day).toLocaleDateString('en-US', {
                      weekday: 'short',
                    })}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
