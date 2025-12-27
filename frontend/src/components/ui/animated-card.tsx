"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "gradient" | "glass" | "hover-lift" | "border-glow" | "premium";
  hoverScale?: number;
  className?: string;
  animation?: string;
  padding?: "default" | "sm" | "lg";
  size?: string;
  interactive?: boolean;
  index?: number;
}

const variantStyles = {
  default: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
  gradient: "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-500/20",
  glass: "bg-white/10 dark:bg-gray-900/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20",
  "hover-lift": "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1",
  "border-glow": "bg-white dark:bg-gray-800 border-2 border-transparent hover:border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]",
  premium: "bg-gradient-to-br from-yellow-400/10 via-orange-500/10 to-red-500/10 backdrop-blur-sm border border-yellow-500/30 shadow-xl",
};

const paddingStyles = {
  default: "p-6",
  sm: "p-4",
  lg: "p-8",
};

const animationVariants = {
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
  },
};

export function AnimatedCard({
  children,
  variant = "default",
  hoverScale = 1.02,
  className,
  animation,
  padding = "default",
  ...props
}: AnimatedCardProps) {
  const motionProps = animation && animationVariants[animation as keyof typeof animationVariants]
    ? animationVariants[animation as keyof typeof animationVariants]
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <motion.div
      {...motionProps}
      whileHover={{ scale: hoverScale }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "rounded-xl shadow-lg transition-all duration-300",
        paddingStyles[padding],
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
  size,
  variant,
}: {
  children: ReactNode;
  className?: string;
  size?: string;
  variant?: string;
}) {
  const sizeClasses = {
    default: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <h3 className={cn("font-bold tracking-tight", sizeClasses[size as keyof typeof sizeClasses] || "text-2xl", className)}>
      {children}
    </h3>
  );
}

export function AnimatedCardDescription({
  children,
  className,
  variant,
}: {
  children: ReactNode;
  className?: string;
  variant?: string;
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
  variant,
}: {
  children: ReactNode;
  className?: string;
  variant?: string;
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

// Aliases for compatibility
export const CardHeader = AnimatedCardHeader;
export const CardTitle = AnimatedCardTitle;
export const CardDescription = AnimatedCardDescription;
export const CardContent = AnimatedCardContent;
export const CardBadge = AnimatedCardFooter; // Assuming CardBadge is the footer
