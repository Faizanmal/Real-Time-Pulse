import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  /**
   * Execute a function with exponential backoff retry logic
   * @param fn - The async function to execute
   * @param options - Retry configuration
   */
  async withRetry<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry this error
        if (opts.retryableErrors && !opts.retryableErrors(lastError)) {
          throw lastError;
        }

        // Don't retry if we've exhausted all attempts
        if (attempt > opts.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, opts);

        this.logger.warn({
          message: `Retry attempt ${attempt}/${opts.maxRetries}`,
          error: lastError.message,
          nextRetryIn: `${delay}ms`,
        });

        // Call retry callback if provided
        if (opts.onRetry) {
          opts.onRetry(lastError, attempt);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Execute multiple operations with retry, collecting results
   * @param operations - Array of async functions
   * @param options - Retry configuration
   */
  async withRetryBatch<T>(
    operations: Array<() => Promise<T>>,
    options?: Partial<RetryOptions>,
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];

    for (const operation of operations) {
      try {
        const result = await this.withRetry(operation, options);
        results.push(result);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return { results, errors };
  }

  /**
   * Execute operations in parallel with retry for each
   * @param operations - Array of async functions
   * @param options - Retry configuration
   * @param concurrency - Max concurrent operations
   */
  async withRetryParallel<T>(
    operations: Array<() => Promise<T>>,
    options?: Partial<RetryOptions>,
    concurrency = 5,
  ): Promise<PromiseSettledResult<T>[]> {
    const chunks = this.chunkArray(operations, concurrency);
    const results: PromiseSettledResult<T>[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(chunk.map((op) => this.withRetry(op, options)));
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Create a retry wrapper for a function
   * Returns a new function that automatically retries on failure
   */
  createRetryableFunction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options?: Partial<RetryOptions>,
  ): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => this.withRetry(() => fn(...args), options);
  }

  /**
   * Check if an error is a network error (typically retryable)
   */
  isNetworkError(error: Error): boolean {
    const networkErrorMessages = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'socket hang up',
      'network error',
      'timeout',
    ];

    return networkErrorMessages.some(
      (msg) =>
        error.message.toLowerCase().includes(msg.toLowerCase()) ||
        (error as NodeJS.ErrnoException).code === msg,
    );
  }

  /**
   * Check if an HTTP status code indicates a retryable error
   */
  isRetryableStatusCode(statusCode: number): boolean {
    // Retry on server errors (5xx) and some client errors
    return (
      statusCode >= 500 ||
      statusCode === 429 || // Too Many Requests
      statusCode === 408 || // Request Timeout
      statusCode === 503 // Service Unavailable
    );
  }

  private calculateDelay(attempt: number, opts: RetryOptions): number {
    // Exponential backoff
    const exponentialDelay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);

    // Add jitter (±25% randomization)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at max delay
    return Math.min(delayWithJitter, opts.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
