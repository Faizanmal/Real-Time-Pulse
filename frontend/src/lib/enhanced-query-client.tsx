/**
 * =============================================================================
 * REAL-TIME PULSE - ENHANCED QUERY CLIENT
 * =============================================================================
 * 
 * Enhanced React Query configuration with intelligent cache invalidation,
 * hydration handling, and devtools integration.
 */

'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// QUERY CLIENT FACTORY
// ============================================================================

/**
 * Create an enhanced query client with optimized defaults
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: how long data is considered fresh
        staleTime: 60 * 1000, // 1 minute
        
        // Cache time: how long unused data stays in cache
        gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
        
        // Retry configuration
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error instanceof Error && 'status' in error) {
            const status = (error as any).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch configuration
        refetchOnMount: true,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        
        // Network mode
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
        networkMode: 'online',
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show toast for background refetch errors
        if (query.state.data !== undefined) {
          console.error('Background refetch error:', error);
          toast.error('Failed to refresh data', {
            description: 'Using cached data. Will retry shortly.',
          });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // Log mutation errors
        console.error('Mutation error:', {
          error,
          mutationKey: mutation.options.mutationKey,
        });
      },
    }),
  });
}

// ============================================================================
// QUERY CLIENT PROVIDER
// ============================================================================

interface EnhancedQueryProviderProps {
  children: ReactNode;
  showDevtools?: boolean;
}

export function EnhancedQueryProvider({ 
  children, 
  showDevtools = process.env.NODE_ENV === 'development',
}: EnhancedQueryProviderProps) {
  // Create query client only once (per component instance)
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}

// ============================================================================
// CACHE INVALIDATION UTILITIES
// ============================================================================

/**
 * Invalidation patterns for different entity types
 */
export const invalidationPatterns = {
  // User-related invalidations
  user: (userId?: string) => [
    ['user', userId].filter(Boolean),
    ['users'],
    ['profile'],
  ],
  
  // Workspace invalidations
  workspace: (workspaceId?: string) => [
    ['workspace', workspaceId].filter(Boolean),
    ['workspaces'],
    ['members', workspaceId].filter(Boolean),
  ],
  
  // Portal invalidations
  portal: (portalId?: string, workspaceId?: string) => [
    ['portal', portalId].filter(Boolean),
    ['portals', workspaceId].filter(Boolean),
    ['portals'],
    ['widgets', portalId].filter(Boolean),
  ],
  
  // Widget invalidations
  widget: (widgetId?: string, portalId?: string) => [
    ['widget', widgetId].filter(Boolean),
    ['widgets', portalId].filter(Boolean),
    ['widgets'],
  ],
  
  // Integration invalidations
  integration: (integrationId?: string, workspaceId?: string) => [
    ['integration', integrationId].filter(Boolean),
    ['integrations', workspaceId].filter(Boolean),
    ['integrations'],
    ['integration-data', integrationId].filter(Boolean),
  ],
  
  // Alert invalidations
  alert: (alertId?: string, workspaceId?: string) => [
    ['alert', alertId].filter(Boolean),
    ['alerts', workspaceId].filter(Boolean),
    ['alerts'],
  ],
  
  // AI insights invalidations
  aiInsights: (portalId?: string, workspaceId?: string) => [
    ['ai-insights', portalId].filter(Boolean),
    ['ai-insights', workspaceId].filter(Boolean),
    ['ai-insights'],
  ],
};

/**
 * Hook for invalidating related queries
 */
export function useInvalidateQueries() {
  const invalidate = useCallback(
    async (
      queryClient: QueryClient,
      entityType: keyof typeof invalidationPatterns,
      ...ids: (string | undefined)[]
    ) => {
      const patterns = invalidationPatterns[entityType](...ids);
      
      await Promise.all(
        patterns.map((pattern) =>
          queryClient.invalidateQueries({ queryKey: pattern }),
        ),
      );
    },
    [],
  );

  return { invalidate };
}

// ============================================================================
// HYDRATION UTILITIES
// ============================================================================

/**
 * Safe hydration wrapper to prevent SSR/client mismatch
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  // This runs only on the client after hydration
  if (typeof window !== 'undefined' && !isHydrated) {
    setIsHydrated(true);
  }

  return isHydrated;
}

/**
 * Component wrapper that only renders on client
 */
interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isHydrated = useHydration();
  
  if (!isHydrated) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// ============================================================================
// PREFETCHING UTILITIES
// ============================================================================

/**
 * Prefetch data on hover/focus for faster navigation
 */
export function usePrefetchOnHover<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    enabled?: boolean;
  },
) {
  const prefetch = useCallback(() => {
    if (options?.enabled === false) return;
    
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: options?.staleTime ?? 60 * 1000,
    });
  }, [queryClient, queryKey, queryFn, options?.staleTime, options?.enabled]);

  return {
    onMouseEnter: prefetch,
    onFocus: prefetch,
  };
}

// ============================================================================
// QUERY STATE UTILITIES
// ============================================================================

/**
 * Combine multiple query states into a single state
 */
export function combineQueryStates(...queries: { isLoading: boolean; isError: boolean; error?: unknown }[]) {
  return {
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    errors: queries.filter((q) => q.isError).map((q) => q.error),
  };
}

/**
 * Create a query key factory for consistent key generation
 */
export function createQueryKeyFactory<TParams extends Record<string, unknown>>(
  base: string,
) {
  return {
    all: () => [base] as const,
    lists: () => [base, 'list'] as const,
    list: (params: Partial<TParams>) => [base, 'list', params] as const,
    details: () => [base, 'detail'] as const,
    detail: (id: string) => [base, 'detail', id] as const,
    detailWithParams: (id: string, params: Partial<TParams>) =>
      [base, 'detail', id, params] as const,
  };
}

// ============================================================================
// EXAMPLE QUERY KEY FACTORIES
// ============================================================================

export const portalKeys = createQueryKeyFactory<{ workspaceId: string; status?: string }>('portals');
export const widgetKeys = createQueryKeyFactory<{ portalId: string; type?: string }>('widgets');
export const integrationKeys = createQueryKeyFactory<{ workspaceId: string; provider?: string }>('integrations');
export const alertKeys = createQueryKeyFactory<{ workspaceId: string; status?: string }>('alerts');
export const userKeys = createQueryKeyFactory<{ workspaceId: string; role?: string }>('users');
