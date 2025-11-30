import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduledReportsService } from './scheduled-reports.service';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
} from './dto/scheduled-report.dto';

@ApiTags('Scheduled Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scheduled-reports')
export class ScheduledReportsController {
  constructor(private readonly reportsService: ScheduledReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a scheduled report' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async create(@Request() req: any, @Body() dto: CreateScheduledReportDto) {
    return this.reportsService.create(req.user.workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scheduled reports' })
  @ApiResponse({ status: 200, description: 'Returns all scheduled reports' })
  async findAll(@Request() req: any) {
    return this.reportsService.findAll(req.user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled report by ID' })
  @ApiResponse({ status: 200, description: 'Returns the scheduled report' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.reportsService.findOne(id, req.user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scheduled report' })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledReportDto,
  ) {
    return this.reportsService.update(id, req.user.workspaceId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scheduled report' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.reportsService.delete(id, req.user.workspaceId);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Manually trigger a report run' })
  @ApiResponse({ status: 200, description: 'Report triggered successfully' })
  async triggerRun(@Request() req: any, @Param('id') id: string) {
    return this.reportsService.triggerRun(id, req.user.workspaceId);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get report run history' })
  @ApiResponse({ status: 200, description: 'Returns run history' })
  async getHistory(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getRunHistory(
      id,
      req.user.workspaceId,
      limit || 20,
    );
  }
}
