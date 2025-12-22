import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkflowAutomationService } from './workflow-automation.service';

@Controller('workflow-automation')
@UseGuards(JwtAuthGuard)
export class WorkflowAutomationController {
  constructor(
    private readonly workflowAutomationService: WorkflowAutomationService,
  ) {}

  // Workflows
  @Post('workflows')
  async createWorkflow(
    @Req() req: any,
    @Body()
    data: {
      name: string;
      description?: string;
      trigger: any;
      actions: any;
      conditions?: any;
      nodes: any;
      edges: any;
    },
  ) {
    return this.workflowAutomationService.createWorkflow(
      req.user.workspaceId,
      data,
    );
  }

  @Get('workflows')
  async getWorkflows(@Req() req: any) {
    return this.workflowAutomationService.getWorkflows(req.user.workspaceId);
  }

  @Get('workflows/:id')
  async getWorkflow(@Param('id') id: string, @Req() req: any) {
    return this.workflowAutomationService.getWorkflow(id, req.user.workspaceId);
  }

  @Patch('workflows/:id')
  async updateWorkflow(
    @Param('id') id: string,
    @Req() req: any,
    @Body() data: any,
  ) {
    return this.workflowAutomationService.updateWorkflow(
      id,
      req.user.workspaceId,
      data,
    );
  }

  @Delete('workflows/:id')
  async deleteWorkflow(@Param('id') id: string, @Req() req: any) {
    return this.workflowAutomationService.deleteWorkflow(
      id,
      req.user.workspaceId,
    );
  }

  @Patch('workflows/:id/toggle')
  async toggleWorkflow(
    @Param('id') id: string,
    @Req() req: any,
    @Body() data: { isActive: boolean },
  ) {
    return this.workflowAutomationService.toggleWorkflow(
      id,
      req.user.workspaceId,
      data.isActive,
    );
  }

  // Execution
  @Post('workflows/:id/execute')
  async executeWorkflow(
    @Param('id') workflowId: string,
    @Body() data: { triggerData: any },
  ) {
    return this.workflowAutomationService.executeWorkflow(
      workflowId,
      data.triggerData,
    );
  }

  @Get('workflows/:id/executions')
  async getExecutions(@Param('id') workflowId: string, @Req() req: any) {
    return this.workflowAutomationService.getExecutions(
      workflowId,
      req.user.workspaceId,
    );
  }

  @Get('executions/:id')
  async getExecution(@Param('id') executionId: string, @Req() req: any) {
    return this.workflowAutomationService.getExecution(
      executionId,
      req.user.workspaceId,
    );
  }

  @Post('executions/:id/retry')
  async retryExecution(@Param('id') executionId: string, @Req() req: any) {
    return this.workflowAutomationService.retryExecution(
      executionId,
      req.user.workspaceId,
    );
  }

  // Templates
  @Get('templates')
  async getWorkflowTemplates(@Query('category') category?: string) {
    return this.workflowAutomationService.getWorkflowTemplates(category);
  }

  @Get('templates/:id')
  async getWorkflowTemplate(@Param('id') id: string) {
    return this.workflowAutomationService.getWorkflowTemplate(id);
  }

  @Post('templates/:id/create')
  async createWorkflowFromTemplate(
    @Param('id') templateId: string,
    @Req() req: any,
    @Body() data: { customizations?: any },
  ) {
    return this.workflowAutomationService.createWorkflowFromTemplate(
      templateId,
      req.user.workspaceId,
      data.customizations,
    );
  }
}
