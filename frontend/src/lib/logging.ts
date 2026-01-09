'use client';

/**
 * ============================================================================
 * PRODUCTION LOGGING & PERFORMANCE MONITORING
 * ============================================================================
 * Client-side logging, performance tracking, and analytics utilities
 * for production-ready monitoring.
 */

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Log entry structure
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

// Performance metric types
export type MetricType = 
  | 'page_load'
  | 'api_request'
  | 'component_render'
  | 'user_interaction'
  | 'resource_load'
  | 'navigation'
  | 'custom';

// Performance metric structure
export interface PerformanceMetric {
  type: MetricType;
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Web Vitals metrics
export interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  FCP?: number; // First Contentful Paint
  INP?: number; // Interaction to Next Paint
}

// Session management
let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  
  if (typeof window !== 'undefined') {
    sessionId = sessionStorage.getItem('pulse_session_id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('pulse_session_id', sessionId);
    }
  }
  
  return sessionId || 'unknown';
}

// Get user ID from auth storage
function getUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed?.state?.user?.id;
    }
  } catch {
    return undefined;
  }
  
  return undefined;
}

// Log buffer for batching
const logBuffer: LogEntry[] = [];
const metricsBuffer: PerformanceMetric[] = [];
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds

// Flush buffers to backend
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;
  
  const logs = [...logBuffer];
  logBuffer.length = 0;
  
  try {
    if (process.env.NODE_ENV === 'production') {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
        keepalive: true, // Ensure request completes even if page unloads
      });
    }
  } catch {
    // Re-add logs if flush failed
    logBuffer.unshift(...logs);
  }
}

async function flushMetrics(): Promise<void> {
  if (metricsBuffer.length === 0) return;
  
  const metrics = [...metricsBuffer];
  metricsBuffer.length = 0;
  
  try {
    if (process.env.NODE_ENV === 'production') {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
        keepalive: true,
      });
    }
  } catch {
    // Re-add metrics if flush failed
    metricsBuffer.unshift(...metrics);
  }
}

// Initialize flush intervals
if (typeof window !== 'undefined') {
  setInterval(flushLogs, FLUSH_INTERVAL);
  setInterval(flushMetrics, FLUSH_INTERVAL);
  
  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushLogs();
    flushMetrics();
  });
  
  // Flush on visibility change (tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushLogs();
      flushMetrics();
    }
  });
}

// Logger class
class Logger {
  private context?: string;
  private minLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(context?: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private createEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date(),
      context: this.context,
      data,
      userId: getUserId(),
      sessionId: getSessionId(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    
    const entry = this.createEntry(level, message, data);
    
    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = this.context ? `[${this.context}]` : '';
      const timestamp = entry.timestamp.toISOString();
      
      switch (level) {
        case 'debug':
          console.debug(`🔍 ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'info':
          console.info(`ℹ️ ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'warn':
          console.warn(`⚠️ ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'error':
        case 'fatal':
          console.error(`🚨 ${timestamp} ${prefix}`, message, data || '');
          break;
      }
    }
    
    // Buffer for production
    logBuffer.push(entry);
    
    // Flush if buffer is full
    if (logBuffer.length >= BUFFER_SIZE) {
      flushLogs();
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log('fatal', message, data);
    // Immediately flush on fatal errors
    flushLogs();
  }

  // Create child logger with additional context
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext);
  }
}

// Default logger instance
export const logger = new Logger();

// Create logger with context
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Performance monitoring class
class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  
  // Start a performance mark
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  // End a performance mark and record the metric
  measure(name: string, type: MetricType = 'custom', metadata?: Record<string, unknown>): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      logger.warn(`Performance mark "${name}" not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.marks.delete(name);
    
    this.recordMetric({
      type,
      name,
      duration,
      timestamp: new Date(),
      metadata,
    });
    
    return duration;
  }

  // Record a performance metric
  recordMetric(metric: PerformanceMetric): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance: ${metric.name} - ${metric.duration.toFixed(2)}ms`, metric.metadata || '');
    }
    
    metricsBuffer.push(metric);
    
    if (metricsBuffer.length >= BUFFER_SIZE) {
      flushMetrics();
    }
  }

  // Track API request performance
  trackApiRequest(url: string, method: string, duration: number, status: number): void {
    this.recordMetric({
      type: 'api_request',
      name: `${method} ${url}`,
      duration,
      timestamp: new Date(),
      metadata: { url, method, status },
    });
  }

  // Track component render time
  trackRender(componentName: string, duration: number): void {
    this.recordMetric({
      type: 'component_render',
      name: componentName,
      duration,
      timestamp: new Date(),
    });
  }

  // Track user interaction
  trackInteraction(action: string, element: string, duration?: number): void {
    this.recordMetric({
      type: 'user_interaction',
      name: action,
      duration: duration || 0,
      timestamp: new Date(),
      metadata: { element },
    });
  }

  // Collect Web Vitals
  collectWebVitals(): void {
    if (typeof window === 'undefined') return;
    
    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.recordMetric({
        type: 'page_load',
        name: 'LCP',
        duration: lastEntry.startTime,
        timestamp: new Date(),
      });
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming;
        this.recordMetric({
          type: 'user_interaction',
          name: 'FID',
          duration: fidEntry.processingStart - fidEntry.startTime,
          timestamp: new Date(),
        });
      }
    }).observe({ type: 'first-input', buffered: true });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShiftEntry = entry as LayoutShift;
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // Report CLS on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.recordMetric({
          type: 'page_load',
          name: 'CLS',
          duration: clsValue,
          timestamp: new Date(),
        });
      }
    });

    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navEntry) {
          this.recordMetric({
            type: 'navigation',
            name: 'TTFB',
            duration: navEntry.responseStart,
            timestamp: new Date(),
          });
          
          this.recordMetric({
            type: 'page_load',
            name: 'domContentLoaded',
            duration: navEntry.domContentLoadedEventEnd,
            timestamp: new Date(),
          });
          
          this.recordMetric({
            type: 'page_load',
            name: 'loadComplete',
            duration: navEntry.loadEventEnd,
            timestamp: new Date(),
          });
        }
      }, 0);
    });
  }
}

// Types for PerformanceObserver entries
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Default performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Hook for tracking component performance
export function usePerformanceTracking(componentName: string) {
  const startTime = performance.now();
  
  return {
    trackRender: () => {
      const duration = performance.now() - startTime;
      performanceMonitor.trackRender(componentName, duration);
    },
    trackInteraction: (action: string) => {
      performanceMonitor.trackInteraction(action, componentName);
    },
  };
}

// Initialize Web Vitals collection
if (typeof window !== 'undefined') {
  // Delay to ensure page has loaded
  setTimeout(() => {
    performanceMonitor.collectWebVitals();
  }, 0);
}

const loggingUtils = {
  logger,
  createLogger,
  performanceMonitor,
  usePerformanceTracking,
};

export default loggingUtils;
