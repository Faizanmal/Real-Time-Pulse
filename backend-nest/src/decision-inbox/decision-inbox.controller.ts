import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import {
  ClientDecisionListDto,
  CreateClientDecisionDto,
  SubmitClientDecisionDto,
  UpdateDecisionEscalationPolicyDto,
} from './dto/decision-inbox.dto';
import { DecisionInboxService } from './decision-inbox.service';

@ApiTags('Decision Inbox')
@ApiBearerAuth()
@Controller('decision-inbox')
@UseGuards(JwtAuthGuard, AgencyRoleGuard)
export class DecisionInboxController {
  constructor(private readonly decisions: DecisionInboxService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('portalId') portalId?: string) {
    return this.decisions.listAgency(user.workspaceId, user.id, portalId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateClientDecisionDto) {
    return this.decisions.create(user.workspaceId, user.id, dto);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.decisions.withdraw(id, user.workspaceId, user.id);
  }

  @Get('policy')
  getPolicy(@CurrentUser() user: RequestUser) {
    return this.decisions.getPolicy(user.workspaceId, user.id);
  }

  @Patch('policy')
  updatePolicy(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateDecisionEscalationPolicyDto,
  ) {
    return this.decisions.updatePolicy(user.workspaceId, user.id, dto);
  }
}

@ApiTags('Client Decision Responses')
@Controller('share-links/public/:token/decisions')
@UseGuards(OptionalJwtAuthGuard)
export class ClientDecisionController {
  constructor(private readonly decisions: DecisionInboxService) {}

  @Post('list')
  @Header('Cache-Control', 'no-store, private')
  list(
    @Param('token') token: string,
    @Body() body: ClientDecisionListDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.decisions.listClient(token, body.password, user?.id);
  }

  @Post(':decisionId/respond')
  @Header('Cache-Control', 'no-store, private')
  respond(
    @Param('token') token: string,
    @Param('decisionId') decisionId: string,
    @Body() body: SubmitClientDecisionDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.decisions.respond(token, decisionId, user?.id, body);
  }
}
