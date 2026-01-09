'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { analyticsApi, type DashboardOverview, type PerformanceMetrics, type ActivityItem, type TrendingData } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, Activity, Zap,
  Clock, Globe, Layers, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, performanceData, activityData, trendingData] = await Promise.all([
        analyticsApi.getDashboardOverview(),
        analyticsApi.getPerformanceMetrics(),
        analyticsApi.getActivityFeed(20),
        analyticsApi.getTrendingData(),
      ]);
      setOverview(overviewData);
      setPerformance(performanceData);
      setActivity(activityData);
      setTrending(trendingData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your workspace performance
          </p>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Portals"
          value={overview?.totalPortals || 0}
          change={overview?.trends.portals || 0}
          icon={Layers}
          color="purple"
        />
        <MetricCard
          title="Active Users"
          value={overview?.activeUsers || 0}
          change={overview?.trends.users || 0}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Total Widgets"
          value={overview?.totalWidgets || 0}
          change={overview?.trends.widgets || 0}
          icon={Activity}
          color="green"
        />
        <MetricCard
          title="Data Points Today"
          value={overview?.dataPointsToday || 0}
          icon={Zap}
          color="orange"
        />
      </div>

      {/* Performance & Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Metrics */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Performance
            </CardTitle>
            <CardDescription>System health metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uptime</span>
                <span className="font-medium text-green-600">{performance?.uptime?.toFixed(2) || 99.99}%</span>
              </div>
              <Progress value={performance?.uptime || 99.99} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Avg Response Time</span>
                <span className="font-medium">{performance?.avgResponseTime || 0}ms</span>
              </div>
              <Progress value={Math.min(100, 100 - (performance?.avgResponseTime || 0) / 10)} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Error Rate</span>
                <span className={`font-medium ${(performance?.errorRate || 0) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                  {performance?.errorRate?.toFixed(2) || 0}%
                </span>
              </div>
              <Progress value={100 - (performance?.errorRate || 0)} className="h-2" />
            </div>
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>P95 Response</span>
                <span>{performance?.p95ResponseTime || 0}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>P99 Response</span>
                <span>{performance?.p99ResponseTime || 0}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Requests/min</span>
                <span>{performance?.requestsPerMinute || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest events in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              ) : (
                activity.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <Users className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.action} {item.resource}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trending Data */}
      <Tabs defaultValue="portals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portals">Top Portals</TabsTrigger>
          <TabsTrigger value="widgets">Top Widgets</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="hours">Peak Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="portals">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Portals</CardTitle>
              <CardDescription>Based on views and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trending?.topPortals?.map((portal, index) => (
                  <div key={portal.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{portal.name}</p>
                        <p className="text-sm text-muted-foreground">{portal.views.toLocaleString()} views</p>
                      </div>
                    </div>
                    <Badge variant={portal.growth >= 0 ? 'default' : 'destructive'} className="gap-1">
                      {portal.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(portal.growth)}%
                    </Badge>
                  </div>
                )) || (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widgets">
          <Card>
            <CardHeader>
              <CardTitle>Most Used Widgets</CardTitle>
              <CardDescription>Based on interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trending?.topWidgets?.map((widget, index) => (
                  <div key={widget.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{widget.name}</p>
                        <p className="text-sm text-muted-foreground">{widget.interactions.toLocaleString()} interactions</p>
                      </div>
                    </div>
                    <Badge variant={widget.growth >= 0 ? 'default' : 'destructive'} className="gap-1">
                      {widget.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(widget.growth)}%
                    </Badge>
                  </div>
                )) || (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Popular Integrations</CardTitle>
              <CardDescription>Most connected services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trending?.popularIntegrations?.map((integration) => (
                  <div key={integration.provider} className="flex items-center gap-3 p-4 rounded-lg border">
                    <Globe className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="font-medium">{integration.provider}</p>
                      <p className="text-sm text-muted-foreground">{integration.count} connections</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-center text-muted-foreground py-8 col-span-full">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Peak Usage Hours</CardTitle>
              <CardDescription>When your users are most active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-48 gap-1">
                {(trending?.peakHours || Array.from({ length: 24 }, (_, i) => ({ hour: i, requests: Math.random() * 100 }))).map((hour) => (
                  <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                      style={{ height: `${(hour.requests / Math.max(...(trending?.peakHours?.map(h => h.requests) || [100]))) * 100}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{hour.hour}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: number; 
  change?: number; 
  icon: React.ComponentType<{ className?: string }>; 
  color: 'purple' | 'blue' | 'green' | 'orange';
}) {
  const colorClasses = {
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
    green: 'text-green-600 bg-green-100 dark:bg-green-900',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(change)}% from last period
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
