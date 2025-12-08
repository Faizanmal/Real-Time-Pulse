"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ArrowUp, ArrowDown, TrendingUp } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  description?: string;
  className?: string;
  variant?: "default" | "gradient" | "glass";
}

const variantStyles = {
  default: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
  gradient: "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-500/20",
  glass: "bg-white/10 dark:bg-gray-900/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20",
};

export function StatsCard({
  title,
  value,
  change,
  icon,
  trend,
  description,
  className,
  variant = "default",
}: StatsCardProps) {
  const getTrendColor = () => {
    if (trend === "up") return "text-green-600 dark:text-green-400";
    if (trend === "down") return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getTrendIcon = () => {
    if (trend === "up") return <ArrowUp className="h-4 w-4" />;
    if (trend === "down") return <ArrowDown className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-6 shadow-lg transition-shadow hover:shadow-xl",
        variantStyles[variant],
        className
      )}
    >
      {/* Background Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl" />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          {icon && (
            <motion.div
              initial={{ rotate: 0, scale: 1 }}
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
            >
              {icon}
            </motion.div>
          )}
        </div>

        {/* Value */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {value}
          </h3>
        </motion.div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {change !== undefined && (
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}
            >
              {getTrendIcon()}
              <span>{Math.abs(change)}%</span>
            </motion.div>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Animated Border */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="absolute inset-0 rounded-xl bg-linear-to-r from-purple-500 via-pink-500 to-blue-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
      </motion.div>
    </motion.div>
  );
}

export function StatsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
