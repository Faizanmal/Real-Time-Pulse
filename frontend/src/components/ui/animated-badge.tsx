"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { ReactNode } from "react";

interface AnimatedBadgeProps extends Omit<HTMLMotionProps<"span">, "children"> {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "gradient" | "pulse";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  gradient: "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white",
  pulse: "bg-purple-600 text-white",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

const dotColors = {
  default: "bg-gray-400",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  gradient: "bg-purple-500",
  pulse: "bg-white",
};

export function AnimatedBadge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className,
  ...props
}: AnimatedBadgeProps) {
  const badge = (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <motion.span
          animate={variant === "pulse" ? { scale: [1, 1.3, 1] } : {}}
          transition={
            variant === "pulse"
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          className={cn("h-2 w-2 rounded-full", dotColors[variant])}
        />
      )}
      {children}
    </motion.span>
  );

  if (variant === "pulse") {
    return (
      <motion.div
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(168, 85, 247, 0.7)",
            "0 0 0 10px rgba(168, 85, 247, 0)",
          ],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="inline-block rounded-full"
      >
        {badge}
      </motion.div>
    );
  }

  return badge;
}

export function StatusBadge({
  status,
  className,
}: {
  status: "online" | "offline" | "away" | "busy";
  className?: string;
}) {
  const statusConfig = {
    online: { variant: "success" as const, label: "Online" },
    offline: { variant: "default" as const, label: "Offline" },
    away: { variant: "warning" as const, label: "Away" },
    busy: { variant: "error" as const, label: "Busy" },
  };

  const config = statusConfig[status];

  return (
    <AnimatedBadge
      variant={config.variant}
      dot
      className={className}
    >
      {config.label}
    </AnimatedBadge>
  );
}

export function CountBadge({
  count,
  max = 99,
  className,
}: {
  count: number;
  max?: number;
  className?: string;
}) {
  const displayCount = count > max ? `${max}+` : count;

  return (
    <AnimatedBadge
      variant="error"
      size="sm"
      className={cn("min-w-[1.25rem] justify-center", className)}
    >
      {displayCount}
    </AnimatedBadge>
  );
}
