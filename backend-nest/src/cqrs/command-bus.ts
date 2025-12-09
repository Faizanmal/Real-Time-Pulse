/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX COMMAND BUS
 * ============================================================================
 * Command bus implementation with middleware support, validation,
 * and transaction handling.
 */

import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

// Base Command Interface
export interface ICommand {
  readonly commandType: string;
  readonly timestamp: Date;
  readonly metadata: {
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
    traceId?: string;
  };
}

// Command Handler Interface
export interface ICommandHandler<T extends ICommand = ICommand, R = void> {
  execute(command: T): Promise<R>;
}

// Command Middleware Interface
export interface ICommandMiddleware {
  handle(command: ICommand, next: () => Promise<any>): Promise<any>;
}

// Command Result
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  correlationId?: string;
}

@Injectable()
export class CommandBus {
  private readonly logger = new Logger(CommandBus.name);
  private readonly handlers = new Map<string, Type<ICommandHandler>>();
  private readonly middlewares: ICommandMiddleware[] = [];

  constructor(private readonly moduleRef: ModuleRef) {}

  // Register a command handler
  register<T extends ICommand>(
    commandType: string,
    handler: Type<ICommandHandler<T>>,
  ): void {
    this.handlers.set(commandType, handler);
    this.logger.log(`Registered command handler for: ${commandType}`);
  }

  // Add middleware to the pipeline
  use(middleware: ICommandMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.log(`Added middleware: ${middleware.constructor.name}`);
  }

  // Execute a command
  async execute<T extends ICommand, R = void>(command: T): Promise<CommandResult<R>> {
    const startTime = Date.now();
    const correlationId = command.metadata?.correlationId || this.generateCorrelationId();

    this.logger.log({
      message: `Executing command: ${command.commandType}`,
      correlationId,
      userId: command.metadata?.userId,
    });

    try {
      // Build the middleware chain
      const executeHandler = async (): Promise<R> => {
        const handlerType = this.handlers.get(command.commandType);
        
        if (!handlerType) {
          throw new Error(`No handler found for command: ${command.commandType}`);
        }

        const handler = await this.moduleRef.resolve<ICommandHandler<T, R>>(handlerType);
        return handler.execute(command);
      };

      // Execute through middleware chain
      const result = await this.executeWithMiddleware(command, executeHandler);

      const duration = Date.now() - startTime;
      this.logger.log({
        message: `Command executed successfully: ${command.commandType}`,
        correlationId,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        correlationId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        message: `Command execution failed: ${command.commandType}`,
        correlationId,
        error: error.message,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
        correlationId,
      };
    }
  }

  // Execute command through middleware chain
  private async executeWithMiddleware<R>(
    command: ICommand,
    finalHandler: () => Promise<R>,
  ): Promise<R> {
    if (this.middlewares.length === 0) {
      return finalHandler();
    }

    let index = 0;
    const next = async (): Promise<any> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware.handle(command, next);
      }
      return finalHandler();
    };

    return next();
  }

  private generateCorrelationId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Built-in Middlewares

// Logging Middleware
export class LoggingMiddleware implements ICommandMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  async handle(command: ICommand, next: () => Promise<any>): Promise<any> {
    const start = Date.now();
    this.logger.debug(`[START] ${command.commandType}`);
    
    try {
      const result = await next();
      this.logger.debug(`[SUCCESS] ${command.commandType} (${Date.now() - start}ms)`);
      return result;
    } catch (error) {
      this.logger.error(`[FAILED] ${command.commandType} (${Date.now() - start}ms): ${error.message}`);
      throw error;
    }
  }
}

// Validation Middleware
export class ValidationMiddleware implements ICommandMiddleware {
  async handle(command: ICommand, next: () => Promise<any>): Promise<any> {
    // Validate required metadata
    if (!command.commandType) {
      throw new Error('Command must have a commandType');
    }
    
    // Could add class-validator validation here
    return next();
  }
}

// Transaction Middleware
export class TransactionMiddleware implements ICommandMiddleware {
  constructor(private readonly prisma: any) {}

  async handle(command: ICommand, next: () => Promise<any>): Promise<any> {
    // Wrap in transaction for commands that modify data
    return this.prisma.$transaction(async (tx: any) => {
      // Attach transaction to command context
      (command as any)._transaction = tx;
      return next();
    });
  }
}

// Retry Middleware
export class RetryMiddleware implements ICommandMiddleware {
  private readonly logger = new Logger(RetryMiddleware.name);

  constructor(
    private readonly maxRetries: number = 3,
    private readonly delay: number = 1000,
  ) {}

  async handle(command: ICommand, next: () => Promise<any>): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await next();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          this.logger.warn(
            `Command ${command.commandType} failed (attempt ${attempt}/${this.maxRetries}), retrying...`,
          );
          await this.sleep(this.delay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Rate Limiting Middleware
export class RateLimitMiddleware implements ICommandMiddleware {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number = 100,
    private readonly windowMs: number = 60000,
  ) {}

  async handle(command: ICommand, next: () => Promise<any>): Promise<any> {
    const key = command.metadata?.userId || 'anonymous';
    const now = Date.now();
    
    let counter = this.counters.get(key);
    
    if (!counter || counter.resetAt < now) {
      counter = { count: 0, resetAt: now + this.windowMs };
      this.counters.set(key, counter);
    }
    
    counter.count++;
    
    if (counter.count > this.limit) {
      throw new Error('Rate limit exceeded for commands');
    }
    
    return next();
  }
}
