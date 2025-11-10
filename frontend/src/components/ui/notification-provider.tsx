"use client";

import { Toaster } from "sonner";
import { useEffect } from "react";
import { toast } from "sonner";

export function NotificationProvider() {
  return (
    <Toaster
      position="top-right"
      expand={true}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        },
        className: "shadow-lg",
        duration: 4000,
      }}
    />
  );
}

// Helper functions for notifications
export const notify = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
    });
  },

  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
    });
  },

  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
    });
  },

  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },

  custom: (message: string, options?: Record<string, unknown>) => {
    toast(message, options);
  },
};

// WebSocket notification listener hook
export function useWebSocketNotifications(wsUrl?: string) {
  useEffect(() => {
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "success":
            notify.success(data.title, data.message);
            break;
          case "error":
            notify.error(data.title, data.message);
            break;
          case "info":
            notify.info(data.title, data.message);
            break;
          case "warning":
            notify.warning(data.title, data.message);
            break;
          default:
            notify.custom(data.message);
        }
      } catch (error) {
        console.error("Failed to parse notification:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);
}
