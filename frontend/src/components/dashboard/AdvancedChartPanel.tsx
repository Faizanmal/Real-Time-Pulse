"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Maximize2,
  Settings,
  RefreshCw,
  Calendar,
  Filter,
} from "lucide-react";

// ============================================================================
// ADVANCED CHART PANEL - Enterprise Visualization Component
// ============================================================================

type ChartType = "line" | "area" | "bar" | "pie" | "radar" | "composed";
type TimeRange = "1h" | "24h" | "7d" | "30d" | "90d" | "1y" | "custom";

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface ChartSeries {
  key: string;
  name: string;
  color: string;
  type?: "line" | "area" | "bar";
}

interface AdvancedChartPanelProps {
  title: string;
  description?: string;
  data: DataPoint[];
  series: ChartSeries[];
  chartType?: ChartType;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showBrush?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  gradient?: boolean;
  stacked?: boolean;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onExpand?: () => void;
  loading?: boolean;
  className?: string;
  comparison?: {
    enabled: boolean;
    label: string;
    data: DataPoint[];
  };
}

const COLORS = [
  "#6366f1", // Indigo
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
];

export const AdvancedChartPanel: React.FC<AdvancedChartPanelProps> = ({
  title,
  description,
  data,
  series,
  chartType = "line",
  height = 350,
  showLegend = true,
  showGrid = true,
  showBrush = false,
  showTooltip = true,
  animate = true,
  gradient = true,
  stacked = false,
  timeRange = "7d",
  onTimeRangeChange,
  onRefresh,
  onExport,
  onExpand,
  loading = false,
  className,
  comparison,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = React.useState<TimeRange>(timeRange);
  const [isHovered, setIsHovered] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Calculate summary stats
  const stats = React.useMemo(() => {
    if (!data.length || !series.length) return null;

    const mainKey = series[0].key;
    const values = data.map((d) => Number(d[mainKey]) || 0);
    const current = values[values.length - 1];
    const previous = values[values.length - 2] || current;
    const change = previous ? ((current - previous) / previous) * 100 : 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    return { current, change, avg, max, min };
  }, [data, series]);

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (chartType) {
      case "area":
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />}
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {series.map((s, i) => (
              <React.Fragment key={s.key}>
                {gradient && (
                  <defs>
                    <linearGradient id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                )}
                <Area
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  fill={gradient ? `url(#gradient-${s.key})` : s.color}
                  fillOpacity={gradient ? 1 : 0.3}
                  strokeWidth={2}
                  stackId={stacked ? "stack" : undefined}
                  animationDuration={animate ? 1000 : 0}
                />
              </React.Fragment>
            ))}
            {showBrush && <Brush dataKey="name" height={30} stroke="#6366f1" />}
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />}
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                stackId={stacked ? "stack" : undefined}
                radius={[4, 4, 0, 0]}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
            {showBrush && <Brush dataKey="name" height={30} stroke="#6366f1" />}
          </BarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={series[0]?.key || "value"}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              innerRadius={height / 5}
              paddingAngle={2}
              animationDuration={animate ? 1000 : 0}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                  stroke={activeIndex === index ? "#fff" : "none"}
                  strokeWidth={activeIndex === index ? 2 : 0}
                />
              ))}
            </Pie>
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
          </PieChart>
        );

      case "radar":
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <PolarRadiusAxis stroke="#9ca3af" fontSize={10} />
            {series.map((s) => (
              <Radar
                key={s.key}
                name={s.name}
                dataKey={s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.3}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
          </RadarChart>
        );

      case "composed":
        return (
          <ComposedChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />}
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {series.map((s) => {
              switch (s.type) {
                case "area":
                  return (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      fill={s.color}
                      stroke={s.color}
                      fillOpacity={0.3}
                    />
                  );
                case "bar":
                  return (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.name}
                      fill={s.color}
                      radius={[4, 4, 0, 0]}
                    />
                  );
                default:
                  return (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
              }
            })}
            {showBrush && <Brush dataKey="name" height={30} stroke="#6366f1" />}
          </ComposedChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />}
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {stats && (
              <ReferenceLine
                y={stats.avg}
                stroke="#6366f1"
                strokeDasharray="5 5"
                label={{ value: "Avg", fill: "#6366f1", fontSize: 10 }}
              />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
            {comparison?.enabled &&
              comparison.data.length > 0 &&
              series.map((s) => (
                <Line
                  key={`${s.key}-comparison`}
                  type="monotone"
                  dataKey={s.key}
                  data={comparison.data}
                  name={`${s.name} (${comparison.label})`}
                  stroke={s.color}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  opacity={0.5}
                />
              ))}
            {showBrush && <Brush dataKey="name" height={30} stroke="#6366f1" />}
          </LineChart>
        );
    }
  };

  return (
    <motion.div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          {stats && (
            <div className="flex items-center gap-4 mt-2">
              <span className="text-2xl font-bold">
                {formatNumber(stats.current)}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 text-sm",
                  stats.change >= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {stats.change >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {stats.change >= 0 ? "+" : ""}
                {stats.change.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => handleTimeRangeChange(range.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  selectedTimeRange === range.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="flex items-center gap-1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {onExport && (
                  <button
                    onClick={onExport}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                    title="Export"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {onExpand && (
                  <button
                    onClick={onExpand}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                    title="Expand"
                  >
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <motion.div
              className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-sm font-medium">{formatNumber(stats.avg)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max</p>
              <p className="text-sm font-medium">{formatNumber(stats.max)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Min</p>
              <p className="text-sm font-medium">{formatNumber(stats.min)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-xs text-muted-foreground">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Custom Tooltip Component
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-popover border border-border rounded-lg shadow-lg p-3"
    >
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </motion.div>
  );
};

// Utility functions
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

export default AdvancedChartPanel;
