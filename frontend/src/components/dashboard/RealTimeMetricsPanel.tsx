"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket, useSocketEvent } from "@/contexts/socket-context";
import {
  Activity,
  Users,
  TrendingUp,
  Zap,
  Globe,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// REAL-TIME METRICS PANEL - Live Enterprise Dashboard Component
// ============================================================================

interface MetricData {
  id: string;
  label: string;
  value: number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  sparkline?: number[];
}

interface RealTimeMetricsPanelProps {
  className?: string;
  compact?: boolean;
}

export const RealTimeMetricsPanel: React.FC<RealTimeMetricsPanelProps> = ({
  className,
  compact = false,
}) => {
  const { isConnected, connectionState } = useSocket();
  const [metrics, setMetrics] = React.useState<MetricData[]>([
    {
      id: "active-users",
      label: "Active Users",
      value: 0,
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-500",
      sparkline: [],
    },
    {
      id: "requests-per-sec",
      label: "Requests/sec",
      value: 0,
      icon: <Activity className="h-5 w-5" />,
      color: "text-green-500",
      sparkline: [],
    },
    {
      id: "conversion-rate",
      label: "Conversion",
      value: 0,
      unit: "%",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-purple-500",
      sparkline: [],
    },
    {
      id: "response-time",
      label: "Response Time",
      value: 0,
      unit: "ms",
      icon: <Zap className="h-5 w-5" />,
      color: "text-yellow-500",
      sparkline: [],
    },
    {
      id: "global-traffic",
      label: "Global Traffic",
      value: 0,
      icon: <Globe className="h-5 w-5" />,
      color: "text-cyan-500",
      sparkline: [],
    },
    {
      id: "uptime",
      label: "Uptime",
      value: 99.99,
      unit: "%",
      icon: <Clock className="h-5 w-5" />,
      color: "text-emerald-500",
      sparkline: [],
    },
  ]);

  const [alerts, setAlerts] = React.useState<
    Array<{
      id: string;
      type: "success" | "warning" | "error";
      message: string;
      timestamp: Date;
    }>
  >([]);

  // Listen for real-time metric updates
  useSocketEvent("metrics:update", (data: Partial<MetricData>) => {
    setMetrics((prev) =>
      prev.map((metric) => {
        if (metric.id === data.id) {
          const newSparkline = [...(metric.sparkline || []), data.value || 0].slice(-20);
          return {
            ...metric,
            ...data,
            sparkline: newSparkline,
            trend: data.value && metric.value ? ((data.value - metric.value) / metric.value) * 100 : 0,
          };
        }
        return metric;
      })
    );
  });

  // Listen for alerts
  useSocketEvent("alert:new", (alert: { type: string; message: string }) => {
    const newAlert = {
      id: Date.now().toString(),
      type: alert.type as "success" | "warning" | "error",
      message: alert.message,
      timestamp: new Date(),
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 5));
  });

  // Simulate real-time updates for demo
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((metric) => {
          const change = (Math.random() - 0.5) * 10;
          const newValue = Math.max(0, metric.value + change);
          const newSparkline = [...(metric.sparkline || []), newValue].slice(-20);
          return {
            ...metric,
            value: Math.round(newValue * 100) / 100,
            sparkline: newSparkline,
            trend: change,
          };
        })
      );
    }, 2000);

    // Initial values
    setMetrics((prev) =>
      prev.map((metric) => ({
        ...metric,
        value:
          metric.id === "active-users"
            ? 1247
            : metric.id === "requests-per-sec"
            ? 3420
            : metric.id === "conversion-rate"
            ? 4.8
            : metric.id === "response-time"
            ? 142
            : metric.id === "global-traffic"
            ? 89432
            : 99.99,
      }))
    );

    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Real-Time Metrics</h2>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <motion.div
              className="flex items-center gap-1.5 text-sm text-green-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Wifi className="h-4 w-4" />
              <span>Live</span>
              <motion.span
                className="h-2 w-2 rounded-full bg-green-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4" />
              <span>{connectionState}</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        className={cn(
          "grid gap-4",
          compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        )}
      >
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Sparkline background */}
            {metric.sparkline && metric.sparkline.length > 1 && (
              <div className="absolute inset-0 opacity-10">
                <MiniSparkline data={metric.sparkline} />
              </div>
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-lg p-2 bg-muted", metric.color)}>
                  {metric.icon}
                </span>
                {metric.trend !== undefined && metric.trend !== 0 && (
                  <motion.span
                    className={cn(
                      "text-xs font-medium",
                      metric.trend > 0 ? "text-green-500" : "text-red-500"
                    )}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    {metric.trend > 0 ? "+" : ""}
                    {metric.trend.toFixed(1)}%
                  </motion.span>
                )}
              </div>

              <div className="mt-3">
                <motion.p
                  className="text-2xl font-bold"
                  key={metric.value}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  {formatValue(metric.value)}
                  {metric.unit && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {metric.unit}
                    </span>
                  )}
                </motion.p>
                <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live Alerts Feed */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Live Alerts</h3>
          <AnimatePresence mode="popLayout">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  alert.type === "error" && "border-red-500/30 bg-red-500/5",
                  alert.type === "warning" && "border-yellow-500/30 bg-yellow-500/5",
                  alert.type === "success" && "border-green-500/30 bg-green-500/5"
                )}
              >
                {getAlertIcon(alert.type)}
                <span className="flex-1 text-sm">{alert.message}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(alert.timestamp)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// Mini sparkline for background
const MiniSparkline: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x}%,${y}%`;
    })
    .join(" ");

  return (
    <svg className="w-full h-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// Utility functions
function formatValue(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default RealTimeMetricsPanel;
