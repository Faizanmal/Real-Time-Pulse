'use client';

/**
 * =============================================================================
 * REAL-TIME PULSE - ENTERPRISE DASHBOARD PAGE
 * =============================================================================
 * 
 * Main dashboard interface with real-time metrics, widgets, and analytics.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Zap,
  Plus,
  MoreVertical,
  Maximize2,
  RefreshCw,
  Download,
  Share2,
  Calendar,
  ChevronDown,
} from 'lucide-react';

// Simulated real-time data
const generateData = () => {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3600000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    revenue: Math.floor(Math.random() * 50000) + 30000,
    users: Math.floor(Math.random() * 500) + 200,
    conversions: Math.floor(Math.random() * 100) + 50,
  }));
};

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
  sparkline?: number[];
}

function MetricCard({ title, value, change, icon, color, sparkline }: MetricCardProps) {
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <motion.p
              className="text-2xl font-bold text-gray-900 dark:text-white mt-1"
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.3 }}
              key={String(value)}
            >
              {value}
            </motion.p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'
            }`}
        >
          {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          {Math.abs(change)}%
        </div>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 h-12">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={sparkline.map((value, i) => ({ value, i }))}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

// Widget Header Component
interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onExpand?: () => void;
  onMore?: () => void;
}

function WidgetHeader({ title, subtitle, onRefresh, onExpand, onMore }: WidgetHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Expand"
          >
            <Maximize2 className="w-4 h-4 text-gray-500" />
          </button>
        )}
        {onMore && (
          <button
            onClick={onMore}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
}

// Activity Feed Component
function ActivityFeed() {
  const activities = [
    { id: 1, type: 'alert', message: 'CPU usage exceeded 80%', time: '2m ago', severity: 'warning' },
    { id: 2, type: 'user', message: 'New user registered', time: '5m ago', severity: 'info' },
    { id: 3, type: 'revenue', message: 'New subscription: Enterprise', time: '12m ago', severity: 'success' },
    { id: 4, type: 'system', message: 'Backup completed successfully', time: '30m ago', severity: 'info' },
    { id: 5, type: 'alert', message: 'API response time spike detected', time: '1h ago', severity: 'warning' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'warning': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className={`p-2 rounded-full ${getSeverityColor(activity.severity)}`}>
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {activity.message}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {activity.time}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Top Products Component
function TopProducts() {
  const products = [
    { name: 'Enterprise Plan', value: 45000, percentage: 35 },
    { name: 'Professional Plan', value: 32000, percentage: 25 },
    { name: 'Starter Plan', value: 28000, percentage: 22 },
    { name: 'Add-ons', value: 15000, percentage: 12 },
    { name: 'Other', value: 8000, percentage: 6 },
  ];

  return (
    <div className="space-y-4">
      {products.map((product, index) => (
        <div key={product.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {product.name}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ${product.value.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${product.percentage}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Dashboard Page
export default function DashboardPage() {
  const [data, setData] = useState(generateData);
  const [isLive, setIsLive] = useState(true);
  const [timeRange] = useState('24h');

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1)];
        const lastTime = new Date();
        newData.push({
          time: lastTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          revenue: Math.floor(Math.random() * 50000) + 30000,
          users: Math.floor(Math.random() * 500) + 200,
          conversions: Math.floor(Math.random() * 100) + 50,
        });
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalUsers = data.reduce((sum, d) => sum + d.users, 0);
    const totalConversions = data.reduce((sum, d) => sum + d.conversions, 0);
    const avgRevenue = Math.floor(totalRevenue / data.length);

    return {
      revenue: {
        value: `$${totalRevenue.toLocaleString()}`,
        change: 12.5,
        sparkline: data.map(d => d.revenue),
      },
      users: {
        value: totalUsers.toLocaleString(),
        change: 8.3,
        sparkline: data.map(d => d.users),
      },
      conversions: {
        value: totalConversions.toLocaleString(),
        change: -2.1,
        sparkline: data.map(d => d.conversions),
      },
      avgRevenue: {
        value: `$${avgRevenue.toLocaleString()}`,
        change: 5.7,
        sparkline: data.map(d => d.revenue),
      },
    };
  }, [data]);

  // Pie chart data
  const pieData = [
    { name: 'Direct', value: 40 },
    { name: 'Organic', value: 30 },
    { name: 'Referral', value: 20 },
    { name: 'Social', value: 10 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Welcome back! Here&apos;s what&apos;s happening today.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Time Range Selector */}
              <div className="relative">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <Calendar className="w-4 h-4" />
                  Last {timeRange}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Live Toggle */}
              <button
                onClick={() => setIsLive(!isLive)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isLive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isLive ? 'Live' : 'Paused'}
              </button>

              {/* Actions */}
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Download className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Share2 className="w-5 h-5 text-gray-500" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={metrics.revenue.value}
            change={metrics.revenue.change}
            icon={<DollarSign className="w-5 h-5" />}
            color="#6366f1"
            sparkline={metrics.revenue.sparkline}
          />
          <MetricCard
            title="Active Users"
            value={metrics.users.value}
            change={metrics.users.change}
            icon={<Users className="w-5 h-5" />}
            color="#8b5cf6"
            sparkline={metrics.users.sparkline}
          />
          <MetricCard
            title="Conversions"
            value={metrics.conversions.value}
            change={metrics.conversions.change}
            icon={<Zap className="w-5 h-5" />}
            color="#ec4899"
            sparkline={metrics.conversions.sparkline}
          />
          <MetricCard
            title="Avg. Revenue"
            value={metrics.avgRevenue.value}
            change={metrics.avgRevenue.change}
            icon={<TrendingUp className="w-5 h-5" />}
            color="#10b981"
            sparkline={metrics.avgRevenue.sparkline}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <WidgetHeader
              title="Revenue Overview"
              subtitle="Revenue trends over time"
              onRefresh={() => setData(generateData())}
              onExpand={() => { }}
              onMore={() => { }}
            />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [`$${value?.toLocaleString() || '0'}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <WidgetHeader
              title="Traffic Sources"
              subtitle="Where your visitors come from"
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white ml-auto">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <WidgetHeader
              title="User Activity"
              subtitle="Active users over time"
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={data.slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="users" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <WidgetHeader
              title="Top Products"
              subtitle="Revenue by product"
            />
            <TopProducts />
          </div>

          {/* Activity Feed */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <WidgetHeader
              title="Recent Activity"
              subtitle="Latest events and alerts"
            />
            <ActivityFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
