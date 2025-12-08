import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly VERIFY_URL =
    'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verify reCAPTCHA v3 token
   */
  async verifyToken(
    token: string,
    expectedAction?: string,
    remoteIp?: string,
  ): Promise<{ valid: boolean; score?: number; errors?: string[] }> {
    const enabled = this.configService.get<boolean>(
      'security.recaptcha.enabled',
    );

    if (!enabled) {
      return { valid: true };
    }

    const secretKey = this.configService.get<string>(
      'security.recaptcha.secretKey',
    );

    if (!secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured');
      return { valid: true };
    }

    try {
      const params = new URLSearchParams();
      params.append('secret', secretKey);
      params.append('response', token);
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await firstValueFrom(
        this.httpService.post<RecaptchaResponse>(
          this.VERIFY_URL,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      const data = response.data;

      if (!data.success) {
        return {
          valid: false,
          errors: data['error-codes'] || ['verification-failed'],
        };
      }

      // Verify action matches (for reCAPTCHA v3)
      if (expectedAction && data.action !== expectedAction) {
        return {
          valid: false,
          score: data.score,
          errors: ['action-mismatch'],
        };
      }

      // Check score threshold
      const minScore =
        this.configService.get<number>('security.recaptcha.minScore') || 0.5;
      if (data.score !== undefined && data.score < minScore) {
        this.logger.warn(`reCAPTCHA score too low: ${data.score}`);
        return {
          valid: false,
          score: data.score,
          errors: ['score-too-low'],
        };
      }

      return {
        valid: true,
        score: data.score,
      };
    } catch (error) {
      this.logger.error('reCAPTCHA verification failed', error);
      // Fail open in case of service issues (configurable)
      return {
        valid: true,
        errors: ['service-error'],
      };
    }
  }

  /**
   * Validate reCAPTCHA and throw if invalid
   */
  async validateOrThrow(
    token: string,
    action?: string,
    remoteIp?: string,
  ): Promise<void> {
    const result = await this.verifyToken(token, action, remoteIp);

    if (!result.valid) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'reCAPTCHA verification failed',
          errors: result.errors,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get the site key for frontend
   */
  getSiteKey(): string | null {
    const enabled = this.configService.get<boolean>(
      'security.recaptcha.enabled',
    );
    if (!enabled) return null;

    return this.configService.get<string>('security.recaptcha.siteKey') || null;
  }
}
