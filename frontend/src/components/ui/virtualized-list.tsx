'use client';

import Image from 'next/image';

/**
 * ============================================================================
 * VIRTUALIZED LIST COMPONENT
 * ============================================================================
 * High-performance virtualized list for rendering large datasets efficiently.
 * Only renders items visible in the viewport plus a buffer.
 */

import React, { 
  useRef, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  ReactNode,
  CSSProperties
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  overscan?: number;
  className?: string;
  containerHeight?: number | string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  scrollToIndex?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  className,
  containerHeight = '100%',
  onEndReached,
  endReachedThreshold = 100,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  keyExtractor,
  scrollToIndex,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState(0);

  // Calculate item height (fixed or variable)
  const getItemHeight = useCallback(
    (index: number): number => {
      if (typeof itemHeight === 'function') {
        return itemHeight(index, items[index]);
      }
      return itemHeight;
    },
    [itemHeight, items]
  );

  // Calculate total height and item positions
  const { totalHeight, itemPositions } = useMemo(() => {
    let totalHeight = 0;
    const positions: number[] = [];

    for (let i = 0; i < items.length; i++) {
      positions.push(totalHeight);
      totalHeight += getItemHeight(i);
    }

    return { totalHeight, itemPositions: positions };
  }, [items, getItemHeight]);

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) return { startIndex: 0, endIndex: 0 };

    // Binary search for start index
    let start = 0;
    let end = items.length - 1;
    
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (itemPositions[mid] < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    const startIndex = Math.max(0, start - overscan);

    // Find end index
    let endIdx = start;
    const viewportEnd = scrollTop + containerSize;
    
    while (endIdx < items.length && itemPositions[endIdx] < viewportEnd) {
      endIdx++;
    }

    const endIndex = Math.min(items.length - 1, endIdx + overscan);

    return { startIndex, endIndex };
  }, [items.length, itemPositions, scrollTop, containerSize, overscan]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);

      // Check if end reached
      if (onEndReached) {
        const isNearEnd =
          target.scrollHeight - target.scrollTop - target.clientHeight < endReachedThreshold;
        if (isNearEnd && !isLoading) {
          onEndReached();
        }
      }
    },
    [onEndReached, endReachedThreshold, isLoading]
  );

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerSize(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Scroll to index
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      const position = itemPositions[scrollToIndex] || 0;
      containerRef.current.scrollTop = position;
    }
  }, [scrollToIndex, itemPositions]);

  // Generate key for item
  const getKey = useCallback(
    (item: T, index: number): string => {
      if (keyExtractor) {
        return keyExtractor(item, index);
      }
      return String(index);
    },
    [keyExtractor]
  );

  // Render visible items
  const visibleItems = useMemo(() => {
    const result: ReactNode[] = [];

    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      const item = items[i];
      const height = getItemHeight(i);
      const style: CSSProperties = {
        position: 'absolute',
        top: itemPositions[i],
        left: 0,
        right: 0,
        height,
      };

      result.push(
        <div key={getKey(item, i)} style={style}>
          {renderItem(item, i, style)}
        </div>
      );
    }

    return result;
  }, [startIndex, endIndex, items, getItemHeight, itemPositions, getKey, renderItem]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: containerHeight }}>
        {emptyComponent || (
          <div className="text-center py-12 text-gray-500">
            <p>No items to display</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn('overflow-auto relative', className)}
      style={{ height: containerHeight }}
      role="list"
      aria-label="Virtualized list"
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute bottom-0 left-0 right-0 py-4 flex justify-center">
          {loadingComponent || (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ==================== LAZY LOADING UTILITIES ====================

interface UseLazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook for lazy loading elements when they enter the viewport
 */
export function useLazyLoad(options: UseLazyLoadOptions = {}) {
  const { threshold = 0.1, rootMargin = '100px', triggerOnce = true } = options;
  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasLoaded(true);
          
          if (triggerOnce) {
            observer.disconnect();
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return { ref: elementRef, isVisible, hasLoaded };
}

/**
 * Lazy load wrapper component
 */
export function LazyLoad({
  children,
  placeholder,
  className,
  ...options
}: UseLazyLoadOptions & {
  children: ReactNode;
  placeholder?: ReactNode;
  className?: string;
}) {
  const { ref, isVisible, hasLoaded } = useLazyLoad(options);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {hasLoaded ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isVisible ? 1 : 0.5 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      ) : (
        placeholder || (
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-full w-full min-h-[100px]" />
        )
      )}
    </div>
  );
}

// ==================== IMAGE OPTIMIZATION ====================

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized image component with lazy loading and blur-up effect
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { ref: lazyRef, isVisible } = useLazyLoad({ triggerOnce: true });

  useEffect(() => {
    if (priority && imgRef.current) {
      imgRef.current.loading = 'eager';
    }
  }, [priority]);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  const shouldLoad = priority || isVisible;

  return (
    <div
      ref={lazyRef as React.RefObject<HTMLDivElement>}
      className={cn('relative overflow-hidden', className)}
      style={{ width, height }}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataURL && !loaded && (
        <Image
          src={blurDataURL}
          alt=""
          fill
          className="object-cover filter blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Loading placeholder */}
      {!loaded && !error && placeholder === 'empty' && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}

      {/* Actual image */}
      {shouldLoad && (
        <motion.img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'w-full h-full object-cover',
            error && 'hidden'
          )}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-gray-400 text-sm">Failed to load</span>
        </div>
      )}
    </div>
  );
}

// ==================== CACHE UTILITIES ====================

interface CacheOptions {
  maxAge?: number; // milliseconds
  maxSize?: number; // number of entries
}

class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number }>;
  private maxAge: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxAge = options.maxAge || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 100;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global data cache
export const dataCache = new LRUCache<unknown>({ maxAge: 5 * 60 * 1000, maxSize: 100 });

/**
 * Hook for caching data with automatic invalidation
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & { revalidateOnFocus?: boolean } = {}
) {
  const [data, setData] = useState<T | undefined>(() => dataCache.get(key) as T | undefined);
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!force && dataCache.has(key)) {
      setData(dataCache.get(key) as T);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      dataCache.set(key, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Revalidate on focus
  useEffect(() => {
    if (!options.revalidateOnFocus) return;

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData, options.revalidateOnFocus]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, isLoading, error, refetch };
}

const virtualizedListUtils = {
  VirtualizedList,
  LazyLoad,
  OptimizedImage,
  useLazyLoad,
  useCachedData,
  dataCache,
};

export default virtualizedListUtils;
