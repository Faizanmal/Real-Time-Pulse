"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { AnimatedButton } from "./animated-button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full"
            >
              {/* Error Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="flex justify-center mb-6"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
                  >
                    <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
                  </motion.div>
                  {/* Pulse rings */}
                  <motion.div
                    animate={{
                      scale: [1, 1.5],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className="absolute inset-0 rounded-full border-2 border-red-500"
                  />
                </div>
              </motion.div>

              {/* Error Card */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700"
              >
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Oops! Something went wrong
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  We encountered an unexpected error. Don&apos;t worry, we&apos;re on it!
                </p>

                {/* Error Details (Development) */}
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800"
                  >
                    <p className="text-sm font-mono text-red-800 dark:text-red-200 break-all">
                      {this.state.error.message}
                    </p>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <AnimatedButton
                    variant="gradient"
                    onClick={() => window.location.reload()}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </AnimatedButton>
                  <AnimatedButton
                    variant="outline"
                    onClick={() => (window.location.href = "/")}
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </AnimatedButton>
                </div>
              </motion.div>

              {/* Decorative Elements */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
                <motion.div
                  animate={{
                    y: [0, -20, 0],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute top-10 left-10 w-20 h-20 rounded-full bg-purple-200/30 dark:bg-purple-700/20 blur-xl"
                />
                <motion.div
                  animate={{
                    y: [0, 20, 0],
                    rotate: [360, 0],
                  }}
                  transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute bottom-10 right-10 w-32 h-32 rounded-full bg-pink-200/30 dark:bg-pink-700/20 blur-xl"
                />
              </div>
            </motion.div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
