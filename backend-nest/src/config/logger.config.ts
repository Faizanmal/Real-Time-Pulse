import { registerAs } from '@nestjs/config';

export default registerAs('logger', () => ({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json', // json or simple
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  dirname: process.env.LOG_DIR || 'logs',
}));
