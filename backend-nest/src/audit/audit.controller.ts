import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import type { AuditAction } from '@prisma/client';
@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}
  @Get()
  @ApiOperation({ summary: 'Get audit logs for workspace' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
  ) {
    const logs = await this.auditService.findByWorkspace(user.workspaceId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      action: action as AuditAction | undefined,
      entity,
      userId,
    });
    return logs;
  }

  @Get('entity')
  @ApiOperation({ summary: 'Get audit logs for specific entity' })
  @ApiQuery({ name: 'entity', required: true, type: String })
  @ApiQuery({ name: 'entityId', required: true, type: String })
  async findByEntity(
    @Query('entity') entity: string,
    @Query('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entity, entityId);
  }
}
