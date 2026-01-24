import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        success: false,
        message,
        error: 'Business Logic Error',
      },
      statusCode,
    );
  }
}

export class NotFoundException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;

    super(
      {
        success: false,
        message,
        error: 'Not Found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized access') {
    super(
      {
        success: false,
        message,
        error: 'Unauthorized',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Access forbidden') {
    super(
      {
        success: false,
        message,
        error: 'Forbidden',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(errors: any[]) {
    super(
      {
        success: false,
        message: 'Validation failed',
        error: 'Validation Error',
        errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(message = 'Too many requests') {
    super(
      {
        success: false,
        message,
        error: 'Rate Limit Exceeded',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
