"use client";

import { motion } from "framer-motion";
import { AnimatedCard, AnimatedCardHeader, AnimatedCardTitle, AnimatedCardContent } from "../ui/animated-card";
import { StatsCard, StatsGrid } from "../ui/stats-card";
import { AnimatedChart } from "../ui/animated-chart";
import { AnimatedTabs, Tab } from "../ui/animated-tabs";
import { StatusBadge } from "../ui/animated-badge";
import { AnimatedButton } from "../ui/animated-button";
import { DashboardSkeleton } from "../ui/loading-skeleton";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  Download
} from "lucide-react";
import { useState, useEffect } from "react";

// Sample data
const chartData = [
  { name: "Jan", revenue: 4000, users: 2400, orders: 1200 },
  { name: "Feb", revenue: 3000, users: 1398, orders: 2210 },
  { name: "Mar", revenue: 2000, users: 9800, orders: 2290 },
  { name: "Apr", revenue: 2780, users: 3908, orders: 2000 },
  { name: "May", revenue: 1890, users: 4800, orders: 2181 },
  { name: "Jun", revenue: 2390, users: 3800, orders: 2500 },
  { name: "Jul", revenue: 3490, users: 4300, orders: 2100 },
];

const activityData = [
  { id: 1, user: "John Doe", action: "Created new workspace", time: "2 minutes ago", status: "online" as const },
  { id: 2, user: "Jane Smith", action: "Updated dashboard", time: "5 minutes ago", status: "away" as const },
  { id: 3, user: "Mike Johnson", action: "Exported report", time: "10 minutes ago", status: "busy" as const },
  { id: 4, user: "Sarah Williams", action: "Invited team member", time: "15 minutes ago", status: "offline" as const },
];

export function ModernDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <BarChart3 className="h-4 w-4" />,
      content: <OverviewTab />,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <PieChart className="h-4 w-4" />,
      badge: "New",
      content: <AnalyticsTab />,
    },
    {
      id: "activity",
      label: "Activity",
      icon: <Activity className="h-4 w-4" />,
      badge: activityData.length,
      content: <ActivityTab />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-br from-gray-50 via-purple-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-900/10 dark:to-pink-900/10 p-6"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Welcome back! Here&apos;s what&apos;s happening today.
            </p>
          </div>
          <div className="flex gap-3">
            <AnimatedButton variant="outline">
              <Calendar className="h-4 w-4" />
              Last 30 days
            </AnimatedButton>
            <AnimatedButton variant="gradient">
              <Download className="h-4 w-4" />
              Export
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <StatsGrid>
          <StatsCard
            title="Total Users"
            value="12,345"
            change={12.5}
            trend="up"
            icon={<Users />}
            description="vs last month"
            variant="gradient"
          />
          <StatsCard
            title="Revenue"
            value="$45,678"
            change={8.2}
            trend="up"
            icon={<DollarSign />}
            description="vs last month"
            variant="glass"
          />
          <StatsCard
            title="Active Sessions"
            value="1,234"
            change={-3.1}
            trend="down"
            icon={<Activity />}
            description="vs last hour"
          />
          <StatsCard
            title="Growth Rate"
            value="23.5%"
            change={5.4}
            trend="up"
            icon={<TrendingUp />}
            description="vs last quarter"
          />
        </StatsGrid>

        {/* Tabs */}
        <AnimatedTabs
          tabs={tabs}
          defaultTab="overview"
          variant="pills"
        />
      </div>
    </motion.div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <AnimatedChart
        data={chartData}
        type="area"
        dataKeys={["revenue", "users", "orders"]}
        height={350}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <AnimatedCard variant="hover-lift">
          <AnimatedCardHeader>
            <AnimatedCardTitle>Recent Activity</AnimatedCardTitle>
          </AnimatedCardHeader>
          <AnimatedCardContent>
            <div className="space-y-4">
              {activityData.slice(0, 3).map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.user}</p>
                  </div>
                  <StatusBadge status={activity.status} />
                </motion.div>
              ))}
            </div>
          </AnimatedCardContent>
        </AnimatedCard>

        <AnimatedCard variant="border-glow">
          <AnimatedCardHeader>
            <AnimatedCardTitle>Performance Metrics</AnimatedCardTitle>
          </AnimatedCardHeader>
          <AnimatedCardContent>
            <div className="space-y-4">
              <MetricBar label="CPU Usage" value={65} color="bg-purple-600" />
              <MetricBar label="Memory" value={80} color="bg-pink-600" />
              <MetricBar label="Storage" value={45} color="bg-blue-600" />
              <MetricBar label="Network" value={92} color="bg-green-600" />
            </div>
          </AnimatedCardContent>
        </AnimatedCard>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <AnimatedChart
          data={chartData}
          type="bar"
          dataKeys={["revenue"]}
          colors={["#8b5cf6"]}
          height={300}
        />
        <AnimatedChart
          data={chartData}
          type="line"
          dataKeys={["users", "orders"]}
          colors={["#ec4899", "#3b82f6"]}
          height={300}
        />
      </div>
    </div>
  );
}

function ActivityTab() {
  return (
    <div className="space-y-4">
      {activityData.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <AnimatedCard variant="hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-linear-to-r from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                  {activity.user[0]}
                </div>
                <div>
                  <p className="font-semibold">{activity.user}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {activity.action}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{activity.time}</span>
                <StatusBadge status={activity.status} />
              </div>
            </div>
          </AnimatedCard>
        </motion.div>
      ))}
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-gray-500">{value}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}
