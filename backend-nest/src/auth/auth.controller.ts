import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response, Request } from 'express';

import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { AuthService, Session } from './auth.service';
import {
  SignUpDto,
  SignInDto,
  ResetPasswordRequestDto,
  ResetPasswordDto,
  SessionAuthResponseDto,
  FirebaseAuthDto,
} from './dto/auth.dto';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FirebaseAuthService } from './services/firebase-auth.service';
import { isTrustedSessionRequest } from './session-security.util';

const THROTTLE_CONFIG = { default: { limit: 5, ttl: 900000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly firebaseAuthService: FirebaseAuthService,
  ) {}

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path,
    };
  }

  private setSessionCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken?: string },
  ): void {
    response.cookie('pulse_access', tokens.accessToken, {
      ...this.cookieOptions('/'),
      maxAge: 15 * 60 * 1000,
    });
    if (tokens.refreshToken) {
      response.cookie('pulse_refresh', tokens.refreshToken, {
        ...this.cookieOptions('/api/v1/auth'),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Referrer-Policy', 'no-referrer');
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie('pulse_access', this.cookieOptions('/'));
    response.clearCookie('pulse_refresh', this.cookieOptions('/api/v1/auth'));
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
  }

  private assertSessionRequest(request: Request): void {
    const origin = request.headers.origin;
    const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!isTrustedSessionRequest(origin, request.headers['x-csrf-token'], configuredOrigins)) {
      throw new ForbiddenException('Untrusted session request');
    }
  }

  @Post('signup')
  @Throttle(THROTTLE_CONFIG) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: SessionAuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async signUp(
    @Body() dto: SignUpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!this.legacyTokenResponsesEnabled()) this.assertSessionRequest(request);
    const result = await this.authService.signUp(dto, { ip, userAgent });
    if (this.legacyTokenResponsesEnabled()) return result;
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_CONFIG) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'User signed in successfully',
    type: SessionAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async signIn(
    @Body() dto: SignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!this.legacyTokenResponsesEnabled()) this.assertSessionRequest(request);
    const result = await this.authService.signIn(dto, { ip, userAgent });
    if (this.legacyTokenResponsesEnabled()) return result;
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('session/signup')
  @Throttle(THROTTLE_CONFIG)
  @ApiResponse({ status: 201, type: SessionAuthResponseDto })
  async sessionSignUp(
    @Body() dto: SignUpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.assertSessionRequest(request);
    const result = await this.authService.signUp(dto, { ip, userAgent });
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('session/signin')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_CONFIG)
  @ApiResponse({ status: 200, type: SessionAuthResponseDto })
  async sessionSignIn(
    @Body() dto: SignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.assertSessionRequest(request);
    const result = await this.authService.signIn(dto, { ip, userAgent });
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('session/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async sessionRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.assertSessionRequest(request);
    const refreshToken =
      typeof request.cookies?.pulse_refresh === 'string'
        ? request.cookies.pulse_refresh
        : undefined;
    if (!refreshToken) throw new UnauthorizedException('Session expired');
    const result = await this.authService.refreshToken(refreshToken, { ip, userAgent });
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('session/logout')
  @HttpCode(HttpStatus.OK)
  async sessionLogout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertSessionRequest(request);
    const accessToken =
      typeof request.cookies?.pulse_access === 'string' ? request.cookies.pulse_access : undefined;
    const refreshToken =
      typeof request.cookies?.pulse_refresh === 'string'
        ? request.cookies.pulse_refresh
        : undefined;
    await this.authService.logout(undefined, accessToken, refreshToken);
    this.clearSessionCookies(response);
    return { message: 'Session closed' };
  }

  // ==================== GOOGLE OAUTH ====================

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth consent screen',
  })
  @ApiResponse({ status: 500, description: 'Google OAuth not configured' })
  async googleAuth() {
    // The guard handles the redirect to Google
    // If we reach here without redirect, credentials might be missing
    // This is handled by the GoogleAuthGuard
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: Request & { user: Parameters<AuthService['googleAuth']>[0] },
    @Res() res: Response,
  ) {
    const result = await this.authService.googleAuth(req.user, {
      ip: req.ip || '127.0.0.1',
      userAgent: req.get?.('user-agent') || 'unknown',
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    this.setSessionCookies(res, result);
    res.redirect(303, `${frontendUrl.split(',')[0]}/auth/callback?provider=google`);
  }

  // ==================== GITHUB OAUTH ====================

  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  async githubAuth() {
    // Initiates GitHub OAuth flow
  }

  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'Handle GitHub OAuth callback' })
  async githubAuthCallback(
    @Req() req: Request & { user: Parameters<AuthService['githubAuth']>[0] },
    @Res() res: Response,
  ) {
    const result = await this.authService.githubAuth(req.user, {
      ip: req.ip || '127.0.0.1',
      userAgent: req.get?.('user-agent') || 'unknown',
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    this.setSessionCookies(res, result);
    res.redirect(303, `${frontendUrl.split(',')[0]}/auth/callback?provider=github`);
  }

  // ==================== FIREBASE AUTH ====================

  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate with Firebase ID token' })
  @ApiResponse({
    status: 200,
    description: 'User authenticated successfully',
    type: SessionAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid Firebase token' })
  async firebaseAuth(
    @Body() dto: FirebaseAuthDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!this.legacyTokenResponsesEnabled()) this.assertSessionRequest(request);
    const result = await this.authService.firebaseAuth(dto.idToken, { ip, userAgent });
    if (this.legacyTokenResponsesEnabled()) return result;
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  // ==================== PASSWORD RESET ====================

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent if account exists',
  })
  async requestPasswordReset(@Body() dto: ResetPasswordRequestDto, @Ip() ip: string) {
    await this.authService.requestPasswordReset(dto.email, ip);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_CONFIG)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset successfully' };
  }

  // ==================== SESSION MANAGEMENT ====================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentUser(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (this.legacyTokenResponsesEnabled()) {
      return this.authService.refreshToken(refreshToken, { ip, userAgent });
    }
    this.assertSessionRequest(request);
    const cookieRefreshToken =
      typeof request.cookies?.pulse_refresh === 'string'
        ? request.cookies.pulse_refresh
        : undefined;
    if (!cookieRefreshToken) throw new UnauthorizedException('Session expired');
    const result = await this.authService.refreshToken(cookieRefreshToken, { ip, userAgent });
    this.setSessionCookies(response, result);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Headers('authorization') authHeader: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accessCookie =
      typeof request.cookies?.pulse_access === 'string' ? request.cookies.pulse_access : undefined;
    const refreshCookie =
      typeof request.cookies?.pulse_refresh === 'string'
        ? request.cookies.pulse_refresh
        : undefined;
    const cookieSession = Boolean(accessCookie);
    if (cookieSession) this.assertSessionRequest(request);
    const token = authHeader?.replace('Bearer ', '');
    await this.authService.logout(user.id, accessCookie || token, refreshCookie);
    if (cookieSession) this.clearSessionCookies(response);
    return { message: 'Logged out successfully' };
  }

  private legacyTokenResponsesEnabled(): boolean {
    const enabled = process.env.AUTH_LEGACY_TOKEN_RESPONSES === 'true';
    if (enabled && process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException('Legacy token responses are disabled in production');
    }
    return enabled;
  }

  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout from all sessions' })
  @ApiResponse({ status: 200, description: 'Logged out from all sessions' })
  async logoutAll(@CurrentUser() user: RequestUser) {
    await this.authService.logoutAllSessions(user.id);
    return { message: 'Logged out from all sessions' };
  }

  // ==================== SECURITY ENDPOINTS ====================

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getActiveSessions(@CurrentUser() user: RequestUser): Promise<Session[]> {
    return this.authService.getActiveSessions(user.id);
  }

  @Get('security/recaptcha-key')
  @ApiOperation({ summary: 'Get reCAPTCHA site key for frontend' })
  @ApiResponse({ status: 200, description: 'reCAPTCHA site key' })
  getRecaptchaSiteKey(): { siteKey: string | null; enabled: boolean } {
    return this.authService.getRecaptchaSiteKey();
  }
}
