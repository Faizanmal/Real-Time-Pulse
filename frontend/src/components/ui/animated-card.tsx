"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { ReactNode } from "react";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "gradient" | "glass" | "hover-lift" | "border-glow";
  hoverScale?: number;
  className?: string;
}

const variantStyles = {
  default: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
  gradient: "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-500/20",
  glass: "bg-white/10 dark:bg-gray-900/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20",
  "hover-lift": "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1",
  "border-glow": "bg-white dark:bg-gray-800 border-2 border-transparent hover:border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]",
};

export function AnimatedCard({
  children,
  variant = "default",
  hoverScale = 1.02,
  className,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: hoverScale }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "rounded-xl p-6 shadow-lg transition-all duration-300",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className={cn("mb-4", className)}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-2xl font-bold tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function AnimatedCardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-gray-500 dark:text-gray-400", className)}>
      {children}
    </p>
  );
}

export function AnimatedCardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={cn("space-y-4", className)}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn("mt-6 flex items-center justify-between", className)}
    >
      {children}
    </motion.div>
  );
}
