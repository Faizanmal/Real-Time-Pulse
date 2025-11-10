"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { ReactNode, useState } from "react";
import { Plus } from "lucide-react";

interface FloatingAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  actions: FloatingAction[];
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  mainIcon?: ReactNode;
  className?: string;
}

const positionStyles = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
};

export function FloatingActionButton({
  actions,
  position = "bottom-right",
  mainIcon,
  className,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("fixed z-50", positionStyles[position], className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4 space-y-3"
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3"
              >
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 + 0.1 }}
                  className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
                >
                  {action.label}
                </motion.span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors",
                    action.color ||
                      "bg-purple-600 text-white hover:bg-purple-700"
                  )}
                >
                  {action.icon}
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white shadow-2xl hover:shadow-purple-500/50"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {mainIcon || <Plus className="h-6 w-6" />}
        </motion.div>
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
