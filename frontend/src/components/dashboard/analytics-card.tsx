"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardBadge,
} from "@/components/ui/animated-card";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MoreVertical,
  RefreshCw,
  Download,
  Maximize2,
  Eye,
  EyeOff,
} from "lucide-react";

// ============================================================================
// ANALYTICS CARD - Enterprise Dashboard Component
// ============================================================================

interface AnalyticsCardProps {
  title: string;
  description?: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  sparklineData?: number[];
  badge?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onExpand?: () => void;
  className?: string;
  variant?: "default" | "glass" | "gradient" | "premium";
  size?: "sm" | "default" | "lg";
  interactive?: boolean;
  showMenu?: boolean;
  index?: number;
}

// Mini sparkline component
const Sparkline: React.FC<{ data: number[]; color?: string }> = ({
  data,
  color = "currentColor",
}) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 100;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-10"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        fill="url(#sparklineGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        points={areaPoints}
      />
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        points={points}
      />
    </svg>
  );
};

// Animated counter component
const AnimatedCounter: React.FC<{
  value: number | string;
  className?: string;
}> = ({ value, className }) => {
  const numericValue =
    typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  const [displayValue, setDisplayValue] = React.useState(0);
  const prefix = typeof value === "string" ? value.replace(/[0-9.-]/g, "").charAt(0) : "";
  const suffix = typeof value === "string" ? value.replace(/[0-9.-]/g, "").slice(1) : "";

  React.useEffect(() => {
    if (isNaN(numericValue)) {
      setDisplayValue(0);
      return;
    }

    const duration = 1000;
    const steps = 60;
    const increment = numericValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [numericValue]);

  const formatValue = (val: number) => {
    if (typeof value === "string" && value.includes("%")) {
      return val.toFixed(1);
    }
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + "M";
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1) + "K";
    }
    return val.toFixed(0);
  };

  if (typeof value === "string" && isNaN(numericValue)) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {formatValue(displayValue)}
      {suffix}
    </span>
  );
};

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  description,
  value,
  previousValue,
  change,
  changeLabel = "vs last period",
  trend,
  icon,
  sparklineData,
  badge,
  loading = false,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  variant = "default",
  size = "default",
  interactive = true,
  showMenu = true,
  index = 0,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isHidden, setIsHidden] = React.useState(false);

  // Determine trend from change if not explicitly provided
  const computedTrend =
    trend || (change && change > 0 ? "up" : change && change < 0 ? "down" : "neutral");

  const trendConfig = {
    up: {
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    down: {
      icon: TrendingDown,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    neutral: {
      icon: Minus,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  };

  const TrendIcon = trendConfig[computedTrend].icon;

  const sizeConfig = {
    sm: {
      value: "text-2xl",
      icon: "h-8 w-8",
      padding: "sm" as const,
    },
    default: {
      value: "text-3xl",
      icon: "h-10 w-10",
      padding: "default" as const,
    },
    lg: {
      value: "text-4xl",
      icon: "h-12 w-12",
      padding: "lg" as const,
    },
  };

  return (
    <AnimatedCard
      variant={variant}
      padding={sizeConfig[size].padding}
      interactive={interactive}
      animation="slideUp"
      index={index}
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Menu button */}
      {showMenu && (
        <div className="absolute top-4 right-4 flex gap-1">
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex gap-1"
              >
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {onExport && (
                  <button
                    onClick={onExport}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Export"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {onExpand && (
                  <button
                    onClick={onExpand}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Expand"
                  >
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => setIsHidden(!isHidden)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title={isHidden ? "Show value" : "Hide value"}
                >
                  {isHidden ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 bg-card/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <motion.div
            className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-red-500/10 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <motion.div
                className={cn(
                  "flex items-center justify-center rounded-xl bg-primary/10 text-primary",
                  sizeConfig[size].icon
                )}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                {icon}
              </motion.div>
            )}
            <div>
              <CardTitle size={size === "lg" ? "lg" : "default"}>
                {title}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {badge && (
            <CardBadge>
              {badge}
            </CardBadge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Main value */}
          <div className="flex items-end justify-between">
            <div>
              <motion.div
                className={cn(
                  "font-bold tracking-tight",
                  sizeConfig[size].value,
                  isHidden && "blur-md select-none"
                )}
              >
                {isHidden ? "••••••" : <AnimatedCounter value={value} />}
              </motion.div>
              {previousValue && (
                <p className="text-sm text-muted-foreground mt-1">
                  Previous: {isHidden ? "••••" : previousValue}
                </p>
              )}
            </div>

            {/* Trend indicator */}
            {change !== undefined && (
              <motion.div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-sm",
                  trendConfig[computedTrend].bgColor,
                  trendConfig[computedTrend].color
                )}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <TrendIcon className="h-4 w-4" />
                <span className="font-medium">
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              </motion.div>
            )}
          </div>

          {/* Change label */}
          {changeLabel && change !== undefined && (
            <p className="text-xs text-muted-foreground">{changeLabel}</p>
          )}

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-4">
              <Sparkline
                data={sparklineData}
                color={
                  computedTrend === "up"
                    ? "#22c55e"
                    : computedTrend === "down"
                    ? "#ef4444"
                    : "#6366f1"
                }
              />
            </div>
          )}
        </div>
      </CardContent>
    </AnimatedCard>
  );
};

// ============================================================================
// ANALYTICS CARD GRID
// ============================================================================

interface AnalyticsCardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export const AnalyticsCardGrid: React.FC<AnalyticsCardGridProps> = ({
  children,
  columns = 4,
  className,
}) => {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
};

// ============================================================================
// COMPARISON CARD
// ============================================================================

interface ComparisonCardProps {
  title: string;
  items: Array<{
    label: string;
    value: number | string;
    color?: string;
    percentage?: number;
  }>;
  className?: string;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  title,
  items,
  className,
}) => {
  return (
    <AnimatedCard variant="default" className={className} animation="slideUp">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              {item.percentage !== undefined && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        item.color ||
                        `hsl(${(index * 60) % 360}, 70%, 50%)`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{
                      duration: 1,
                      delay: index * 0.1,
                      ease: "easeOut",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </AnimatedCard>
  );
};

export default AnalyticsCard;
