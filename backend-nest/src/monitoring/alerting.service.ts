/**
 * Alerting Service
 * Handles custom alerts for high latency, errors, and business metrics
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggingService } from '../common/logger/logging.service';
import { MonitoringService } from './monitoring.service';
import { NotificationService } from '../notifications/notification.service';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  severity: 'critical' | 'warning' | 'info';
  channels: ('slack' | 'email' | 'pagerduty' | 'webhook')[];
  enabled: boolean;
}

export interface ActiveAlert {
  ruleId: string;
  triggeredAt: Date;
  value: number;
  notified: boolean;
}

@Injectable()
export class AlertingService implements OnModuleInit {
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private alertHistory: any[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly monitoringService: MonitoringService,
    private readonly notificationsService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.loadAlertRules();
    this.logger.log('Alerting service initialized', 'AlertingService');
  }

  /**
   * Load alert rules from database or config
   */
  private async loadAlertRules() {
    // Default alert rules
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'HTTP error rate exceeds threshold',
        metric: 'http_errors_total',
        condition: 'gt',
        threshold: 0.05, // 5%
        duration: 300, // 5 minutes
        severity: 'critical',
        channels: ['slack', 'pagerduty'],
        enabled: true,
      },
      {
        id: 'high_latency',
        name: 'High API Latency',
        description: 'P95 latency exceeds threshold',
        metric: 'http_request_duration_seconds_p95',
        condition: 'gt',
        threshold: 2, // 2 seconds
        duration: 300,
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'database_connection_pool',
        name: 'Database Connection Pool Exhausted',
        description: 'Database connections near limit',
        metric: 'database_connections_active',
        condition: 'gte',
        threshold: 90, // 90%
        duration: 60,
        severity: 'critical',
        channels: ['slack', 'pagerduty', 'email'],
        enabled: true,
      },
      {
        id: 'memory_usage',
        name: 'High Memory Usage',
        description: 'Process memory usage exceeds threshold',
        metric: 'process_memory_usage_percent',
        condition: 'gt',
        threshold: 85,
        duration: 300,
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'websocket_disconnections',
        name: 'High WebSocket Disconnection Rate',
        description: 'Unusual number of WebSocket disconnections',
        metric: 'websocket_disconnections_rate',
        condition: 'gt',
        threshold: 100,
        duration: 60,
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'failed_jobs',
        name: 'High Job Failure Rate',
        description: 'Background job failures exceed threshold',
        metric: 'background_jobs_failed_rate',
        condition: 'gt',
        threshold: 0.1, // 10%
        duration: 300,
        severity: 'warning',
        channels: ['slack', 'email'],
        enabled: true,
      },
      {
        id: 'external_api_failures',
        name: 'External API Failures',
        description: 'External API error rate exceeds threshold',
        metric: 'external_api_errors_rate',
        condition: 'gt',
        threshold: 0.2, // 20%
        duration: 120,
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
      },
    ];
  }

  /**
   * Check all alert rules periodically
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAlerts() {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const currentValue = await this.getMetricValue(rule.metric);
        const isTriggered = this.evaluateCondition(currentValue, rule.condition, rule.threshold);

        if (isTriggered) {
          await this.handleTriggeredAlert(rule, currentValue);
        } else {
          await this.handleResolvedAlert(rule);
        }
      } catch (error) {
        this.logger.error(`Error checking alert ${rule.id}: ${error}`, 'AlertingService');
      }
    }
  }

  /**
   * Get current value of a metric
   */
  private async getMetricValue(metric: string): Promise<number> {
    const metrics = this.monitoringService.getMetrics();
    
    // Check counters
    for (const [key, value] of Object.entries(metrics.counters)) {
      if (key.startsWith(metric)) {
        return value as number;
      }
    }
    
    // Check gauges
    for (const [key, value] of Object.entries(metrics.gauges)) {
      if (key.startsWith(metric)) {
        return value as number;
      }
    }

    // Calculate rates for rate-based metrics
    if (metric.endsWith('_rate')) {
      return this.calculateRate(metric.replace('_rate', '_total'));
    }

    return 0;
  }

  /**
   * Calculate rate over time window
   */
  private calculateRate(counterName: string): number {
    // Simplified rate calculation
    // In production, use a time-series store for proper rate calculation
    const metrics = this.monitoringService.getMetrics();
    const count = (metrics.counters as any)[counterName] || 0;
    return count / 60; // Per second rate over last minute
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * Handle triggered alert
   */
  private async handleTriggeredAlert(rule: AlertRule, value: number) {
    const existingAlert = this.activeAlerts.get(rule.id);

    if (existingAlert) {
      // Check if duration threshold is met
      const durationMs = Date.now() - existingAlert.triggeredAt.getTime();
      if (durationMs >= rule.duration * 1000 && !existingAlert.notified) {
        await this.sendAlertNotification(rule, value);
        existingAlert.notified = true;
        this.activeAlerts.set(rule.id, existingAlert);
      }
    } else {
      // New alert trigger
      this.activeAlerts.set(rule.id, {
        ruleId: rule.id,
        triggeredAt: new Date(),
        value,
        notified: false,
      });
    }
  }

  /**
   * Handle resolved alert
   */
  private async handleResolvedAlert(rule: AlertRule) {
    const existingAlert = this.activeAlerts.get(rule.id);

    if (existingAlert && existingAlert.notified) {
      await this.sendResolutionNotification(rule);
      this.alertHistory.push({
        ...existingAlert,
        resolvedAt: new Date(),
        ruleName: rule.name,
      });
    }

    this.activeAlerts.delete(rule.id);
  }

  /**
   * Send alert notification to configured channels
   */
  private async sendAlertNotification(rule: AlertRule, value: number) {
    const alert = {
      id: `alert_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      severity: rule.severity,
      value,
      threshold: rule.threshold,
      triggeredAt: new Date(),
    };

    this.logger.warn(`Alert triggered: ${rule.name} - ${JSON.stringify({ alert })}`);

    for (const channel of rule.channels) {
      try {
        switch (channel) {
          case 'slack':
            await this.sendSlackAlert(alert);
            break;
          case 'email':
            await this.sendEmailAlert(alert);
            break;
          case 'pagerduty':
            await this.sendPagerDutyAlert(alert);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} alert: ${error}`, 'AlertingService');
      }
    }
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(rule: AlertRule) {
    const resolution = {
      ruleId: rule.id,
      ruleName: rule.name,
      resolvedAt: new Date(),
    };

    this.logger.log(`Alert resolved: ${rule.name}`, 'AlertingService');

    for (const channel of rule.channels) {
      try {
        switch (channel) {
          case 'slack':
            await this.sendSlackResolution(resolution);
            break;
          case 'pagerduty':
            await this.sendPagerDutyResolution(resolution);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} resolution: ${error}`, 'AlertingService');
      }
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: any) {
    const webhookUrl = this.configService.get<string>('monitoring.slackWebhookUrl');
    if (!webhookUrl) return;

    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${severityEmoji[alert.severity]} Alert: ${alert.ruleName}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${alert.severity.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Value:*\n${alert.value}` },
            { type: 'mrkdwn', text: `*Threshold:*\n${alert.threshold}` },
            { type: 'mrkdwn', text: `*Time:*\n${alert.triggeredAt.toISOString()}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: alert.description },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send Slack resolution
   */
  private async sendSlackResolution(resolution: any) {
    const webhookUrl = this.configService.get<string>('monitoring.slackWebhookUrl');
    if (!webhookUrl) return;

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `✅ Resolved: ${resolution.ruleName}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Alert resolved at ${resolution.resolvedAt.toISOString()}`,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: any) {
    const alertEmails = this.configService.get<string>('monitoring.alertEmails');
    if (!alertEmails) return;

    // await this.notificationsService.sendEmail({
    //   to: alertEmails.split(','),
    //   subject: `[${alert.severity.toUpperCase()}] Alert: ${alert.ruleName}`,
    //   template: 'alert',
    //   data: alert,
    // });
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: any) {
    const routingKey = this.configService.get<string>('monitoring.pagerdutyRoutingKey');
    if (!routingKey) return;

    const payload = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: alert.ruleId,
      payload: {
        summary: `${alert.ruleName}: ${alert.description}`,
        severity: alert.severity,
        source: 'Real-Time Pulse',
        custom_details: {
          value: alert.value,
          threshold: alert.threshold,
        },
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send PagerDuty resolution
   */
  private async sendPagerDutyResolution(resolution: any) {
    const routingKey = this.configService.get<string>('monitoring.pagerdutyRoutingKey');
    if (!routingKey) return;

    const payload = {
      routing_key: routingKey,
      event_action: 'resolve',
      dedup_key: resolution.ruleId,
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: any) {
    const webhookUrl = this.configService.get<string>('monitoring.alertWebhookUrl');
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
  }

  /**
   * Create custom alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `custom_${Date.now()}`,
    };
    this.alertRules.push(newRule);
    return newRule;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.alertRules;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): any[] {
    return this.alertHistory.slice(-limit);
  }
}
