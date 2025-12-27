import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const TRACE_METADATA_KEY = 'trace_operation';

export interface TraceMetadata {
  operationName: string;
  sensitiveFields?: string[];
  logResult?: boolean;
}

/**
 * Decorator for tracing and logging operations
 * Adds correlation ID tracking and operation timing
 *
 * @param operationName - Name of the operation for logging
 * @param options - Additional tracing options
 */
export function Trace(
  operationName: string,
  options?: { sensitiveFields?: string[]; logResult?: boolean },
): MethodDecorator & ClassDecorator {
  const metadata: TraceMetadata = {
    operationName,
    sensitiveFields: options?.sensitiveFields || [],
    logResult: options?.logResult ?? false,
  };

  return applyDecorators(
    SetMetadata(TRACE_METADATA_KEY, metadata),
    ApiHeader({
      name: 'X-Correlation-ID',
      description: 'Request correlation ID for tracing',
      required: false,
    }),
  );
}

/**
 * Decorator to mark fields as sensitive (will be masked in logs)
 */
export const SENSITIVE_FIELDS_KEY = 'sensitive_fields';

export function SensitiveData(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingFields =
      Reflect.getMetadata(SENSITIVE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      SENSITIVE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor,
    );
  };
}
