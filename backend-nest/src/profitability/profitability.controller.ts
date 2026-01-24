import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { ProfitabilityService } from './profitability.service';
import { ProjectService } from './project.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

@ApiTags('Profitability Analytics')
@ApiBearerAuth()
@Controller('profitability')
export class ProfitabilityController {
  constructor(
    private readonly profitabilityService: ProfitabilityService,
    private readonly projectService: ProjectService,
  ) {}

  // Project Management
  @Post('projects')
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @Body()
    body: {
      workspaceId: string;
      name: string;
      clientName: string;
      description?: string;
      budgetAmount?: number;
      hourlyRate?: number;
      currency?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.projectService.createProject({
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  @Get('projects/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all projects for a workspace' })
  async getProjects(
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: ProjectStatus,
  ) {
    return this.projectService.getProjects(workspaceId, {
      ...(status && { status }),
    });
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get project details' })
  async getProjectById(@Param('projectId') projectId: string) {
    return this.projectService.getProjectById(projectId);
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Update project' })
  async updateProject(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
      budgetAmount?: number;
      hourlyRate?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.projectService.updateProject(projectId, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  @Delete('projects/:projectId')
  @ApiOperation({ summary: 'Delete project' })
  async deleteProject(@Param('projectId') projectId: string) {
    return this.projectService.deleteProject(projectId);
  }

  // Time Entries
  @Post('projects/:projectId/time-entries')
  @ApiOperation({ summary: 'Add time entry to project' })
  async addTimeEntry(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      userId: string;
      description?: string;
      hours: number;
      billable?: boolean;
      hourlyRate?: number;
      date: string;
    },
  ) {
    return this.projectService.addTimeEntry({
      projectId,
      ...body,
      date: new Date(body.date),
    });
  }

  @Patch('time-entries/:entryId')
  @ApiOperation({ summary: 'Update time entry' })
  async updateTimeEntry(
    @Param('entryId') entryId: string,
    @Body()
    body: {
      description?: string;
      hours?: number;
      billable?: boolean;
      hourlyRate?: number;
      date?: string;
    },
  ) {
    return this.projectService.updateTimeEntry(entryId, {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
    });
  }

  @Delete('time-entries/:entryId')
  @ApiOperation({ summary: 'Delete time entry' })
  async deleteTimeEntry(@Param('entryId') entryId: string) {
    return this.projectService.deleteTimeEntry(entryId);
  }

  // Expenses
  @Post('projects/:projectId/expenses')
  @ApiOperation({ summary: 'Add expense to project' })
  async addExpense(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      description: string;
      amount: number;
      category?: string;
      billable?: boolean;
      date: string;
    },
  ) {
    return this.projectService.addExpense({
      projectId,
      ...body,
      date: new Date(body.date),
    });
  }

  @Patch('expenses/:expenseId')
  @ApiOperation({ summary: 'Update expense' })
  async updateExpense(
    @Param('expenseId') expenseId: string,
    @Body()
    body: {
      description?: string;
      amount?: number;
      category?: string;
      billable?: boolean;
      date?: string;
    },
  ) {
    return this.projectService.updateExpense(expenseId, {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
    });
  }

  @Delete('expenses/:expenseId')
  @ApiOperation({ summary: 'Delete expense' })
  async deleteExpense(@Param('expenseId') expenseId: string) {
    return this.projectService.deleteExpense(expenseId);
  }

  // Profitability Analytics
  @Post('projects/:projectId/calculate')
  @ApiOperation({ summary: 'Calculate project profitability' })
  async calculateProfitability(@Param('projectId') projectId: string) {
    return this.profitabilityService.calculateProjectProfitability(projectId);
  }

  @Get('workspace/:workspaceId/heatmap')
  @ApiOperation({ summary: 'Get profitability heatmap' })
  async getProfitabilityHeatmap(@Param('workspaceId') workspaceId: string) {
    return this.profitabilityService.getProfitabilityHeatmap(workspaceId);
  }

  @Get('workspace/:workspaceId/client-scoring')
  @ApiOperation({ summary: 'Get client profitability scoring' })
  async getClientScoring(@Param('workspaceId') workspaceId: string) {
    return this.profitabilityService.getClientProfitabilityScoring(workspaceId);
  }

  @Get('workspace/:workspaceId/resource-utilization')
  @ApiOperation({ summary: 'Get resource utilization metrics' })
  async getResourceUtilization(@Param('workspaceId') workspaceId: string) {
    return this.profitabilityService.getResourceUtilizationMetrics(workspaceId);
  }

  @Get('workspace/:workspaceId/summary')
  @ApiOperation({ summary: 'Get profitability summary' })
  async getProfitabilitySummary(
    @Param('workspaceId') workspaceId: string,
    @Query('period') period?: string,
  ) {
    return this.profitabilityService.getProfitabilitySummary(workspaceId, period);
  }
}
