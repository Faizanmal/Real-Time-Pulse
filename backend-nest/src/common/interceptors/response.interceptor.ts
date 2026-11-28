import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { sanitizeSensitivePath } from '../utils/sensitive-path';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        // Preserve binary downloads; wrapping StreamableFile in the JSON API
        // envelope makes Nest serialize its internals instead of streaming bytes.
        if (data instanceof StreamableFile) return data as unknown as ApiResponse<T>;
        const dataObj = data as { message?: string; data?: T } | null;
        return {
          success: true,
          statusCode: response.statusCode || HttpStatus.OK,
          message: dataObj?.message || 'Request successful',
          data: (dataObj?.data || data) as T,
          timestamp: new Date().toISOString(),
          path: sanitizeSensitivePath(request.url),
        };
      }),
    );
  }
}
