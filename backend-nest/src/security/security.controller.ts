import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { SecurityService, SecuritySettings } from './security.service';
import { SsoService } from './sso.service';
import type { SsoProvider } from './sso.service';
import { TwoFactorService } from './two-factor.service';

@ApiTags('Security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly ssoService: SsoService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  // ==================== Security Settings ====================

  @Get('settings')
  @ApiOperation({ summary: 'Get security settings for workspace' })
  @ApiResponse({ status: 200, description: 'Security settings retrieved' })
  async getSecuritySettings(@CurrentUser() user: RequestUser) {
    return this.securityService.getSecuritySettings(user.workspaceId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({ status: 200, description: 'Security settings updated' })
  async updateSecuritySettings(
    @CurrentUser() user: RequestUser,
    @Body() settings: Partial<SecuritySettings>,
  ) {
    return this.securityService.updateSecuritySettings(
      user.workspaceId,
      settings,
      user.id,
    );
  }

  // ==================== Account Security ====================

  @Get('account/locked')
  @ApiOperation({ summary: 'Check if account is locked' })
  @ApiResponse({ status: 200, description: 'Account lock status' })
  async checkAccountLocked(@CurrentUser() user: RequestUser) {
    return this.securityService.isAccountLocked(user.id);
  }

  @Post('account/unlock/:userId')
  @ApiOperation({ summary: 'Unlock a user account (admin)' })
  @ApiResponse({ status: 200, description: 'Account unlocked' })
  async unlockAccount(
    @CurrentUser() user: RequestUser,
    @Param('userId') targetUserId: string,
  ) {
    await this.securityService.unlockAccount(targetUserId, user.id);
    return { success: true, message: 'Account unlocked' };
  }

  // ==================== Sessions ====================

  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved' })
  async getActiveSessions(@CurrentUser() user: RequestUser) {
    return this.securityService.getActiveSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Terminate a session' })
  @ApiResponse({ status: 200, description: 'Session terminated' })
  async terminateSession(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    await this.securityService.terminateSession(user.id, sessionId);
    return { success: true, message: 'Session terminated' };
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Terminate all sessions' })
  @ApiResponse({ status: 200, description: 'All sessions terminated' })
  async terminateAllSessions(@CurrentUser() user: RequestUser) {
    await this.securityService.terminateAllSessions(user.id);
    return { success: true, message: 'All sessions terminated' };
  }

  // ==================== Two-Factor Authentication ====================

  @Get('2fa/status')
  @ApiOperation({ summary: 'Get 2FA status' })
  @ApiResponse({ status: 200, description: '2FA status retrieved' })
  async get2FAStatus(@CurrentUser() user: RequestUser) {
    return this.twoFactorService.is2FAEnabled(user.id);
  }

  @Post('2fa/totp/setup')
  @ApiOperation({ summary: 'Initialize TOTP setup' })
  @ApiResponse({ status: 200, description: 'TOTP setup initialized' })
  async initializeTotpSetup(@CurrentUser() user: RequestUser) {
    return this.twoFactorService.initializeTotpSetup(user.id);
  }

  @Post('2fa/totp/verify')
  @ApiOperation({ summary: 'Complete TOTP setup' })
  @ApiResponse({ status: 200, description: 'TOTP enabled' })
  async completeTotpSetup(
    @CurrentUser() user: RequestUser,
    @Body('token') token: string,
  ) {
    const success = await this.twoFactorService.completeTotpSetup(
      user.id,
      token,
    );
    return {
      success,
      message: success ? 'TOTP enabled' : 'Verification failed',
    };
  }

  @Post('2fa/email/enable')
  @ApiOperation({ summary: 'Enable email-based 2FA' })
  @ApiResponse({ status: 200, description: 'Email 2FA enabled' })
  async enableEmail2FA(@CurrentUser() user: RequestUser) {
    await this.twoFactorService.enableEmail2FA(user.id);
    return { success: true, message: 'Email 2FA enabled' };
  }

  @Post('2fa/email/send')
  @ApiOperation({ summary: 'Send email verification code' })
  @ApiResponse({ status: 200, description: 'Code sent' })
  async sendEmailCode(@CurrentUser() user: RequestUser) {
    await this.twoFactorService.sendEmailCode(user.id);
    return { success: true, message: 'Verification code sent' };
  }

  @Post('2fa/email/verify')
  @ApiOperation({ summary: 'Verify email code' })
  @ApiResponse({ status: 200, description: 'Code verified' })
  async verifyEmailCode(
    @CurrentUser() user: RequestUser,
    @Body('code') code: string,
  ) {
    const success = await this.twoFactorService.verifyEmailCode(user.id, code);
    return { success, message: success ? 'Code verified' : 'Invalid code' };
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  async disable2FA(@CurrentUser() user: RequestUser) {
    await this.twoFactorService.disable2FA(user.id);
    return { success: true, message: '2FA disabled' };
  }

  @Post('2fa/backup-codes/regenerate')
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiResponse({ status: 200, description: 'Backup codes regenerated' })
  async regenerateBackupCodes(@CurrentUser() user: RequestUser) {
    const codes = await this.twoFactorService.regenerateBackupCodes(user.id);
    return { success: true, backupCodes: codes };
  }

  // ==================== SSO ====================

  @Get('sso/providers')
  @ApiOperation({ summary: 'Get SSO providers for workspace' })
  @ApiResponse({ status: 200, description: 'SSO providers retrieved' })
  async getSsoProviders(@CurrentUser() user: RequestUser) {
    return this.ssoService.getSsoProviders(user.workspaceId);
  }

  @Post('sso/providers')
  @ApiOperation({ summary: 'Configure SSO provider' })
  @ApiResponse({ status: 201, description: 'SSO provider configured' })
  async configureSsoProvider(
    @CurrentUser() user: RequestUser,
    @Body() provider: SsoProvider,
  ) {
    return this.ssoService.configureSsoProvider(
      user.workspaceId,
      provider,
      user.id,
    );
  }

  @Delete('sso/providers/:providerId')
  @ApiOperation({ summary: 'Remove SSO provider' })
  @ApiResponse({ status: 200, description: 'SSO provider removed' })
  async removeSsoProvider(
    @CurrentUser() user: RequestUser,
    @Param('providerId') providerId: string,
  ) {
    await this.ssoService.removeSsoProvider(
      user.workspaceId,
      providerId,
      user.id,
    );
    return { success: true, message: 'SSO provider removed' };
  }

  @Get('sso/login/:providerId')
  @ApiOperation({ summary: 'Initiate SSO login' })
  @ApiResponse({ status: 200, description: 'SSO login URL' })
  async initiateSsoLogin(
    @CurrentUser() user: RequestUser,
    @Param('providerId') providerId: string,
    @Query('type') type: 'oidc' | 'oauth2' = 'oidc',
  ) {
    if (type === 'oidc') {
      return this.ssoService.initiateOidcLogin(user.workspaceId, providerId);
    } else {
      return this.ssoService.initiateOAuth2Login(user.workspaceId, providerId);
    }
  }
}
