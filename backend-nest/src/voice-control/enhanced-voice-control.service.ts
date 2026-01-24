/**
 * Enhanced Voice Control Service
 * Provides voice commands integration using Web Speech API with NLP
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import OpenAI from 'openai';

interface VoiceCommand {
  command: string;
  patterns: RegExp[];
  action: string;
  parameters?: string[];
  description: string;
}

interface ParsedCommand {
  intent: string;
  action: string;
  parameters: Record<string, any>;
  confidence: number;
  originalText: string;
}

interface VoiceCommandResult {
  success: boolean;
  message: string;
  action?: string;
  data?: any;
}

@Injectable()
export class EnhancedVoiceControlService {
  private openai: OpenAI;
  private commands: VoiceCommand[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });

    this.initializeCommands();
  }

  private initializeCommands(): void {
    this.commands = [
      // Navigation commands
      {
        command: 'navigate',
        patterns: [
          /(?:go to|open|show|navigate to)\s+(?:the\s+)?(\w+)/i,
          /(?:take me to)\s+(?:the\s+)?(\w+)/i,
        ],
        action: 'navigation.goto',
        parameters: ['destination'],
        description: 'Navigate to a specific page or section',
      },
      // Dashboard commands
      {
        command: 'dashboard',
        patterns: [
          /(?:show|display|open)\s+(?:the\s+)?(\w+)?\s*dashboard/i,
          /(?:switch to|change to)\s+(?:the\s+)?(\w+)?\s*dashboard/i,
        ],
        action: 'dashboard.show',
        parameters: ['dashboardName'],
        description: 'Show or switch to a dashboard',
      },
      // Widget commands
      {
        command: 'widget.add',
        patterns: [
          /(?:add|create|new)\s+(?:a\s+)?(\w+)\s+widget/i,
          /(?:insert)\s+(?:a\s+)?(\w+)\s+(?:widget|chart)/i,
        ],
        action: 'widget.create',
        parameters: ['widgetType'],
        description: 'Add a new widget to the dashboard',
      },
      {
        command: 'widget.remove',
        patterns: [
          /(?:remove|delete|hide)\s+(?:the\s+)?(\w+)\s+widget/i,
          /(?:close)\s+(?:the\s+)?(\w+)\s+(?:widget|chart)/i,
        ],
        action: 'widget.remove',
        parameters: ['widgetName'],
        description: 'Remove a widget from the dashboard',
      },
      // Data commands
      {
        command: 'filter',
        patterns: [
          /(?:filter|show only|display only)\s+(?:by\s+)?(.+)/i,
          /(?:apply filter)\s+(.+)/i,
        ],
        action: 'data.filter',
        parameters: ['filterCriteria'],
        description: 'Apply a filter to the current view',
      },
      {
        command: 'timerange',
        patterns: [
          /(?:show|display)\s+(?:data\s+)?(?:for|from)\s+(?:the\s+)?(?:last\s+)?(\d+)\s+(days?|weeks?|months?|hours?)/i,
          /(?:set time range to)\s+(.+)/i,
        ],
        action: 'data.timerange',
        parameters: ['value', 'unit'],
        description: 'Change the time range for data display',
      },
      {
        command: 'refresh',
        patterns: [/(?:refresh|reload|update)\s+(?:the\s+)?(?:data|dashboard|widgets?)?/i],
        action: 'data.refresh',
        parameters: [],
        description: 'Refresh the current data',
      },
      // Report commands
      {
        command: 'report.generate',
        patterns: [
          /(?:generate|create|build)\s+(?:a\s+)?(?:(\w+)\s+)?report/i,
          /(?:make me|give me)\s+(?:a\s+)?(?:(\w+)\s+)?report/i,
        ],
        action: 'report.generate',
        parameters: ['reportType'],
        description: 'Generate a report',
      },
      {
        command: 'report.export',
        patterns: [
          /(?:export|download)\s+(?:the\s+)?(?:report|data)\s+(?:as|to)\s+(\w+)/i,
          /(?:save)\s+(?:as|to)\s+(\w+)/i,
        ],
        action: 'report.export',
        parameters: ['format'],
        description: 'Export data or report',
      },
      // Alert commands
      {
        command: 'alert.create',
        patterns: [
          /(?:create|set|add)\s+(?:an?\s+)?alert\s+(?:for|when)\s+(.+)/i,
          /(?:notify me|alert me)\s+(?:when|if)\s+(.+)/i,
        ],
        action: 'alert.create',
        parameters: ['condition'],
        description: 'Create a new alert',
      },
      // Search commands
      {
        command: 'search',
        patterns: [/(?:search|find|look for)\s+(.+)/i, /(?:where is|what is)\s+(.+)/i],
        action: 'search.query',
        parameters: ['query'],
        description: 'Search for data or entities',
      },
      // Query commands
      {
        command: 'query',
        patterns: [/(?:what|how|show me|tell me)\s+(.+)/i, /(?:query)\s+(.+)/i],
        action: 'query.natural',
        parameters: ['question'],
        description: 'Ask a natural language question about data',
      },
      // Help command
      {
        command: 'help',
        patterns: [/(?:help|what can you do|commands|options)/i],
        action: 'system.help',
        parameters: [],
        description: 'Show available voice commands',
      },
    ];
  }

  /**
   * Parse voice input and extract command
   */
  async parseVoiceInput(text: string): Promise<ParsedCommand> {
    const normalizedText = text.toLowerCase().trim();

    // Try pattern matching first
    for (const cmd of this.commands) {
      for (const pattern of cmd.patterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          const parameters: Record<string, any> = {};
          cmd.parameters?.forEach((param, index) => {
            if (match[index + 1]) {
              parameters[param] = match[index + 1];
            }
          });

          return {
            intent: cmd.command,
            action: cmd.action,
            parameters,
            confidence: 0.9,
            originalText: text,
          };
        }
      }
    }

    // Fall back to AI-powered intent detection
    return await this.parseWithAI(text);
  }

  /**
   * Parse command using AI for complex/ambiguous inputs
   */
  private async parseWithAI(text: string): Promise<ParsedCommand> {
    try {
      const commandDescriptions = this.commands.map((c) => ({
        action: c.action,
        description: c.description,
        parameters: c.parameters,
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a voice command parser. Available commands: ${JSON.stringify(commandDescriptions)}.
                      Parse the user's voice input and return JSON with:
                      - intent: the matched command name
                      - action: the action string
                      - parameters: extracted parameters
                      - confidence: 0-1 confidence score
                      If no command matches, use action "unknown" with confidence 0.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        ...result,
        originalText: text,
      };
    } catch (error) {
      this.logger.error(`AI parsing failed: ${error}`, 'VoiceControlService');
      return {
        intent: 'unknown',
        action: 'unknown',
        parameters: {},
        confidence: 0,
        originalText: text,
      };
    }
  }

  /**
   * Execute a parsed voice command
   */
  async executeCommand(parsedCommand: ParsedCommand): Promise<VoiceCommandResult> {
    const { action, parameters, confidence } = parsedCommand;

    if (confidence < 0.5) {
      return {
        success: false,
        message: "I'm not sure what you meant. Could you please repeat or rephrase?",
      };
    }

    // Route to appropriate handler
    const [category, subAction] = action.split('.');

    switch (category) {
      case 'navigation':
        return this.handleNavigation(subAction, parameters);
      case 'dashboard':
        return this.handleDashboard(subAction, parameters);
      case 'widget':
        return this.handleWidget(subAction, parameters);
      case 'data':
        return this.handleData(subAction, parameters);
      case 'report':
        return this.handleReport(subAction, parameters);
      case 'alert':
        return this.handleAlert(subAction, parameters);
      case 'search':
        return this.handleSearch(subAction, parameters);
      case 'query':
        return this.handleQuery(subAction, parameters);
      case 'system':
        return this.handleSystem(subAction, parameters);
      default:
        return {
          success: false,
          message: "I don't recognize that command.",
        };
    }
  }

  private handleNavigation(action: string, params: Record<string, any>): VoiceCommandResult {
    return {
      success: true,
      message: `Navigating to ${params.destination}`,
      action: 'navigate',
      data: { route: `/${params.destination}` },
    };
  }

  private handleDashboard(action: string, params: Record<string, any>): VoiceCommandResult {
    return {
      success: true,
      message: `Showing ${params.dashboardName || 'default'} dashboard`,
      action: 'showDashboard',
      data: { dashboardName: params.dashboardName },
    };
  }

  private handleWidget(action: string, params: Record<string, any>): VoiceCommandResult {
    switch (action) {
      case 'create':
        return {
          success: true,
          message: `Creating ${params.widgetType} widget`,
          action: 'createWidget',
          data: { type: params.widgetType },
        };
      case 'remove':
        return {
          success: true,
          message: `Removing ${params.widgetName} widget`,
          action: 'removeWidget',
          data: { name: params.widgetName },
        };
      default:
        return { success: false, message: 'Unknown widget action' };
    }
  }

  private handleData(action: string, params: Record<string, any>): VoiceCommandResult {
    switch (action) {
      case 'filter':
        return {
          success: true,
          message: `Applying filter: ${params.filterCriteria}`,
          action: 'applyFilter',
          data: { filter: params.filterCriteria },
        };
      case 'timerange':
        return {
          success: true,
          message: `Setting time range to ${params.value} ${params.unit}`,
          action: 'setTimeRange',
          data: { value: params.value, unit: params.unit },
        };
      case 'refresh':
        return {
          success: true,
          message: 'Refreshing data',
          action: 'refresh',
        };
      default:
        return { success: false, message: 'Unknown data action' };
    }
  }

  private handleReport(action: string, params: Record<string, any>): VoiceCommandResult {
    switch (action) {
      case 'generate':
        return {
          success: true,
          message: `Generating ${params.reportType || 'standard'} report`,
          action: 'generateReport',
          data: { type: params.reportType },
        };
      case 'export':
        return {
          success: true,
          message: `Exporting as ${params.format}`,
          action: 'export',
          data: { format: params.format },
        };
      default:
        return { success: false, message: 'Unknown report action' };
    }
  }

  private handleAlert(action: string, params: Record<string, any>): VoiceCommandResult {
    return {
      success: true,
      message: `Creating alert: ${params.condition}`,
      action: 'createAlert',
      data: { condition: params.condition },
    };
  }

  private handleSearch(action: string, params: Record<string, any>): VoiceCommandResult {
    return {
      success: true,
      message: `Searching for: ${params.query}`,
      action: 'search',
      data: { query: params.query },
    };
  }

  private async handleQuery(
    action: string,
    params: Record<string, any>,
  ): Promise<VoiceCommandResult> {
    // This would integrate with the predictive analytics service
    return {
      success: true,
      message: `Processing query: ${params.question}`,
      action: 'naturalLanguageQuery',
      data: { question: params.question },
    };
  }

  private handleSystem(action: string, _params: Record<string, any>): VoiceCommandResult {
    if (action === 'help') {
      const commandList = this.commands.map((c) => ({
        name: c.command,
        description: c.description,
      }));

      return {
        success: true,
        message: 'Here are the available voice commands',
        action: 'showHelp',
        data: { commands: commandList },
      };
    }
    return { success: false, message: 'Unknown system action' };
  }

  /**
   * Get available commands for UI display
   */
  getAvailableCommands(): { category: string; commands: any[] }[] {
    const categories: Record<string, any[]> = {};

    for (const cmd of this.commands) {
      const category = cmd.action.split('.')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({
        name: cmd.command,
        description: cmd.description,
        examples: cmd.patterns.map((p) => p.source),
      });
    }

    return Object.entries(categories).map(([category, commands]) => ({
      category,
      commands,
    }));
  }

  /**
   * Generate speech synthesis text for response
   */
  generateSpeechResponse(result: VoiceCommandResult): string {
    if (!result.success) {
      return result.message;
    }

    // Add more natural speech patterns
    const prefixes = ['Okay, ', 'Sure, ', 'Got it, ', 'Alright, ', ''];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return prefix + result.message;
  }
}
