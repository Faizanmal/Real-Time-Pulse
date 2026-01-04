import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VoiceCommand {
  text: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface CommandResponse {
  success: boolean;
  action: string;
  data?: any;
  message: string;
}

@Injectable()
export class VoiceControlService {
  private readonly logger = new Logger(VoiceControlService.name);

  // Command patterns for intent recognition
  private readonly commandPatterns = {
    show: /^(show|display|open|view)\s+(me\s+)?(.+)/i,
    create: /^(create|make|add|new)\s+(.+)/i,
    update: /^(update|change|modify|edit)\s+(.+)/i,
    delete: /^(delete|remove)\s+(.+)/i,
    generate: /^(generate|create|make)\s+(report|summary)\s+(.+)/i,
    filter: /^(filter|show|display)\s+(.+?)\s+(by|where|with)\s+(.+)/i,
    alert: /^(create|set|add)\s+alert\s+(for|when)\s+(.+)/i,
    navigate: /^(go to|navigate to|switch to)\s+(.+)/i,
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Process voice command and extract intent
   */
  async processCommand(
    text: string,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    this.logger.log(`Processing voice command: "${text}"`);

    // Parse the command
    const command = this.parseCommand(text);

    if (!command) {
      return {
        success: false,
        action: 'unknown',
        message: "I didn't understand that command. Please try again.",
      };
    }

    // Execute the command based on intent
    try {
      switch (command.intent) {
        case 'show':
          return await this.handleShowCommand(command, userId, workspaceId);
        case 'create':
          return await this.handleCreateCommand(command, userId, workspaceId);
        case 'update':
          return await this.handleUpdateCommand(command, userId, workspaceId);
        case 'delete':
          return await this.handleDeleteCommand(command, userId, workspaceId);
        case 'generate':
          return await this.handleGenerateCommand(command, userId, workspaceId);
        case 'filter':
          return await this.handleFilterCommand(command, userId, workspaceId);
        case 'alert':
          return await this.handleAlertCommand(command, userId, workspaceId);
        case 'navigate':
          return await this.handleNavigateCommand(command, userId, workspaceId);
        default:
          return {
            success: false,
            action: 'unknown',
            message: 'Command not supported.',
          };
      }
    } catch (error) {
      this.logger.error('Command execution failed', error);
      return {
        success: false,
        action: command.intent,
        message: 'Failed to execute command. Please try again.',
      };
    }
  }

  /**
   * Parse command text into structured format
   */
  private parseCommand(text: string): VoiceCommand | null {
    const normalized = text.toLowerCase().trim();

    for (const [intent, pattern] of Object.entries(this.commandPatterns)) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          text: normalized,
          intent,
          entities: this.extractEntities(normalized, intent, match),
          confidence: 0.85,
        };
      }
    }

    return null;
  }

  /**
   * Extract entities from command
   */
  private extractEntities(
    text: string,
    intent: string,
    match: RegExpMatchArray,
  ): Record<string, any> {
    const entities: Record<string, any> = {};

    switch (intent) {
      case 'show':
        entities.target = match[3]?.trim();
        entities.type = this.identifyEntityType(entities.target);
        break;
      case 'create':
        entities.target = match[2]?.trim();
        entities.type = this.identifyEntityType(entities.target);
        break;
      case 'update':
        entities.target = match[2]?.trim();
        break;
      case 'delete':
        entities.target = match[2]?.trim();
        break;
      case 'generate':
        entities.reportType = match[2]?.trim();
        entities.params = match[3]?.trim();
        break;
      case 'filter':
        entities.target = match[2]?.trim();
        entities.condition = match[4]?.trim();
        break;
      case 'alert':
        entities.condition = match[3]?.trim();
        break;
      case 'navigate':
        entities.destination = match[2]?.trim();
        break;
    }

    return entities;
  }

  /**
   * Identify entity type (dashboard, widget, project, etc.)
   */
  private identifyEntityType(target: string): string {
    const lowerTarget = target.toLowerCase();

    if (lowerTarget.includes('dashboard')) return 'dashboard';
    if (lowerTarget.includes('widget')) return 'widget';
    if (lowerTarget.includes('project')) return 'project';
    if (lowerTarget.includes('report')) return 'report';
    if (lowerTarget.includes('alert')) return 'alert';
    if (lowerTarget.includes('chart') || lowerTarget.includes('graph'))
      return 'widget';
    if (lowerTarget.includes('status')) return 'status';
    if (lowerTarget.includes('budget')) return 'budget';

    return 'unknown';
  }

  /**
   * Handle "show" commands
   */
  private async handleShowCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { target, type } = command.entities;

    switch (type) {
      case 'dashboard': {
        const dashboards = await this.findDashboards(target, workspaceId);
        if (dashboards.length > 0) {
          return {
            success: true,
            action: 'show_dashboard',
            data: { dashboard: dashboards[0] },
            message: `Showing ${dashboards[0].name}`,
          };
        }
        break;
      }

      case 'project': {
        const projectName = target.replace(/project\s+/i, '').trim();
        const project = await this.findProject(projectName, workspaceId);
        if (project) {
          return {
            success: true,
            action: 'show_project',
            data: { project },
            message: `Showing ${project.name} status`,
          };
        }
        break;
      }

      case 'status':
        return {
          success: true,
          action: 'show_status',
          data: await this.getOverallStatus(workspaceId),
          message: "Here's the current status",
        };
    }

    return {
      success: false,
      action: 'show',
      message: `Could not find ${target}`,
    };
  }

  /**
   * Handle "create" commands
   */
  private async handleCreateCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { target, type } = command.entities;

    switch (type) {
      case 'alert':
        return {
          success: true,
          action: 'create_alert',
          data: { template: 'alert' },
          message: 'Opening alert creation form',
        };

      case 'dashboard':
        return {
          success: true,
          action: 'create_dashboard',
          data: { template: 'dashboard' },
          message: 'Opening dashboard creation',
        };

      case 'widget':
        return {
          success: true,
          action: 'create_widget',
          data: { template: 'widget' },
          message: 'Opening widget builder',
        };
    }

    return {
      success: false,
      action: 'create',
      message: `Cannot create ${target}`,
    };
  }

  /**
   * Handle "generate" commands
   */
  private async handleGenerateCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { reportType, params } = command.entities;

    const period = this.extractTimePeriod(params);

    return {
      success: true,
      action: 'generate_report',
      data: {
        type: reportType,
        period,
        format: 'pdf',
      },
      message: `Generating ${period} ${reportType}`,
    };
  }

  /**
   * Handle "alert" commands
   */
  private async handleAlertCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { condition } = command.entities;

    // Parse condition (e.g., "budget overruns", "delays")
    const alertType = this.parseAlertCondition(condition);

    return {
      success: true,
      action: 'create_alert',
      data: {
        type: alertType,
        condition,
        userId,
        workspaceId,
      },
      message: `Creating alert for ${condition}`,
    };
  }

  /**
   * Handle "navigate" commands
   */
  private async handleNavigateCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { destination } = command.entities;

    const route = this.mapDestinationToRoute(destination);

    return {
      success: true,
      action: 'navigate',
      data: { route },
      message: `Navigating to ${destination}`,
    };
  }

  /**
   * Handle "filter" commands
   */
  private async handleFilterCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    const { target, condition } = command.entities;

    return {
      success: true,
      action: 'apply_filter',
      data: {
        target,
        filter: condition,
      },
      message: `Filtering ${target} by ${condition}`,
    };
  }

  /**
   * Handle "update" and "delete" commands (placeholders)
   */
  private async handleUpdateCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    return {
      success: false,
      action: 'update',
      message: 'Update command not yet implemented',
    };
  }

  private async handleDeleteCommand(
    command: VoiceCommand,
    userId: string,
    workspaceId: string,
  ): Promise<CommandResponse> {
    return {
      success: false,
      action: 'delete',
      message: 'Delete command requires confirmation',
    };
  }

  /**
   * Helper methods
   */
  private async findDashboards(query: string, workspaceId: string) {
    return await this.prisma.$queryRaw<any[]>`
      SELECT * FROM dashboards 
      WHERE workspace_id = ${workspaceId}
      AND LOWER(name) LIKE ${`%${query.toLowerCase()}%`}
      LIMIT 5
    `;
  }

  private async findProject(name: string, workspaceId: string) {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM projects 
      WHERE workspace_id = ${workspaceId}
      AND LOWER(name) LIKE ${`%${name.toLowerCase()}%`}
      LIMIT 1
    `;
    return results[0] || null;
  }

  private async getOverallStatus(workspaceId: string) {
    return {
      activeProjects: 10,
      completedTasks: 45,
      pendingAlerts: 3,
      budgetStatus: 'on-track',
    };
  }

  private extractTimePeriod(params: string): string {
    if (!params) return 'weekly';

    if (params.includes('daily')) return 'daily';
    if (params.includes('weekly') || params.includes('week')) return 'weekly';
    if (params.includes('monthly') || params.includes('month'))
      return 'monthly';
    if (params.includes('quarterly') || params.includes('quarter'))
      return 'quarterly';
    if (params.includes('yearly') || params.includes('year')) return 'yearly';

    return 'weekly';
  }

  private parseAlertCondition(condition: string): string {
    if (condition.includes('budget') || condition.includes('cost'))
      return 'budget';
    if (condition.includes('delay') || condition.includes('overdue'))
      return 'timeline';
    if (condition.includes('error') || condition.includes('fail'))
      return 'error';
    if (condition.includes('threshold') || condition.includes('limit'))
      return 'threshold';

    return 'custom';
  }

  private mapDestinationToRoute(destination: string): string {
    const routes: Record<string, string> = {
      home: '/',
      dashboard: '/dashboard',
      dashboards: '/dashboard',
      projects: '/projects',
      project: '/projects',
      alerts: '/alerts',
      reports: '/reports',
      settings: '/settings',
      analytics: '/analytics',
      integrations: '/integrations',
    };

    const normalized = destination.toLowerCase().trim();

    for (const [key, route] of Object.entries(routes)) {
      if (normalized.includes(key)) {
        return route;
      }
    }

    return '/dashboard';
  }

  /**
   * Get command history for user
   */
  async getCommandHistory(userId: string, limit: number = 10) {
    return await this.prisma.$queryRaw<any[]>`
      SELECT * FROM voice_command_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Save command to history
   */
  async saveCommandHistory(
    userId: string,
    command: string,
    intent: string,
    success: boolean,
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO voice_command_history (user_id, command, intent, success, created_at)
      VALUES (${userId}, ${command}, ${intent}, ${success}, ${new Date()})
    `;
  }
}
