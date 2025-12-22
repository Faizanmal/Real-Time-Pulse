import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';
import { CollaborationGateway } from './collaboration.gateway';
import type { UserPresence } from './collaboration.gateway';
import type {
  ActivityLog,
  WidgetChange,
  ChatMessage,
} from './collaboration.service';
import type { RequestUser } from '../common/interfaces/auth.interface';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly collaborationGateway: CollaborationGateway,
  ) {}

  @Get('portal/:portalId/users')
  @ApiOperation({ summary: 'Get active users in a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  async getPortalUsers(
    @Param('portalId') portalId: string,
  ): Promise<{ success: boolean; users: UserPresence[]; count: number }> {
    const users = this.collaborationGateway.getPortalUsers(portalId);
    return {
      success: true,
      users,
      count: users.length,
    };
  }

  @Get('portal/:portalId/activity')
  @ApiOperation({ summary: 'Get activity feed for a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of activities to return',
  })
  async getActivityFeed(
    @Param('portalId') portalId: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; activities: ActivityLog[] }> {
    const activities = await this.collaborationService.getActivityFeed(
      portalId,
      limit || 50,
    );
    return {
      success: true,
      activities,
    };
  }

  @Get('portal/:portalId/history')
  @ApiOperation({ summary: 'Get change history for a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of changes to return',
  })
  async getChangeHistory(
    @Param('portalId') portalId: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; history: WidgetChange[] }> {
    const history = await this.collaborationService.getChangeHistory(
      portalId,
      limit || 50,
    );
    return {
      success: true,
      history,
    };
  }

  @Get('portal/:portalId/chat')
  @ApiOperation({ summary: 'Get chat messages for a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of messages to return',
  })
  async getChatMessages(
    @Param('portalId') portalId: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; messages: ChatMessage[] }> {
    const messages = await this.collaborationService.getChatMessages(
      portalId,
      limit || 100,
    );
    return {
      success: true,
      messages,
    };
  }

  @Get('portal/:portalId/stats')
  @ApiOperation({ summary: 'Get collaboration statistics for a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  async getCollaborationStats(@Param('portalId') portalId: string) {
    const stats =
      await this.collaborationService.getCollaborationStats(portalId);
    return {
      success: true,
      stats,
    };
  }

  @Delete('portal/:portalId/data')
  @ApiOperation({
    summary: 'Clear collaboration data for a portal (admin only)',
  })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  async clearCollaborationData(
    @Param('portalId') portalId: string,
    @Request() req: any,
  ) {
    const user = req.user as RequestUser;

    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
      throw new ForbiddenException('Admin role required to clear data');
    }

    const hasAccess = await this.collaborationService.verifyPortalAccess(
      user.id,
      user.workspaceId,
      portalId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Portal not found in your workspace');
    }

    await this.collaborationService.clearCollaborationData(portalId);
    return {
      success: true,
      message: 'Collaboration data cleared',
    };
  }
}
