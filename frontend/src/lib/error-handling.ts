'use client';

/**
 * ============================================================================
 * PRODUCTION-READY API ERROR HANDLING UTILITIES
 * ============================================================================
 * Comprehensive error handling for API requests with retry logic,
 * offline support, and user-friendly error messages.
 */

import { AxiosError, AxiosResponse } from 'axios';

// Error types for better categorization
export type ApiErrorType =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'unknown';

// Structured API error
export interface ApiError {
  type: ApiErrorType;
  message: string;
  userMessage: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: Date;
  requestId?: string;
}

// User-friendly error messages
const USER_FRIENDLY_MESSAGES: Record<ApiErrorType, string> = {
  network: 'Unable to connect to the server. Please check your internet connection.',
  authentication: 'Your session has expired. Please sign in again.',
  authorization: 'You don\'t have permission to perform this action.',
  validation: 'Please check your input and try again.',
  not_found: 'The requested resource was not found.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong on our end. We\'re working on it.',
  timeout: 'The request took too long. Please try again.',
  unknown: 'An unexpected error occurred. Please try again.',
};

// Categorize error based on response
function categorizeError(error: AxiosError): ApiErrorType {
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'timeout';
    }
    return 'network';
  }

  const status = error.response.status;

  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';

  return 'unknown';
}

// Parse API error into structured format
export function parseApiError(error: unknown): ApiError {
  const timestamp = new Date();

  if (error instanceof AxiosError) {
    const type = categorizeError(error);
    const response = error.response;
    const data = response?.data as Record<string, unknown> | undefined;

    return {
      type,
      message: data?.message as string || error.message,
      userMessage: data?.userMessage as string || USER_FRIENDLY_MESSAGES[type],
      statusCode: response?.status,
      details: data,
      retryable: ['network', 'timeout', 'server', 'rate_limit'].includes(type),
      timestamp,
      requestId: response?.headers?.['x-request-id'],
    };
  }

  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message,
      userMessage: USER_FRIENDLY_MESSAGES.unknown,
      retryable: false,
      timestamp,
    };
  }

  return {
    type: 'unknown',
    message: String(error),
    userMessage: USER_FRIENDLY_MESSAGES.unknown,
    retryable: false,
    timestamp,
  };
}

// Retry configuration
interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: ApiError) => boolean;
  onRetry?: (attempt: number, delay: number) => void;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error) => error.retryable,
  onRetry: () => {},
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// Wait for specified duration
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for async functions
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry, onRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseApiError(error);

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay, maxDelay);
      onRetry(attempt + 1, delay);
      await wait(delay);
    }
  }

  throw lastError;
}

// Offline queue for requests made while offline
interface QueuedRequest {
  id: string;
  fn: () => Promise<unknown>;
  timestamp: Date;
  retryCount: number;
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<(queue: QueuedRequest[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.processQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  add(fn: () => Promise<unknown>): string {
    const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      fn,
      timestamp: new Date(),
      retryCount: 0,
    });
    this.notifyListeners();
    return id;
  }

  remove(id: string): void {
    this.queue = this.queue.filter(req => req.id !== id);
    this.notifyListeners();
  }

  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) return;

    const queue = [...this.queue];
    this.queue = [];

    for (const request of queue) {
      try {
        await request.fn();
      } catch (error) {
        const apiError = parseApiError(error);
        if (apiError.retryable && request.retryCount < 3) {
          request.retryCount++;
          this.queue.push(request);
        }
      }
    }

    this.notifyListeners();
  }

  subscribe(listener: (queue: QueuedRequest[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const queue = this.getQueue();
    this.listeners.forEach(listener => listener(queue));
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}

export const offlineQueue = new OfflineQueue();

// Hook for offline-aware requests
export function useOfflineAwareRequest() {
  const execute = async <T>(
    fn: () => Promise<T>,
    options?: { queueIfOffline?: boolean }
  ): Promise<T | null> => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline && options?.queueIfOffline) {
      offlineQueue.add(fn as () => Promise<unknown>);
      return null;
    }

    return fn();
  };

  return { execute };
}

// Error toast configuration
export interface ErrorToastConfig {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

// Generate toast config from API error
export function getErrorToast(error: ApiError): ErrorToastConfig {
  const baseConfig: ErrorToastConfig = {
    title: 'Error',
    description: error.userMessage,
    duration: 5000,
  };

  switch (error.type) {
    case 'authentication':
      return {
        ...baseConfig,
        title: 'Session Expired',
        action: {
          label: 'Sign In',
          onClick: () => {
            window.location.href = '/auth/login';
          },
        },
      };
    case 'network':
      return {
        ...baseConfig,
        title: 'Connection Error',
        action: {
          label: 'Retry',
          onClick: () => {
            window.location.reload();
          },
        },
        duration: 10000,
      };
    case 'rate_limit':
      return {
        ...baseConfig,
        title: 'Slow Down',
        duration: 10000,
      };
    case 'validation':
      return {
        ...baseConfig,
        title: 'Invalid Input',
        duration: 7000,
      };
    default:
      return baseConfig;
  }
}

// Format validation errors from API response
export function formatValidationErrors(
  errors: Record<string, string[]> | undefined
): string[] {
  if (!errors) return [];

  return Object.entries(errors).flatMap(([field, messages]) =>
    messages.map(message => `${field}: ${message}`)
  );
}

// Check if error is of specific type
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'userMessage' in error
  );
}

// Safe JSON parse for error responses
export function safeParseErrorResponse(response: AxiosResponse | undefined): Record<string, unknown> | null {
  if (!response?.data) return null;

  try {
    if (typeof response.data === 'string') {
      return JSON.parse(response.data);
    }
    return response.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default {
  parseApiError,
  withRetry,
  offlineQueue,
  getErrorToast,
  formatValidationErrors,
  isApiError,
};
