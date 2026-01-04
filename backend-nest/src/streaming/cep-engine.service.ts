import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Complex Event Processing (CEP) Engine
interface CEPRule {
  id: string;
  name: string;
  description?: string;
  pattern: CEPPattern;
  timeWindow: number; // milliseconds
  action: CEPAction;
  enabled: boolean;
  priority: number;
}

interface CEPPattern {
  type: 'sequence' | 'absence' | 'frequency' | 'correlation' | 'threshold' | 'trend';
  conditions: CEPCondition[];
  withinWindow?: number;
  minOccurrences?: number;
  maxOccurrences?: number;
  correlationFields?: string[];
}

interface CEPCondition {
  eventType: string;
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex';
  value?: any;
  alias?: string;
  optional?: boolean;
}

interface CEPAction {
  type: 'alert' | 'email' | 'webhook' | 'aggregate' | 'trigger_flow' | 'emit';
  config: Record<string, any>;
}

interface CEPEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, any>;
  streamId?: string;
  correlationId?: string;
}

interface PatternMatch {
  ruleId: string;
  ruleName: string;
  matchedEvents: CEPEvent[];
  matchTime: Date;
  pattern: CEPPattern;
}

@Injectable()
export class CEPEngineService {
  private readonly logger = new Logger(CEPEngineService.name);
  private readonly rules = new Map<string, CEPRule>();
  private readonly eventBuffer = new Map<string, CEPEvent[]>(); // Per correlation key
  private readonly partialMatches = new Map<string, PartialMatch[]>();
  private readonly matchHistory: PatternMatch[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Subscribe to stream events
    this.eventEmitter.on('stream.message', (event) => {
      this.processEvent({
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: event.data.eventType || 'unknown',
        timestamp: Date.now(),
        data: event.data,
        streamId: event.streamId,
      });
    });

    // Periodic cleanup
    setInterval(() => this.cleanupExpiredBuffers(), 60000);
  }

  // Rule Management
  async createRule(rule: Omit<CEPRule, 'id'>): Promise<CEPRule> {
    const id = `rule-${Date.now()}`;
    const newRule: CEPRule = { ...rule, id };
    
    this.rules.set(id, newRule);
    this.logger.log(`Created CEP rule: ${newRule.name} (${id})`);
    
    return newRule;
  }

  async updateRule(id: string, updates: Partial<CEPRule>): Promise<CEPRule> {
    const rule = this.rules.get(id);
    if (!rule) throw new Error(`Rule ${id} not found`);

    const updated = { ...rule, ...updates };
    this.rules.set(id, updated);
    
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    this.rules.delete(id);
    this.partialMatches.delete(id);
  }

  async getRules(): Promise<CEPRule[]> {
    return Array.from(this.rules.values());
  }

  async getRule(id: string): Promise<CEPRule | undefined> {
    return this.rules.get(id);
  }

  // Event Processing
  async processEvent(event: CEPEvent) {
    // Add to buffer
    const bufferKey = event.correlationId || '_global';
    if (!this.eventBuffer.has(bufferKey)) {
      this.eventBuffer.set(bufferKey, []);
    }
    
    const buffer = this.eventBuffer.get(bufferKey)!;
    buffer.push(event);
    
    // Trim buffer based on max window
    const maxWindow = Math.max(...Array.from(this.rules.values()).map(r => r.timeWindow), 300000);
    const cutoff = Date.now() - maxWindow;
    const trimmed = buffer.filter(e => e.timestamp > cutoff);
    this.eventBuffer.set(bufferKey, trimmed);

    // Check each enabled rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      try {
        await this.evaluateRule(rule, event, trimmed);
      } catch (error) {
        this.logger.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  private async evaluateRule(rule: CEPRule, newEvent: CEPEvent, buffer: CEPEvent[]) {
    // Get events within this rule's time window
    const windowCutoff = Date.now() - rule.timeWindow;
    const windowedEvents = buffer.filter(e => e.timestamp > windowCutoff);

    let match: PatternMatch | null = null;

    switch (rule.pattern.type) {
      case 'sequence':
        match = await this.matchSequencePattern(rule, newEvent, windowedEvents);
        break;
      case 'absence':
        match = await this.matchAbsencePattern(rule, windowedEvents);
        break;
      case 'frequency':
        match = await this.matchFrequencyPattern(rule, windowedEvents);
        break;
      case 'correlation':
        match = await this.matchCorrelationPattern(rule, windowedEvents);
        break;
      case 'threshold':
        match = await this.matchThresholdPattern(rule, windowedEvents);
        break;
      case 'trend':
        match = await this.matchTrendPattern(rule, windowedEvents);
        break;
    }

    if (match) {
      await this.executeAction(rule, match);
    }
  }

  private async matchSequencePattern(
    rule: CEPRule, 
    newEvent: CEPEvent, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions } = rule.pattern;
    
    // Get or create partial matches for this rule
    const partialKey = rule.id;
    if (!this.partialMatches.has(partialKey)) {
      this.partialMatches.set(partialKey, []);
    }
    const partials = this.partialMatches.get(partialKey)!;

    // Check if new event matches any condition
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      
      if (this.matchesCondition(newEvent, condition)) {
        if (i === 0) {
          // Start of new sequence
          partials.push({
            ruleId: rule.id,
            matchedConditions: [i],
            matchedEvents: [newEvent],
            startTime: Date.now(),
          });
        } else {
          // Continue existing sequences
          for (const partial of partials) {
            const lastMatchedIdx = partial.matchedConditions[partial.matchedConditions.length - 1];
            if (lastMatchedIdx === i - 1) {
              partial.matchedConditions.push(i);
              partial.matchedEvents.push(newEvent);
            }
          }
        }
      }
    }

    // Check for complete matches
    const complete = partials.find(p => p.matchedConditions.length === conditions.length);
    if (complete) {
      // Remove this partial match
      this.partialMatches.set(
        partialKey,
        partials.filter(p => p !== complete)
      );

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedEvents: complete.matchedEvents,
        matchTime: new Date(),
        pattern: rule.pattern,
      };
    }

    // Cleanup expired partial matches
    const windowCutoff = Date.now() - rule.timeWindow;
    this.partialMatches.set(
      partialKey,
      partials.filter(p => p.startTime > windowCutoff)
    );

    return null;
  }

  private async matchAbsencePattern(
    rule: CEPRule, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions } = rule.pattern;
    
    // Check that the expected event type is absent
    for (const condition of conditions) {
      const found = events.some(e => this.matchesCondition(e, condition));
      if (found) {
        return null; // Event is present, no match
      }
    }

    // Event is absent - this is a match
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matchedEvents: [],
      matchTime: new Date(),
      pattern: rule.pattern,
    };
  }

  private async matchFrequencyPattern(
    rule: CEPRule, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions, minOccurrences, maxOccurrences } = rule.pattern;
    
    for (const condition of conditions) {
      const matchingEvents = events.filter(e => this.matchesCondition(e, condition));
      const count = matchingEvents.length;

      if (minOccurrences !== undefined && count < minOccurrences) {
        return null;
      }

      if (maxOccurrences !== undefined && count > maxOccurrences) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedEvents: matchingEvents,
          matchTime: new Date(),
          pattern: rule.pattern,
        };
      }

      if (minOccurrences !== undefined && count >= minOccurrences) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedEvents: matchingEvents,
          matchTime: new Date(),
          pattern: rule.pattern,
        };
      }
    }

    return null;
  }

  private async matchCorrelationPattern(
    rule: CEPRule, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions, correlationFields } = rule.pattern;
    
    if (!correlationFields?.length || conditions.length < 2) {
      return null;
    }

    // Group events by correlation field values
    const groups = new Map<string, CEPEvent[]>();
    
    for (const event of events) {
      const key = correlationFields
        .map(f => this.getNestedValue(event.data, f))
        .join('::');
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    // Check if any group has all required conditions matched
    for (const [, groupEvents] of groups) {
      const matchedConditions = conditions.filter(cond => 
        groupEvents.some(e => this.matchesCondition(e, cond))
      );

      if (matchedConditions.length === conditions.length) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedEvents: groupEvents,
          matchTime: new Date(),
          pattern: rule.pattern,
        };
      }
    }

    return null;
  }

  private async matchThresholdPattern(
    rule: CEPRule, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions } = rule.pattern;
    
    for (const condition of conditions) {
      if (!condition.field || condition.value === undefined) continue;

      const matchingEvents = events.filter(e => {
        if (condition.eventType && e.type !== condition.eventType) return false;
        
        const value = this.getNestedValue(e.data, condition.field!);
        
        switch (condition.operator) {
          case 'gt': return value > condition.value;
          case 'lt': return value < condition.value;
          case 'gte': return value >= condition.value;
          case 'lte': return value <= condition.value;
          default: return false;
        }
      });

      if (matchingEvents.length > 0) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedEvents: matchingEvents,
          matchTime: new Date(),
          pattern: rule.pattern,
        };
      }
    }

    return null;
  }

  private async matchTrendPattern(
    rule: CEPRule, 
    events: CEPEvent[]
  ): Promise<PatternMatch | null> {
    const { conditions } = rule.pattern;
    
    for (const condition of conditions) {
      if (!condition.field) continue;

      // Get values over time
      const matchingEvents = events
        .filter(e => !condition.eventType || e.type === condition.eventType)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (matchingEvents.length < 3) continue;

      const values = matchingEvents.map(e => 
        this.getNestedValue(e.data, condition.field!) as number
      ).filter(v => typeof v === 'number');

      if (values.length < 3) continue;

      // Simple trend detection using linear regression slope
      const trend = this.calculateTrend(values);
      
      const trendValue = condition.value as string;
      if (
        (trendValue === 'increasing' && trend > 0.1) ||
        (trendValue === 'decreasing' && trend < -0.1) ||
        (trendValue === 'stable' && Math.abs(trend) <= 0.1)
      ) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedEvents: matchingEvents,
          matchTime: new Date(),
          pattern: rule.pattern,
        };
      }
    }

    return null;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const sumX = values.reduce((acc, _, i) => acc + i, 0);
    const sumY = values.reduce((acc, v) => acc + v, 0);
    const sumXY = values.reduce((acc, v, i) => acc + i * v, 0);
    const sumX2 = values.reduce((acc, _, i) => acc + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return avgY !== 0 ? slope / avgY : 0; // Normalized slope
  }

  private matchesCondition(event: CEPEvent, condition: CEPCondition): boolean {
    if (condition.eventType && event.type !== condition.eventType) {
      return false;
    }

    if (!condition.field) {
      return true; // Just matching event type
    }

    const value = this.getNestedValue(event.data, condition.field);

    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'contains': return String(value).includes(condition.value);
      case 'regex': return new RegExp(condition.value).test(String(value));
      default: return true;
    }
  }

  private async executeAction(rule: CEPRule, match: PatternMatch) {
    this.logger.log(`Pattern matched: ${rule.name}`);
    
    // Store match in history
    this.matchHistory.push(match);
    if (this.matchHistory.length > 10000) {
      this.matchHistory.splice(0, 1000);
    }

    // Execute action based on type
    switch (rule.action.type) {
      case 'alert':
        await this.createAlert(rule, match);
        break;
      case 'email':
        await this.sendEmail(rule, match);
        break;
      case 'webhook':
        await this.callWebhook(rule, match);
        break;
      case 'emit':
        this.emitEvent(rule, match);
        break;
      case 'trigger_flow':
        await this.triggerWorkflow(rule, match);
        break;
      case 'aggregate':
        await this.storeAggregation(rule, match);
        break;
    }
  }

  private async createAlert(rule: CEPRule, match: PatternMatch) {
    this.eventEmitter.emit('alert.create', {
      type: 'cep_pattern_match',
      severity: rule.action.config.severity || 'warning',
      title: rule.action.config.title || `Pattern Matched: ${rule.name}`,
      message: rule.action.config.message || 
        `Pattern "${rule.pattern.type}" matched with ${match.matchedEvents.length} events`,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        patternType: rule.pattern.type,
        matchedEventCount: match.matchedEvents.length,
      },
    });
  }

  private async sendEmail(rule: CEPRule, match: PatternMatch) {
    this.eventEmitter.emit('email.send', {
      to: rule.action.config.recipients,
      subject: rule.action.config.subject || `Alert: ${rule.name}`,
      template: 'cep-alert',
      data: {
        ruleName: rule.name,
        patternType: rule.pattern.type,
        matchTime: match.matchTime,
        eventCount: match.matchedEvents.length,
      },
    });
  }

  private async callWebhook(rule: CEPRule, match: PatternMatch) {
    try {
      await fetch(rule.action.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(rule.action.config.headers || {}),
        },
        body: JSON.stringify({
          rule: { id: rule.id, name: rule.name },
          pattern: rule.pattern,
          match: {
            time: match.matchTime,
            events: match.matchedEvents.slice(0, 100), // Limit payload size
          },
        }),
      });
    } catch (error) {
      this.logger.error(`Webhook failed for rule ${rule.name}:`, error);
    }
  }

  private emitEvent(rule: CEPRule, match: PatternMatch) {
    const eventName = rule.action.config.eventName || 'cep.pattern.matched';
    this.eventEmitter.emit(eventName, {
      rule,
      match,
    });
  }

  private async triggerWorkflow(rule: CEPRule, match: PatternMatch) {
    this.eventEmitter.emit('workflow.trigger', {
      workflowId: rule.action.config.workflowId,
      input: {
        rule,
        match,
      },
    });
  }

  private async storeAggregation(rule: CEPRule, match: PatternMatch) {
    // Store aggregated result
    this.eventEmitter.emit('analytics.store', {
      type: 'cep_aggregation',
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: match.matchTime,
      data: {
        eventCount: match.matchedEvents.length,
        events: match.matchedEvents.map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          data: e.data,
        })),
      },
    });
  }

  private cleanupExpiredBuffers() {
    const maxWindow = Math.max(
      ...Array.from(this.rules.values()).map(r => r.timeWindow),
      300000
    );
    const cutoff = Date.now() - maxWindow;

    for (const [key, buffer] of this.eventBuffer.entries()) {
      const trimmed = buffer.filter(e => e.timestamp > cutoff);
      if (trimmed.length === 0) {
        this.eventBuffer.delete(key);
      } else {
        this.eventBuffer.set(key, trimmed);
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  // Query methods
  getMatchHistory(limit = 100): PatternMatch[] {
    return this.matchHistory.slice(-limit);
  }

  getStats() {
    return {
      activeRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalRules: this.rules.size,
      bufferedEvents: Array.from(this.eventBuffer.values())
        .reduce((acc, buf) => acc + buf.length, 0),
      recentMatches: this.matchHistory.length,
      partialMatches: Array.from(this.partialMatches.values())
        .reduce((acc, partials) => acc + partials.length, 0),
    };
  }
}

interface PartialMatch {
  ruleId: string;
  matchedConditions: number[];
  matchedEvents: CEPEvent[];
  startTime: number;
}
