/**
 * =============================================================================
 * REAL-TIME PULSE - ULTRA-MAX HOOKS LIBRARY
 * =============================================================================
 * 
 * Custom React hooks for the enterprise platform.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { apiResources, clearCache } from "./api-client";
import { CACHE_TTL, KEYBOARD_SHORTCUTS } from "./config";

// ============================================================================
// DATA FETCHING HOOKS
// ============================================================================

/**
 * Hook to fetch current user data
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      return await apiResources.auth.me();
    },
    staleTime: CACHE_TTL.user * 1000,
    retry: false,
  });
}

/**
 * Hook to fetch workspaces
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const workspace = await apiResources.workspaces.getMyWorkspace();
      return [workspace];
    },
    staleTime: CACHE_TTL.portal * 1000,
  });
}

/**
 * Hook to fetch a single workspace
 */
export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => {
      return await apiResources.workspaces.getMyWorkspace();
    },
    enabled: !!id,
    staleTime: CACHE_TTL.portal * 1000,
  });
}

/**
 * Hook to fetch portals for a workspace
 */
export function usePortals(workspaceId: string | undefined, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["portals", workspaceId, page, limit],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      return await apiResources.portals.getAll(page, limit);
    },
    enabled: !!workspaceId,
    staleTime: CACHE_TTL.portal * 1000,
  });
}

/**
 * Hook to fetch a single portal
 */
export function usePortal(id: string | undefined) {
  return useQuery({
    queryKey: ["portal", id],
    queryFn: async () => {
      if (!id) throw new Error("Portal ID required");
      return await apiResources.portals.getOne(id);
    },
    enabled: !!id,
    staleTime: CACHE_TTL.widget * 1000,
  });
}

/**
 * Hook to fetch widgets for a portal
 */
export function useWidgets(portalId: string | undefined) {
  return useQuery({
    queryKey: ["widgets", portalId],
    queryFn: async () => {
      if (!portalId) throw new Error("Portal ID required");
      return await apiResources.widgets.getAllByPortal(portalId);
    },
    enabled: !!portalId,
    staleTime: CACHE_TTL.widget * 1000,
  });
}

/**
 * Hook to fetch dashboard analytics
 */
export function useDashboardAnalytics(
  workspaceId: string | undefined,
  dateRange?: { from: string; to: string }
) {
  return useQuery({
    queryKey: ["analytics", "dashboard", workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      return await apiResources.analytics.getDashboard(workspaceId, dateRange);
    },
    enabled: !!workspaceId,
    staleTime: CACHE_TTL.analytics * 1000,
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch AI insights
 */
export function useAIInsights(portalId: string | undefined) {
  return useQuery({
    queryKey: ["ai-insights", portalId],
    queryFn: async () => {
      if (!portalId) throw new Error("Portal ID required");
      return await apiResources.aiInsights.getInsights(portalId);
    },
    enabled: !!portalId,
    staleTime: CACHE_TTL.analytics * 1000,
  });
}

/**
 * Hook to fetch workspace-level AI insights
 */
export function useWorkspaceAIInsights(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["ai-insights", "workspace", workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      return await apiResources.aiInsights.getWorkspaceInsights(workspaceId);
    },
    enabled: !!workspaceId,
    staleTime: CACHE_TTL.analytics * 1000,
  });
}

/**
 * Hook to fetch AI recommendations
 */
export function useAIRecommendations(portalId: string | undefined) {
  return useQuery({
    queryKey: ["ai-recommendations", portalId],
    queryFn: async () => {
      if (!portalId) throw new Error("Portal ID required");
      return await apiResources.aiInsights.getRecommendations(portalId);
    },
    enabled: !!portalId,
    staleTime: CACHE_TTL.analytics * 1000,
  });
}

/**
 * Hook to fetch anomalies
 */
export function useAnomalies(workspaceId: string | undefined, days: number = 7) {
  return useQuery({
    queryKey: ["ai-anomalies", workspaceId, days],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      return await apiResources.aiInsights.getAnomalies(workspaceId, days);
    },
    enabled: !!workspaceId,
    staleTime: CACHE_TTL.analytics * 1000,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to create a new portal
 */
export function useCreatePortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      return await apiResources.portals.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    },
  });
}

/**
 * Hook to update a portal
 */
export function useUpdatePortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      return await apiResources.portals.update(id, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portal", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    },
  });
}

/**
 * Hook to delete a portal
 */
export function useDeletePortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiResources.portals.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    },
  });
}

/**
 * Hook to create a widget
 */
export function useCreateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      portalId: string;
      integrationId?: string;
      config?: Record<string, unknown>;
      gridWidth?: number;
      gridHeight?: number;
      gridX?: number;
      gridY?: number;
      refreshInterval?: number;
    }) => {
      return await apiResources.widgets.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}

/**
 * Hook to update a widget
 */
export function useUpdateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      // Use the widgets API to update
      const response = await fetch(`/api/widgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update widget');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}

/**
 * Hook to refresh widget data
 */
export function useRefreshWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetId: string) => {
      return await apiResources.widgets.refreshData(widgetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}
// UI HOOKS
// ============================================================================

/**
 * Hook for debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttled callback
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 500
): T {
  const lastCall = React.useRef<number>(0);
  const lastCallTimer = React.useRef<NodeJS.Timeout | null>(null);

  return React.useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall.current;

      if (timeSinceLastCall >= delay) {
        lastCall.current = now;
        callback(...args);
      } else {
        if (lastCallTimer.current) {
          clearTimeout(lastCallTimer.current);
        }
        lastCallTimer.current = setTimeout(() => {
          lastCall.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: ("ctrl" | "meta" | "shift" | "alt")[] = []
) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, shiftKey, altKey } = event;

      const modifierMatch =
        (modifiers.includes("ctrl") ? ctrlKey : !ctrlKey || modifiers.includes("meta")) &&
        (modifiers.includes("meta") ? metaKey : !metaKey || modifiers.includes("ctrl")) &&
        (modifiers.includes("shift") ? shiftKey : !shiftKey) &&
        (modifiers.includes("alt") ? altKey : !altKey);

      if (event.key.toLowerCase() === key.toLowerCase() && modifierMatch) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, callback, modifiers]);
}

/**
 * Hook for local storage state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

/**
 * Hook for session storage state
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error("Error saving to sessionStorage:", error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

/**
 * Hook to detect clicks outside an element
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void
): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback]);

  return ref;
}

/**
 * Hook to detect window size
 */
export function useWindowSize() {
  const [size, setSize] = React.useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  React.useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

/**
 * Hook for media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

/**
 * Hook for responsive breakpoints
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const isLargeDesktop = useMediaQuery("(min-width: 1440px)");

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    breakpoint: isMobile ? "mobile" : isTablet ? "tablet" : isLargeDesktop ? "xl" : "desktop",
  };
}

/**
 * Hook for intersection observer (lazy loading, infinite scroll)
 */
export function useIntersectionObserver<T extends HTMLElement>(
  options?: IntersectionObserverInit
): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * Hook for copy to clipboard
 */
export function useCopyToClipboard(): [
  string | null,
  (text: string) => Promise<boolean>
] {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const copy = React.useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      console.warn("Clipboard not supported");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
      return true;
    } catch (error) {
      console.error("Failed to copy:", error);
      setCopiedText(null);
      return false;
    }
  }, []);

  return [copiedText, copy];
}

/**
 * Hook for previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = React.useRef<T | undefined>(undefined);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/**
 * Hook for mounted state
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Hook for async state
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [state, setState] = React.useState<{
    loading: boolean;
    error: Error | null;
    data: T | null;
  }>({
    loading: true,
    error: null,
    data: null,
  });

  React.useEffect(() => {
    let mounted = true;

    setState((prev) => ({ ...prev, loading: true }));

    asyncFn()
      .then((data) => {
        if (mounted) {
          setState({ loading: false, error: null, data });
        }
      })
      .catch((error) => {
        if (mounted) {
          setState({ loading: false, error, data: null });
        }
      });

    return () => {
      mounted = false;
    };
  }, deps);

  return state;
}

/**
 * Hook for toggle state
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = React.useState(initialValue);
  const toggle = React.useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

/**
 * Hook for counter
 */
export function useCounter(initialValue: number = 0) {
  const [count, setCount] = React.useState(initialValue);

  return {
    count,
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
    reset: () => setCount(initialValue),
    set: setCount,
  };
}

export default {
  useCurrentUser,
  useWorkspaces,
  useWorkspace,
  usePortals,
  usePortal,
  useWidgets,
  useDashboardAnalytics,
  useAIInsights,
  useCreatePortal,
  useUpdatePortal,
  useDeletePortal,
  useCreateWidget,
  useUpdateWidget,
  useDebounce,
  useThrottle,
  useKeyboardShortcut,
  useLocalStorage,
  useSessionStorage,
  useClickOutside,
  useWindowSize,
  useMediaQuery,
  useBreakpoint,
  useIntersectionObserver,
  useCopyToClipboard,
  usePrevious,
  useMounted,
  useAsync,
  useToggle,
  useCounter,
};
