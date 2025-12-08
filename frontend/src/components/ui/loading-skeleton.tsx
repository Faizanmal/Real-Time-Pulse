"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "circular" | "text" | "rectangular";
  animation?: "pulse" | "wave" | "none";
}

export function LoadingSkeleton({
  className,
  variant = "default",
  animation = "pulse",
}: SkeletonProps) {
  const variantStyles = {
    default: "rounded-md",
    circular: "rounded-full aspect-square",
    text: "rounded h-4",
    rectangular: "rounded-lg",
  };

  const animationVariants = {
    pulse: {
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    wave: {
      backgroundPosition: ["200% 0", "-200% 0"],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear" as const,
      },
    },
    none: {},
  };

  return (
    <motion.div
      animate={animationVariants[animation]}
      className={cn(
        "bg-linear-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700",
        variantStyles[variant],
        animation === "wave" && "bg-[length:200%_100%]",
        className
      )}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 p-6", className)}>
      <div className="flex items-center space-x-4">
        <LoadingSkeleton variant="circular" className="h-12 w-12" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton variant="text" className="w-3/4" />
          <LoadingSkeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <LoadingSkeleton variant="rectangular" className="h-32" />
      <div className="space-y-2">
        <LoadingSkeleton variant="text" className="w-full" />
        <LoadingSkeleton variant="text" className="w-5/6" />
        <LoadingSkeleton variant="text" className="w-4/6" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <LoadingSkeleton key={i} variant="text" className="h-6 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingSkeleton key={colIndex} variant="text" className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
            <LoadingSkeleton variant="text" className="w-1/2" />
            <LoadingSkeleton variant="text" className="h-8 w-3/4" />
            <LoadingSkeleton variant="text" className="w-1/3" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <LoadingSkeleton variant="text" className="w-1/4 h-6" />
        <LoadingSkeleton variant="rectangular" className="h-80" />
      </div>

      {/* Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
