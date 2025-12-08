"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes, ReactNode, useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";

export interface AnimatedInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: "default" | "filled" | "outline" | "underline";
  clearable?: boolean;
  onClear?: () => void;
}

const variantStyles = {
  default: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20",
  filled: "border-0 bg-gray-100 dark:bg-gray-700 focus:ring-4 focus:ring-purple-500/20",
  outline: "border-2 border-gray-300 dark:border-gray-600 bg-transparent focus:border-purple-500",
  underline: "border-0 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent focus:border-purple-500 rounded-none px-0",
};

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      variant = "default",
      clearable = false,
      onClear,
      className,
      type = "text",
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className="w-full space-y-2">
        {label && (
          <motion.label
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </motion.label>
        )}

        <motion.div
          animate={{
            scale: focused ? 1.01 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              "w-full px-4 py-2.5 rounded-lg transition-all duration-200 outline-none",
              "placeholder:text-gray-400 text-gray-900 dark:text-gray-100",
              variantStyles[variant],
              leftIcon && "pl-10",
              (rightIcon || clearable || isPassword) && "pr-10",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {clearable && props.value && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClear}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}

            {isPassword && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </motion.button>
            )}

            {rightIcon && !isPassword && !clearable && (
              <div className="text-gray-400">{rightIcon}</div>
            )}
          </div>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

AnimatedInput.displayName = "AnimatedInput";

export function SearchInput({
  placeholder = "Search...",
  ...props
}: Omit<AnimatedInputProps, "leftIcon" | "type">) {
  return (
    <AnimatedInput
      type="search"
      leftIcon={<Search className="h-4 w-4" />}
      placeholder={placeholder}
      clearable
      {...props}
    />
  );
}
