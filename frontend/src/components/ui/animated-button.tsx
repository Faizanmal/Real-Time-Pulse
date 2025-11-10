"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "default" | "gradient" | "outline" | "ghost" | "destructive" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  default: "bg-purple-600 text-white hover:bg-purple-700 shadow-lg hover:shadow-xl",
  gradient: "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white shadow-lg hover:shadow-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700",
  outline: "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950",
  ghost: "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950",
  destructive: "bg-red-600 text-white hover:bg-red-700 shadow-lg",
  glow: "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)]",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
  icon: "p-2",
};

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      children,
      variant = "default",
      size = "md",
      loading = false,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || loading ? 1 : 1.05 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-4 w-4" />
          </motion.div>
        )}
        <motion.span
          initial={{ opacity: 1 }}
          animate={{ opacity: loading ? 0.7 : 1 }}
        >
          {children}
        </motion.span>
      </motion.button>
    );
  }
);

AnimatedButton.displayName = "AnimatedButton";

export function PulseButton({
  children,
  className,
  ...props
}: Omit<AnimatedButtonProps, "variant">) {
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
      className="inline-block rounded-lg"
    >
      <AnimatedButton variant="gradient" className={className} {...props}>
        {children}
      </AnimatedButton>
    </motion.div>
  );
}
