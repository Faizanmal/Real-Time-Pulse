'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Layout,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Clock,
  Database,
  Zap,
  Shield,
  BarChart3,
  PieChart,
  Globe,
  Calendar,
} from 'lucide-react';
import {
  adminAnalyticsApi,
  SystemMetrics,
  RevenueMetrics,
  AdminSystemHealth,
  UserActivityMetrics,
  AdminActivityItem,
  WorkspaceComparison,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface AdminDashboardProps {
  className?: string;
}

export function AdminDashboard({ className }: AdminDashboardProps) {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivityMetrics | null>(null);
  const [activityFeed, setActivityFeed] = useState<AdminActivityItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [
        systemData,
        revenueData,
        healthData,
        activityData,
        feedData,
        workspacesData,
      ] = await Promise.all([
        adminAnalyticsApi.getSystemMetrics(),
        adminAnalyticsApi.getRevenueMetrics(),
        adminAnalyticsApi.getSystemHealth(),
        adminAnalyticsApi.getUserActivityMetrics(),
        adminAnalyticsApi.getActivityFeed(50),
        adminAnalyticsApi.getWorkspaceComparison(),
      ]);

      setSystemMetrics(systemData);
      setRevenueMetrics(revenueData);
      setSystemHealth(healthData);
      setUserActivity(activityData);
      setActivityFeed(feedData);
      setWorkspaces(workspacesData);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const handleExport = async (type: 'users' | 'revenue' | 'activity' | 'workspaces') => {
    try {
      const data = await adminAnalyticsApi.exportData({
        type,
        format: exportFormat,
      });

      if (exportFormat === 'csv') {
        const blob = data as Blob;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success(`Exported ${type} data`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-bold">Admin Dashboard</h2>
            <Badge variant="secondary">System Overview</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as 'json' | 'csv')}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
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

        {/* System Health Banner */}
        {systemHealth && (
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-lg',
              getHealthStatusColor(systemHealth.status)
            )}
          >
            <div className="flex items-center gap-3">
              {getHealthIcon(systemHealth.status)}
              <div>
                <span className="font-medium capitalize">
                  System Status: {systemHealth.status}
                </span>
                {systemHealth.alerts.criticalCount > 0 && (
                  <span className="ml-2 text-sm">
                    • {systemHealth.alerts.criticalCount} critical alerts
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>DB: {systemHealth.database.responseTime}ms</span>
              <span>Cache Hit: {systemHealth.cache.hitRate}%</span>
              <span>Job Failure: {systemHealth.jobs.failureRate}%</span>
            </div>
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 pt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Users"
                value={formatNumber(systemMetrics?.users.total || 0)}
                subtitle={`${systemMetrics?.users.activeThisMonth || 0} active this month`}
                icon={Users}
                trend={`+${systemMetrics?.users.newThisMonth || 0} new`}
                trendUp
              />
              <MetricCard
                title="Workspaces"
                value={formatNumber(systemMetrics?.workspaces.total || 0)}
                subtitle={`${systemMetrics?.workspaces.activeThisMonth || 0} active`}
                icon={Building2}
                trend={`+${systemMetrics?.workspaces.newThisMonth || 0} new`}
                trendUp
              />
              <MetricCard
                title="Total Portals"
                value={formatNumber(systemMetrics?.portals.total || 0)}
                subtitle={`${systemMetrics?.portals.public || 0} public`}
                icon={Layout}
                trend={`${formatNumber(systemMetrics?.portals.totalViews || 0)} views`}
              />
              <MetricCard
                title="MRR"
                value={formatCurrency(revenueMetrics?.mrr || 0)}
                subtitle={`ARR: ${formatCurrency(revenueMetrics?.arr || 0)}`}
                icon={DollarSign}
                trend={`${revenueMetrics?.churnRate || 0}% churn`}
                trendUp={false}
              />
            </div>

            {/* System Health Details */}
            {systemHealth && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Health
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <HealthItem
                    label="Database"
                    status={systemHealth.database.status}
                    detail={`${systemHealth.database.responseTime}ms`}
                    icon={Database}
                  />
                  <HealthItem
                    label="Cache"
                    status={systemHealth.cache.status}
                    detail={`${systemHealth.cache.hitRate}% hit rate`}
                    icon={Zap}
                  />
                  <HealthItem
                    label="Jobs"
                    status={systemHealth.jobs.failureRate > 10 ? 'degraded' : 'healthy'}
                    detail={`${systemHealth.jobs.pending} pending, ${systemHealth.jobs.failed} failed`}
                    icon={Activity}
                  />
                  <HealthItem
                    label="Integrations"
                    status={systemHealth.integrations.failing > 0 ? 'degraded' : 'healthy'}
                    detail={`${systemHealth.integrations.healthy}/${systemHealth.integrations.healthy + systemHealth.integrations.failing} healthy`}
                    icon={Globe}
                  />
                </div>
              </Card>
            )}

            {/* Widget Distribution */}
            {systemMetrics?.widgets && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Widgets by Type ({formatNumber(systemMetrics.widgets.total)} total)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(systemMetrics.widgets.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="capitalize">{type}</span>
                      <Badge variant="secondary">{formatNumber(count)}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Integration Stats */}
            {systemMetrics?.integrations && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Integrations by Provider ({formatNumber(systemMetrics.integrations.total)} total)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(systemMetrics.integrations.byProvider).map(([provider, count]) => (
                    <div key={provider} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="uppercase text-sm">{provider}</span>
                      <Badge variant="secondary">{formatNumber(count)}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6 pt-4">
            {revenueMetrics && (
              <>
                {/* Revenue Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard
                    title="Monthly Recurring Revenue"
                    value={formatCurrency(revenueMetrics.mrr)}
                    icon={DollarSign}
                  />
                  <MetricCard
                    title="Annual Recurring Revenue"
                    value={formatCurrency(revenueMetrics.arr)}
                    icon={Calendar}
                  />
                  <MetricCard
                    title="Avg Revenue Per User"
                    value={formatCurrency(revenueMetrics.averageRevenuePerUser)}
                    icon={Users}
                  />
                  <MetricCard
                    title="Churn Rate"
                    value={`${revenueMetrics.churnRate}%`}
                    icon={TrendingDown}
                    trend={revenueMetrics.churnRate > 5 ? 'High' : 'Normal'}
                    trendUp={revenueMetrics.churnRate <= 5}
                  />
                </div>

                {/* Revenue by Plan */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Revenue by Plan
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => handleExport('revenue')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">Subscribers</TableHead>
                        <TableHead className="text-right">Monthly Revenue</TableHead>
                        <TableHead className="text-right">% of MRR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueMetrics.byPlan.map((plan) => (
                        <TableRow key={plan.plan}>
                          <TableCell className="font-medium">{plan.plan}</TableCell>
                          <TableCell className="text-right">{plan.count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(plan.revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {revenueMetrics.mrr > 0
                              ? ((plan.revenue / revenueMetrics.mrr) * 100).toFixed(1)
                              : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Revenue Growth Chart */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    MRR Growth (Last 6 Months)
                  </h3>
                  <div className="h-64 flex items-end gap-4">
                    {revenueMetrics.growth.map((month, index) => {
                      const maxMrr = Math.max(...revenueMetrics.growth.map((g) => g.mrr));
                      const height = maxMrr > 0 ? (month.mrr / maxMrr) * 100 : 0;

                      return (
                        <div key={month.period} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(month.mrr)}
                          </span>
                          <div
                            className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-xs text-gray-500">{month.period}</span>
                          <span className="text-xs text-gray-400">
                            {month.subscribers} subs
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6 pt-4">
            {userActivity && (
              <>
                {/* User Activity Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard
                    title="Daily Active Users"
                    value={formatNumber(userActivity.dailyActiveUsers)}
                    icon={Users}
                  />
                  <MetricCard
                    title="Weekly Active Users"
                    value={formatNumber(userActivity.weeklyActiveUsers)}
                    icon={Users}
                  />
                  <MetricCard
                    title="Monthly Active Users"
                    value={formatNumber(userActivity.monthlyActiveUsers)}
                    icon={Users}
                  />
                  <MetricCard
                    title="Avg Sessions/User"
                    value={userActivity.sessionStats.avgSessionsPerUser.toFixed(1)}
                    icon={Activity}
                  />
                </div>

                {/* Retention */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    User Retention
                  </h3>
                  <div className="grid grid-cols-3 gap-8">
                    <RetentionCard label="Day 1" value={userActivity.retention.day1} />
                    <RetentionCard label="Day 7" value={userActivity.retention.day7} />
                    <RetentionCard label="Day 30" value={userActivity.retention.day30} />
                  </div>
                </Card>

                {/* Top Features */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Top Features by Usage
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => handleExport('users')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Users
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Usage Count</TableHead>
                        <TableHead className="text-right">Unique Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userActivity.topFeatures.map((feature) => (
                        <TableRow key={feature.feature}>
                          <TableCell className="font-medium">{feature.feature}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(feature.usageCount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(feature.uniqueUsers)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Users by Plan */}
                {systemMetrics?.users.byPlan && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Users by Plan
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {Object.entries(systemMetrics.users.byPlan).map(([plan, count]) => (
                        <div key={plan} className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold">{formatNumber(count)}</div>
                          <div className="text-sm text-gray-500">{plan}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="space-y-6 pt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Workspace Comparison
                </h3>
                <Button variant="outline" size="sm" onClick={() => handleExport('workspaces')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Portals</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Integrations</TableHead>
                    <TableHead className="text-right">Activity</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.slice(0, 20).map((ws) => (
                    <TableRow key={ws.workspaceId}>
                      <TableCell className="font-medium">{ws.name}</TableCell>
                      <TableCell>
                        <Badge variant={ws.plan === 'ENTERPRISE' ? 'default' : 'secondary'}>
                          {ws.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{ws.portals}</TableCell>
                      <TableCell className="text-right">{ws.members}</TableCell>
                      <TableCell className="text-right">{ws.integrations}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(ws.totalActivity)}
                      </TableCell>
                      <TableCell className="text-right text-gray-500 text-sm">
                        {new Date(ws.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6 pt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </h3>
                <Button variant="outline" size="sm" onClick={() => handleExport('activity')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {activityFeed.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm',
                        activity.success
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      )}
                    >
                      {activity.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{activity.action}</span>
                        <Badge variant="outline" className="text-xs">
                          {activity.entity}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {activity.userEmail}
                        {activity.entityId && (
                          <span className="text-gray-400 ml-2">• {activity.entityId}</span>
                        )}
                      </div>
                      {activity.errorMessage && (
                        <div className="text-sm text-red-500 mt-1">
                          {activity.errorMessage}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

// Helper Components
interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, trendUp }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      {trend && (
        <div
          className={cn(
            'text-xs mt-2',
            trendUp === undefined
              ? 'text-gray-500'
              : trendUp
              ? 'text-green-600'
              : 'text-red-600'
          )}
        >
          {trendUp !== undefined && (trendUp ? '↑ ' : '↓ ')}
          {trend}
        </div>
      )}
    </Card>
  );
}

interface HealthItemProps {
  label: string;
  status: string;
  detail: string;
  icon: React.ElementType;
}

function HealthItem({ label, status, detail, icon: Icon }: HealthItemProps) {
  const statusColors: Record<string, string> = {
    healthy: 'text-green-600',
    degraded: 'text-yellow-600',
    critical: 'text-red-600',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className={cn('h-5 w-5', statusColors[status] || 'text-gray-500')} />
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-500">{detail}</div>
      </div>
    </div>
  );
}

interface RetentionCardProps {
  label: string;
  value: number;
}

function RetentionCard({ label, value }: RetentionCardProps) {
  const getColor = (val: number) => {
    if (val >= 70) return 'text-green-600';
    if (val >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="text-center">
      <div className={cn('text-4xl font-bold', getColor(value))}>{value}%</div>
      <div className="text-sm text-gray-500 mt-1">{label} Retention</div>
      <Progress value={value} className="mt-2" />
    </div>
  );
}
