"use client";

import { motion } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { ReactNode, useState } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  badge?: number | string;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: "default" | "pills" | "underline";
  className?: string;
}

export function AnimatedTabs({
  tabs,
  defaultTab,
  onChange,
  variant = "default",
  className,
}: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  const variantStyles = {
    default: {
      container: "bg-gray-100 dark:bg-gray-800 p-1 rounded-lg",
      tab: "px-4 py-2 rounded-md",
      activeTab: "bg-white dark:bg-gray-700 shadow-sm",
    },
    pills: {
      container: "gap-2",
      tab: "px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600",
      activeTab: "bg-purple-600 text-white border-purple-600",
    },
    underline: {
      container: "border-b border-gray-200 dark:border-gray-700",
      tab: "px-4 py-3 border-b-2 border-transparent",
      activeTab: "border-purple-600 text-purple-600",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn("w-full", className)}>
      {/* Tab List */}
      <div className={cn("flex items-center", styles.container)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 font-medium transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
                styles.tab,
                isActive
                  ? styles.activeTab
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {tab.icon && (
                <motion.span
                  initial={{ rotate: 0 }}
                  animate={{ rotate: isActive ? 360 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {tab.icon}
                </motion.span>
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-1 rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white"
                >
                  {tab.badge}
                </motion.span>
              )}
              {isActive && variant !== "underline" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 -z-10 rounded-md bg-white dark:bg-gray-700 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="mt-6"
      >
        {activeTabContent}
      </motion.div>
    </div>
  );
}
