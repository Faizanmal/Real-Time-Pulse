import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation - requests flow through
  OPEN = 'OPEN', // Circuit broken - requests fail immediately
  HALF_OPEN = 'HALF_OPEN', // Testing - limited requests allowed
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before moving from open to half-open
  monitoringWindow: number; // Time window for tracking failures
}

interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
  totalRequests: number;
  failedRequests: number;
}

interface Circuit {
  state: CircuitState;
  metrics: CircuitMetrics;
  options: CircuitBreakerOptions;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds
  monitoringWindow: 60000, // 1 minute
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, Circuit> = new Map();

  /**
   * Execute a function with circuit breaker protection
   * @param circuitName - Unique identifier for the circuit
   * @param fn - The async function to execute
   * @param options - Circuit breaker configuration
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>,
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName, options);

    // Check if we should allow the request
    if (!this.canExecute(circuit, circuitName)) {
      this.logger.warn(`Circuit ${circuitName} is OPEN - request rejected`);
      throw new CircuitBreakerOpenError(
        `Service ${circuitName} is temporarily unavailable`,
        this.getTimeUntilRetry(circuit),
      );
    }

    try {
      const result = await fn();
      this.recordSuccess(circuit, circuitName);
      return result;
    } catch (error) {
      this.recordFailure(circuit, circuitName);
      throw error;
    }
  }

  /**
   * Get the current state of a circuit
   */
  getCircuitState(circuitName: string): CircuitState | null {
    const circuit = this.circuits.get(circuitName);
    return circuit?.state ?? null;
  }

  /**
   * Get metrics for a circuit
   */
  getCircuitMetrics(circuitName: string): CircuitMetrics | null {
    const circuit = this.circuits.get(circuitName);
    return circuit?.metrics ?? null;
  }

  /**
   * Get all circuit statuses
   */
  getAllCircuitStatuses(): Record<string, { state: CircuitState; metrics: CircuitMetrics }> {
    const statuses: Record<string, { state: CircuitState; metrics: CircuitMetrics }> = {};
    for (const [name, circuit] of this.circuits) {
      statuses[name] = {
        state: circuit.state,
        metrics: circuit.metrics,
      };
    }
    return statuses;
  }

  /**
   * Manually reset a circuit to closed state
   */
  resetCircuit(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.metrics = this.createEmptyMetrics();
      this.logger.log(`Circuit ${circuitName} manually reset to CLOSED`);
    }
  }

  private getOrCreateCircuit(
    circuitName: string,
    options?: Partial<CircuitBreakerOptions>,
  ): Circuit {
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        state: CircuitState.CLOSED,
        metrics: this.createEmptyMetrics(),
        options: { ...DEFAULT_OPTIONS, ...options },
      });
    }
    return this.circuits.get(circuitName)!;
  }

  private createEmptyMetrics(): CircuitMetrics {
    return {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
      totalRequests: 0,
      failedRequests: 0,
    };
  }

  private canExecute(circuit: Circuit, circuitName: string): boolean {
    const now = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has passed to transition to half-open
        if (now - circuit.metrics.lastStateChange >= circuit.options.timeout) {
          this.transitionState(circuit, CircuitState.HALF_OPEN, circuitName);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  private recordSuccess(circuit: Circuit, circuitName: string): void {
    circuit.metrics.successes++;
    circuit.metrics.totalRequests++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.metrics.successes >= circuit.options.successThreshold) {
        this.transitionState(circuit, CircuitState.CLOSED, circuitName);
      }
    }

    // Reset failure count in monitoring window
    this.cleanupOldMetrics(circuit);
  }

  private recordFailure(circuit: Circuit, circuitName: string): void {
    const now = Date.now();
    circuit.metrics.failures++;
    circuit.metrics.failedRequests++;
    circuit.metrics.totalRequests++;
    circuit.metrics.lastFailureTime = now;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.transitionState(circuit, CircuitState.OPEN, circuitName);
    } else if (circuit.state === CircuitState.CLOSED) {
      // Check if we've exceeded the failure threshold
      if (circuit.metrics.failures >= circuit.options.failureThreshold) {
        this.transitionState(circuit, CircuitState.OPEN, circuitName);
      }
    }
  }

  private transitionState(
    circuit: Circuit,
    newState: CircuitState,
    circuitName: string,
  ): void {
    const oldState = circuit.state;
    circuit.state = newState;
    circuit.metrics.lastStateChange = Date.now();

    if (newState === CircuitState.CLOSED) {
      circuit.metrics = this.createEmptyMetrics();
    }

    this.logger.log(
      `Circuit ${circuitName} transitioned from ${oldState} to ${newState}`,
    );
  }

  private cleanupOldMetrics(circuit: Circuit): void {
    const now = Date.now();
    const windowStart = now - circuit.options.monitoringWindow;

    // Reset failures if outside monitoring window
    if (circuit.metrics.lastFailureTime < windowStart) {
      circuit.metrics.failures = 0;
    }
  }

  private getTimeUntilRetry(circuit: Circuit): number {
    const timeSinceStateChange = Date.now() - circuit.metrics.lastStateChange;
    return Math.max(0, circuit.options.timeout - timeSinceStateChange);
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
