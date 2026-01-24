import { Injectable, Logger } from '@nestjs/common';
import { VoiceCommand } from './voice.service';

interface CommandPattern {
  pattern: RegExp;
  action: string;
  extractParams: (match: RegExpMatchArray) => Record<string, any>;
}

@Injectable()
export class VoiceCommandService {
  private readonly logger = new Logger(VoiceCommandService.name);

  // Command patterns
  private readonly commandPatterns: CommandPattern[] = [
    // Navigation commands
    {
      pattern: /(?:show|open|go to|navigate to)\s+(?:the\s+)?(.+?)(?:\s+dashboard|\s+portal)?$/i,
      action: 'navigate',
      extractParams: (match) => ({ target: match[1].trim() }),
    },
    {
      pattern: /(?:back|go back|return)$/i,
      action: 'navigate_back',
      extractParams: () => ({}),
    },
    {
      pattern: /(?:home|go home|main menu)$/i,
      action: 'navigate_home',
      extractParams: () => ({}),
    },

    // Filter commands
    {
      pattern:
        /(?:filter|show|display)\s+(?:by\s+)?(?:the\s+)?(?:last\s+)?(\d+)\s+(days?|weeks?|months?|years?)$/i,
      action: 'filter_time',
      extractParams: (match) => ({
        amount: parseInt(match[1]),
        unit: match[2].replace(/s$/, ''),
      }),
    },
    {
      pattern: /(?:filter|show)\s+(?:from\s+)?(.+?)\s+to\s+(.+)$/i,
      action: 'filter_date_range',
      extractParams: (match) => ({ from: match[1], to: match[2] }),
    },
    {
      pattern: /(?:filter|show)\s+(?:only\s+)?(.+?)\s+(?:data|items|records)$/i,
      action: 'filter_category',
      extractParams: (match) => ({ category: match[1] }),
    },
    {
      pattern: /(?:clear|reset|remove)\s+(?:all\s+)?filters?$/i,
      action: 'clear_filters',
      extractParams: () => ({}),
    },

    // Data commands
    {
      pattern: /(?:refresh|reload|update)\s+(?:the\s+)?(?:data|dashboard|view)?$/i,
      action: 'refresh',
      extractParams: () => ({}),
    },
    {
      pattern:
        /(?:export|download)\s+(?:the\s+)?(?:data|report)?\s*(?:as\s+)?(?:to\s+)?(csv|excel|pdf)?$/i,
      action: 'export',
      extractParams: (match) => ({ format: match[1] || 'csv' }),
    },

    // Widget commands
    {
      pattern: /(?:zoom|focus)\s+(?:in\s+)?(?:on\s+)?(?:the\s+)?(.+?)(?:\s+widget|\s+chart)?$/i,
      action: 'zoom_widget',
      extractParams: (match) => ({ widgetName: match[1] }),
    },
    {
      pattern: /(?:expand|maximize)\s+(?:the\s+)?(.+?)(?:\s+widget|\s+chart)?$/i,
      action: 'expand_widget',
      extractParams: (match) => ({ widgetName: match[1] }),
    },
    {
      pattern: /(?:collapse|minimize)\s+(?:the\s+)?(.+?)(?:\s+widget|\s+chart)?$/i,
      action: 'collapse_widget',
      extractParams: (match) => ({ widgetName: match[1] }),
    },

    // Insight commands
    {
      pattern:
        /(?:what(?:'s| is)?|tell me)\s+(?:the\s+)?(?:current\s+)?(.+?)(?:\s+value|\s+metric)?$/i,
      action: 'get_metric',
      extractParams: (match) => ({ metric: match[1] }),
    },
    {
      pattern: /(?:summarize|summary of|describe)\s+(?:the\s+)?(.+)$/i,
      action: 'summarize',
      extractParams: (match) => ({ target: match[1] }),
    },
    {
      pattern: /(?:compare|comparison)\s+(.+?)\s+(?:to|with|and)\s+(.+)$/i,
      action: 'compare',
      extractParams: (match) => ({ item1: match[1], item2: match[2] }),
    },

    // Alert commands
    {
      pattern: /(?:set|create)\s+(?:an?\s+)?alert\s+(?:for\s+)?(.+?)\s+(?:when|if)\s+(.+)$/i,
      action: 'create_alert',
      extractParams: (match) => ({ metric: match[1], condition: match[2] }),
    },
    {
      pattern: /(?:show|list|display)\s+(?:all\s+)?alerts?$/i,
      action: 'show_alerts',
      extractParams: () => ({}),
    },

    // Help command
    {
      pattern: /(?:help|what can you do|commands?)$/i,
      action: 'help',
      extractParams: () => ({}),
    },
  ];

  /**
   * Parse a voice command from transcript
   */
  parseCommand(transcript: string): VoiceCommand | null {
    const normalizedTranscript = transcript.trim().toLowerCase();

    for (const pattern of this.commandPatterns) {
      const match = normalizedTranscript.match(pattern.pattern);
      if (match) {
        return {
          id: `cmd_${Date.now()}`,
          phrase: transcript,
          action: pattern.action,
          parameters: pattern.extractParams(match),
          confidence: 0.9,
        };
      }
    }

    // Try fuzzy matching for common variations
    const fuzzyCommand = this.fuzzyMatch(normalizedTranscript);
    if (fuzzyCommand) {
      return {
        ...fuzzyCommand,
        confidence: 0.7,
      };
    }

    return null;
  }

  /**
   * Execute a parsed command
   */
  executeCommand(
    workspaceId: string,
    command: VoiceCommand,
  ): {
    response: string;
    action?: { type: string; payload: Record<string, unknown> };
  } {
    switch (command.action) {
      case 'navigate':
        return {
          response: `Opening ${command.parameters?.target}`,
          action: {
            type: 'NAVIGATE',
            payload: { target: command.parameters?.target },
          },
        };

      case 'navigate_back':
        return {
          response: 'Going back',
          action: { type: 'NAVIGATE_BACK', payload: {} },
        };

      case 'navigate_home':
        return {
          response: 'Going to home',
          action: { type: 'NAVIGATE_HOME', payload: {} },
        };

      case 'filter_time': {
        const { amount, unit } = command.parameters || {};
        return {
          response: `Filtering to show the last ${amount} ${unit}${amount > 1 ? 's' : ''}`,
          action: { type: 'FILTER_TIME', payload: { amount, unit } },
        };
      }

      case 'filter_date_range':
        return {
          response: `Filtering from ${command.parameters?.from} to ${command.parameters?.to}`,
          action: {
            type: 'FILTER_DATE_RANGE',
            payload: command.parameters || {},
          },
        };

      case 'filter_category':
        return {
          response: `Showing ${command.parameters?.category} data`,
          action: {
            type: 'FILTER_CATEGORY',
            payload: { category: command.parameters?.category },
          },
        };

      case 'clear_filters':
        return {
          response: 'Clearing all filters',
          action: { type: 'CLEAR_FILTERS', payload: {} },
        };

      case 'refresh':
        return {
          response: 'Refreshing data',
          action: { type: 'REFRESH', payload: {} },
        };

      case 'export':
        return {
          response: `Exporting data as ${command.parameters?.format || 'CSV'}`,
          action: {
            type: 'EXPORT',
            payload: { format: command.parameters?.format },
          },
        };

      case 'zoom_widget':
      case 'expand_widget':
        return {
          response: `Expanding ${command.parameters?.widgetName}`,
          action: {
            type: 'EXPAND_WIDGET',
            payload: { widgetName: command.parameters?.widgetName },
          },
        };

      case 'collapse_widget':
        return {
          response: `Minimizing ${command.parameters?.widgetName}`,
          action: {
            type: 'COLLAPSE_WIDGET',
            payload: { widgetName: command.parameters?.widgetName },
          },
        };

      case 'get_metric':
        return {
          response: `Looking up ${command.parameters?.metric}`,
          action: {
            type: 'GET_METRIC',
            payload: { metric: command.parameters?.metric },
          },
        };

      case 'summarize':
        return {
          response: `Generating summary for ${command.parameters?.target}`,
          action: {
            type: 'SUMMARIZE',
            payload: { target: command.parameters?.target },
          },
        };

      case 'compare':
        return {
          response: `Comparing ${command.parameters?.item1} with ${command.parameters?.item2}`,
          action: { type: 'COMPARE', payload: command.parameters || {} },
        };

      case 'create_alert':
        return {
          response: `Creating alert for ${command.parameters?.metric}`,
          action: { type: 'CREATE_ALERT', payload: command.parameters || {} },
        };

      case 'show_alerts':
        return {
          response: 'Showing all alerts',
          action: { type: 'SHOW_ALERTS', payload: {} },
        };

      case 'help':
        return {
          response: this.getHelpText(),
        };

      default:
        return {
          response: "I'm not sure how to do that. Try saying 'help' for available commands.",
        };
    }
  }

  /**
   * Fuzzy match for common variations
   */
  private fuzzyMatch(transcript: string): Omit<VoiceCommand, 'confidence'> | null {
    // Common phrase variations
    const variations: Record<string, { action: string; parameters?: Record<string, any> }> = {
      'go back': { action: 'navigate_back' },
      'previous page': { action: 'navigate_back' },
      'main page': { action: 'navigate_home' },
      'start over': { action: 'clear_filters' },
      'update data': { action: 'refresh' },
      'get data': { action: 'refresh' },
      'save as csv': { action: 'export', parameters: { format: 'csv' } },
      'save as excel': { action: 'export', parameters: { format: 'excel' } },
      'what can i say': { action: 'help' },
      'voice commands': { action: 'help' },
    };

    for (const [phrase, command] of Object.entries(variations)) {
      if (transcript.includes(phrase)) {
        return {
          id: `cmd_${Date.now()}`,
          phrase: transcript,
          action: command.action,
          parameters: command.parameters,
        };
      }
    }

    return null;
  }

  /**
   * Get help text for available commands
   */
  private getHelpText(): string {
    return `You can say commands like:
- "Show sales dashboard" to navigate
- "Filter by last 7 days" to filter data
- "Refresh" to update the view
- "Export as CSV" to download data
- "Expand revenue chart" to focus on a widget
- "What's the current revenue?" to get metrics
- "Compare sales and revenue" to compare data`;
  }

  /**
   * Get all available commands
   */
  getAvailableCommands() {
    return [
      {
        category: 'Navigation',
        commands: ['Show [dashboard]', 'Go back', 'Go home'],
      },
      {
        category: 'Filters',
        commands: ['Filter by last [N] [days/weeks/months]', 'Clear filters'],
      },
      { category: 'Data', commands: ['Refresh', 'Export as [CSV/Excel/PDF]'] },
      {
        category: 'Widgets',
        commands: ['Expand [widget]', 'Collapse [widget]'],
      },
      {
        category: 'Insights',
        commands: ["What's the [metric]?", 'Summarize [target]', 'Compare [A] and [B]'],
      },
      {
        category: 'Alerts',
        commands: ['Set alert for [metric] when [condition]', 'Show alerts'],
      },
    ];
  }
}
