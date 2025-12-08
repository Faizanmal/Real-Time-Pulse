import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as vm from 'vm';

interface SandboxResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  allowedModules?: string[];
}

@Injectable()
export class ScriptSandboxService {
  private readonly logger = new Logger(ScriptSandboxService.name);

  // Default timeout in milliseconds
  private readonly DEFAULT_TIMEOUT = 5000;

  // Maximum allowed execution time
  private readonly MAX_TIMEOUT = 30000;

  /**
   * Execute JavaScript code in a secure sandbox
   */
  async executeScript(
    code: string,
    context: Record<string, any> = {},
    options: SandboxOptions = {},
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const timeout = Math.min(
      options.timeout || this.DEFAULT_TIMEOUT,
      this.MAX_TIMEOUT,
    );

    try {
      // Validate code before execution
      this.validateCode(code);

      // Create sandbox context with safe globals
      const sandbox = this.createSandboxContext(context);

      // Create VM context
      const vmContext = vm.createContext(sandbox);

      // Wrap code to capture result
      const wrappedCode = `
        (async () => {
          ${code}
        })()
      `;

      // Execute in sandbox
      const script = new vm.Script(wrappedCode, {
        filename: 'user-script.js',
      });

      const result = await script.runInContext(vmContext, {
        timeout,
        displayErrors: true,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      this.logger.warn(`Script execution failed: ${error.message}`);

      return {
        success: false,
        error: this.sanitizeError(error),
        executionTime,
      };
    }
  }

  /**
   * Validate code for security issues
   */
  private validateCode(code: string): void {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/gi,
      /import\s+/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /process\s*\./gi,
      /global\s*\./gi,
      /globalThis\s*\./gi,
      /__dirname/gi,
      /__filename/gi,
      /child_process/gi,
      /fs\s*\./gi,
      /net\s*\./gi,
      /http\s*\./gi,
      /https\s*\./gi,
      /Buffer\s*\(/gi,
      /Proxy\s*\(/gi,
      /Reflect\s*\./gi,
      /constructor\s*\[/gi,
      /prototype\s*\[/gi,
      /__proto__/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new BadRequestException(
          `Code contains prohibited pattern: ${pattern.source}`,
        );
      }
    }

    // Check code length
    if (code.length > 100000) {
      throw new BadRequestException('Code exceeds maximum length limit');
    }
  }

  /**
   * Create a safe sandbox context with limited globals
   */
  private createSandboxContext(
    userContext: Record<string, any>,
  ): Record<string, any> {
    // Safe math functions
    const safeMath = {
      abs: Math.abs,
      acos: Math.acos,
      asin: Math.asin,
      atan: Math.atan,
      atan2: Math.atan2,
      ceil: Math.ceil,
      cos: Math.cos,
      exp: Math.exp,
      floor: Math.floor,
      log: Math.log,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      random: Math.random,
      round: Math.round,
      sin: Math.sin,
      sqrt: Math.sqrt,
      tan: Math.tan,
      PI: Math.PI,
      E: Math.E,
    };

    // Safe string functions
    const safeString = {
      fromCharCode: String.fromCharCode,
    };

    // Safe JSON
    const safeJSON = {
      parse: JSON.parse,
      stringify: JSON.stringify,
    };

    // Safe Array methods
    const safeArray = {
      isArray: Array.isArray,
      from: Array.from,
      of: Array.of,
    };

    // Safe Object methods
    const safeObject = {
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
      fromEntries: Object.fromEntries,
    };

    // Console (limited)
    const safeConsole = {
      log: (...args: any[]) => this.logger.debug(`[Script] ${args.join(' ')}`),
      info: (...args: any[]) => this.logger.debug(`[Script] ${args.join(' ')}`),
      warn: (...args: any[]) => this.logger.warn(`[Script] ${args.join(' ')}`),
      error: (...args: any[]) =>
        this.logger.error(`[Script] ${args.join(' ')}`),
    };

    return {
      // User provided context
      ...userContext,

      // Safe globals
      Math: safeMath,
      String: safeString,
      JSON: safeJSON,
      Array: safeArray,
      Object: safeObject,
      console: safeConsole,

      // Basic types
      undefined,
      null: null,
      true: true,
      false: false,
      NaN,
      Infinity,

      // Safe constructors
      Date,
      Number,
      Boolean,
      RegExp,
      Error,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Promise,

      // Utility functions
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,

      // Helper functions
      setTimeout: undefined, // Disabled
      setInterval: undefined, // Disabled
      setImmediate: undefined, // Disabled
    };
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeError(error: any): string {
    if (error.message?.includes('Script execution timed out')) {
      return 'Script execution timed out. Please optimize your code.';
    }

    if (error.message?.includes('Maximum call stack')) {
      return 'Maximum call stack exceeded. Check for infinite recursion.';
    }

    // Return generic error for unknown errors
    const message = error.message || 'Unknown error occurred';

    // Remove file paths and sensitive info
    return message
      .replace(/at\s+.*:\d+:\d+/g, '')
      .replace(/\/[^\s]+/g, '[path]')
      .trim();
  }

  /**
   * Validate and transform user input
   */
  validateInput(
    input: any,
    schema: Record<string, any>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = input[key];

      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${key} must be of type ${rules.type}`);
        }

        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${key} must be at least ${rules.min}`);
        }

        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${key} must be at most ${rules.max}`);
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${key} does not match required pattern`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
