import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggingService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(private configService: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const logLevel = this.configService.get<string>('logger.level', 'info');
    const logFormat = this.configService.get<string>('logger.format', 'json');
    const logDir = this.configService.get<string>('logger.dirname', 'logs');

    // Custom format
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      }),
    );

    const formats = [customFormat];

    if (logFormat === 'json') {
      formats.push(winston.format.json());
    } else {
      formats.push(
        winston.format.printf(
          ({ timestamp, level, message, context, metadata }) => {
            const ctx = context ? `[${context}]` : '';
            const meta = Object.keys(metadata || {}).length
              ? `\n${JSON.stringify(metadata, null, 2)}`
              : '';
            return `${timestamp} [${level.toUpperCase()}] ${ctx} ${message}${meta}`;
          },
        ),
      );
    }

    // Transport for rotating files
    const fileRotateTransport = new DailyRotateFile({
      filename: `${logDir}/application-%DATE%.log`,
      datePattern: this.configService.get<string>(
        'logger.datePattern',
        'YYYY-MM-DD',
      ),
      maxSize: this.configService.get<string>('logger.maxSize', '20m'),
      maxFiles: this.configService.get<string>('logger.maxFiles', '14d'),
      format: winston.format.combine(...formats),
    });

    const errorFileRotateTransport = new DailyRotateFile({
      filename: `${logDir}/error-%DATE%.log`,
      datePattern: this.configService.get<string>(
        'logger.datePattern',
        'YYYY-MM-DD',
      ),
      level: 'error',
      maxSize: this.configService.get<string>('logger.maxSize', '20m'),
      maxFiles: this.configService.get<string>('logger.maxFiles', '14d'),
      format: winston.format.combine(...formats),
    });

    this.logger = winston.createLogger({
      level: logLevel,
      transports: [
        fileRotateTransport,
        errorFileRotateTransport,
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              const ctx = context ? `[${context}]` : '';
              return `${timestamp} ${level} ${ctx} ${message}`;
            }),
          ),
        }),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      trace,
    });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Additional method for structured logging
  logWithMetadata(
    level: string,
    message: string,
    metadata?: Record<string, any>,
    context?: string,
  ) {
    this.logger.log(level, message, {
      context: context || this.context,
      ...metadata,
    });
  }
}
