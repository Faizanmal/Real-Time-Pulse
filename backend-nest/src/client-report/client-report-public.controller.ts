import { Body, Controller, ForbiddenException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { ShareLinksService } from '../share-links/share-links.service';

import { ClientReportService } from './client-report.service';

@ApiTags('Client Reports')
@Controller('share-links/public/:token/client-reports')
@UseGuards(OptionalJwtAuthGuard)
export class ClientReportPublicController {
  constructor(
    private readonly reports: ClientReportService,
    private readonly shareLinks: ShareLinksService,
  ) {}

  @Post('list')
  @ApiOperation({ summary: 'List delivered report revisions for an assigned client portal' })
  async list(
    @Param('token') token: string,
    @Body() body: { password?: string } | undefined,
    @Req() request: Request & { user?: RequestUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
    const user = request.user;
    if (!user) throw new ForbiddenException('Sign in with the assigned client account to view reports');
    const link = await this.shareLinks.requireAssignedReportCapability(token, body?.password, user.id);
    return this.reports.listDeliveredPortalReports(link.portalId, link.portal.workspaceId);
  }
}
