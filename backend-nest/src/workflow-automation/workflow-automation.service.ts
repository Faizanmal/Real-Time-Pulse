import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowExecutionStatus } from '@prisma/client';

@Injectable()
export class WorkflowAutomationService {
  constructor(private prisma: PrismaService) {}

  // Workflows
  async createWorkflow(
    workspaceId: string,
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
    return this.prisma.workflow.create({
      data: {
        workspaceId,
        ...data,
      },
    });
  }

  async getWorkflows(workspaceId: string) {
    return this.prisma.workflow.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkflow(id: string, workspaceId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async updateWorkflow(id: string, workspaceId: string, data: any) {
    const workflow = await this.getWorkflow(id, workspaceId);

    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  async deleteWorkflow(id: string, workspaceId: string) {
    await this.getWorkflow(id, workspaceId);

    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  async toggleWorkflow(id: string, workspaceId: string, isActive: boolean) {
    await this.getWorkflow(id, workspaceId);

    return this.prisma.workflow.update({
      where: { id },
      data: { isActive },
    });
  }

  // Workflow Execution
  async executeWorkflow(workflowId: string, triggerData: any) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (!workflow.isActive) {
      throw new BadRequestException('Workflow is not active');
    }

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        triggerData,
        status: WorkflowExecutionStatus.RUNNING,
        steps: [],
      },
    });

    // Execute workflow asynchronously
    this.runWorkflow(workflow, execution.id, triggerData).catch((error) => {
      console.error('Workflow execution failed:', error);
    });

    return execution;
  }

  private async runWorkflow(
    workflow: any,
    executionId: string,
    triggerData: any,
  ) {
    const startTime = Date.now();
    const steps: any[] = [];

    try {
      // Evaluate conditions
      if (workflow.conditions) {
        const conditionsMet = await this.evaluateConditions(
          workflow.conditions,
          triggerData,
        );
        if (!conditionsMet) {
          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
              status: WorkflowExecutionStatus.COMPLETED,
              completedAt: new Date(),
              duration: Date.now() - startTime,
              steps: [{ step: 'conditions', result: 'not_met' }],
            },
          });
          return;
        }
      }

      // Execute actions
      const actions = workflow.actions as any[];

      for (const action of actions) {
        const stepStartTime = Date.now();

        try {
          const result = await this.executeAction(
            action,
            triggerData,
            workflow.workspaceId,
          );

          steps.push({
            action: action.type,
            status: 'success',
            result,
            duration: Date.now() - stepStartTime,
          });
        } catch (error) {
          steps.push({
            action: action.type,
            status: 'failed',
            error: error.message,
            duration: Date.now() - stepStartTime,
          });

          throw error;
        }
      }

      // Update execution as completed
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          steps,
        },
      });

      // Update workflow stats
      await this.prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          executionCount: { increment: 1 },
          successCount: { increment: 1 },
          lastExecutedAt: new Date(),
          averageExecutionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      // Update execution as failed
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.FAILED,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          error: error.message,
          steps,
        },
      });

      // Update workflow stats
      await this.prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          executionCount: { increment: 1 },
          failureCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });
    }
  }

  private async evaluateConditions(
    conditions: any,
    data: any,
  ): Promise<boolean> {
    // Simple condition evaluation
    // In production, use a proper rules engine

    if (conditions.operator === 'AND') {
      return conditions.rules.every((rule: any) =>
        this.evaluateRule(rule, data),
      );
    } else if (conditions.operator === 'OR') {
      return conditions.rules.some((rule: any) =>
        this.evaluateRule(rule, data),
      );
    }

    return this.evaluateRule(conditions, data);
  }

  private evaluateRule(rule: any, data: any): boolean {
    const value = this.getNestedValue(data, rule.field);

    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'not_equals':
        return value !== rule.value;
      case 'greater_than':
        return value > rule.value;
      case 'less_than':
        return value < rule.value;
      case 'contains':
        return String(value).includes(rule.value);
      case 'not_contains':
        return !String(value).includes(rule.value);
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private async executeAction(
    action: any,
    triggerData: any,
    workspaceId: string,
  ): Promise<any> {
    switch (action.type) {
      case 'send_email':
        return this.sendEmail(action.config, triggerData);

      case 'send_notification':
        return this.sendNotification(action.config, workspaceId);

      case 'create_alert':
        return this.createAlert(action.config, workspaceId);

      case 'update_widget':
        return this.updateWidget(action.config, workspaceId);

      case 'webhook':
        return this.callWebhook(action.config, triggerData);

      case 'slack_message':
        return this.sendSlackMessage(action.config, triggerData);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async sendEmail(config: any, data: any): Promise<any> {
    // Simulate email sending
    console.log('Sending email:', config.to, config.subject);
    return { sent: true, to: config.to };
  }

  private async sendNotification(
    config: any,
    workspaceId: string,
  ): Promise<any> {
    // Create notification in database
    return { sent: true, message: config.message };
  }

  private async createAlert(config: any, workspaceId: string): Promise<any> {
    // Create alert
    return { created: true, alert: config.name };
  }

  private async updateWidget(config: any, workspaceId: string): Promise<any> {
    // Update widget
    return { updated: true, widgetId: config.widgetId };
  }

  private async callWebhook(config: any, data: any): Promise<any> {
    // Call external webhook
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(data),
    });

    return {
      status: response.status,
      success: response.ok,
    };
  }

  private async sendSlackMessage(config: any, data: any): Promise<any> {
    // Send Slack message
    console.log('Sending Slack message:', config.channel, config.message);
    return { sent: true, channel: config.channel };
  }

  // Executions
  async getExecutions(workflowId: string, workspaceId: string) {
    await this.getWorkflow(workflowId, workspaceId);

    return this.prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async getExecution(executionId: string, workspaceId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
      },
    });

    if (!execution || execution.workflow.workspaceId !== workspaceId) {
      throw new NotFoundException('Execution not found');
    }

    return execution;
  }

  async retryExecution(executionId: string, workspaceId: string) {
    const execution = await this.getExecution(executionId, workspaceId);

    if (execution.status !== WorkflowExecutionStatus.FAILED) {
      throw new BadRequestException('Can only retry failed executions');
    }

    return this.executeWorkflow(execution.workflowId, execution.triggerData);
  }

  // Templates
  async getWorkflowTemplates(category?: string) {
    return this.prisma.workflowTemplate.findMany({
      where: {
        isPublic: true,
        ...(category && { category }),
      },
      orderBy: [{ rating: 'desc' }, { usageCount: 'desc' }],
    });
  }

  async getWorkflowTemplate(id: string) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createWorkflowFromTemplate(
    templateId: string,
    workspaceId: string,
    customizations?: any,
  ) {
    const template = await this.getWorkflowTemplate(templateId);

    const templateData = template.template as any;

    // Increment usage count
    await this.prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    // Create workflow from template
    return this.createWorkflow(workspaceId, {
      name: customizations?.name || template.name,
      description: customizations?.description || template.description,
      trigger: customizations?.trigger || templateData.trigger,
      actions: customizations?.actions || templateData.actions,
      conditions: customizations?.conditions || templateData.conditions,
      nodes: customizations?.nodes || templateData.nodes,
      edges: customizations?.edges || templateData.edges,
    });
  }
}
