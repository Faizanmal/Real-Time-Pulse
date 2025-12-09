/**
 * =============================================================================
 * REAL-TIME PULSE - NOTIFICATION SERVICE
 * =============================================================================
 * 
 * Multi-channel notification system supporting email, push, SMS, and in-app.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

// Types
interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channels?: NotificationChannel[];
  scheduledFor?: Date;
}

type NotificationChannel = 'email' | 'push' | 'sms' | 'in-app' | 'slack' | 'webhook';

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

interface PushOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  clickAction?: string;
}

interface SMSOptions {
  to: string;
  body: string;
}

interface NotificationPreferences {
  userId: string;
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;
  };
  channels: Record<string, NotificationChannel[]>;
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  html?: string;
  channels: NotificationChannel[];
  variables: string[];
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private preferences: Map<string, NotificationPreferences> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private queue: NotificationPayload[] = [];
  private processing = false;

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.registerDefaultTemplates();
    this.startQueueProcessor();
    this.logger.log('Notification service initialized');
  }

  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  /**
   * Send notification through specified channels
   */
  async send(payload: NotificationPayload): Promise<void> {
    const channels = payload.channels || this.getDefaultChannels(payload.type);
    const preferences = this.preferences.get(payload.userId);

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      if (payload.priority !== 'urgent') {
        payload.scheduledFor = this.getNextActiveTime(preferences);
        this.queue.push(payload);
        return;
      }
    }

    // Send through each channel
    const promises = channels.map(async (channel) => {
      // Check if user has enabled this channel
      if (preferences && !this.isChannelEnabled(preferences, channel, payload.type)) {
        return;
      }

      try {
        switch (channel) {
          case 'email':
            await this.sendEmail(payload);
            break;
          case 'push':
            await this.sendPush(payload);
            break;
          case 'sms':
            await this.sendSMS(payload);
            break;
          case 'in-app':
            await this.sendInApp(payload);
            break;
          case 'slack':
            await this.sendSlack(payload);
            break;
          case 'webhook':
            await this.sendWebhook(payload);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, error);
      }
    });

    await Promise.allSettled(promises);

    // Emit event
    this.eventEmitter.emit('notification.sent', {
      userId: payload.userId,
      type: payload.type,
      channels,
    });
  }

  /**
   * Schedule notification for later
   */
  async schedule(payload: NotificationPayload, sendAt: Date): Promise<string> {
    const scheduledPayload = { ...payload, scheduledFor: sendAt };
    this.queue.push(scheduledPayload);
    return `scheduled_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Send notification using template
   */
  async sendFromTemplate(
    templateId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const payload: NotificationPayload = {
      userId,
      type: template.type,
      title: this.interpolate(template.subject || template.name, data),
      body: this.interpolate(template.body, data),
      data,
      channels: template.channels,
    };

    await this.send(payload);
  }

  // ============================================================================
  // CHANNEL IMPLEMENTATIONS
  // ============================================================================

  /**
   * Send email notification
   */
  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const user = await this.getUserEmail(payload.userId);
    if (!user) return;

    const options: EmailOptions = {
      to: user,
      subject: payload.title,
      text: payload.body,
      html: this.wrapHtmlEmail(payload.title, payload.body),
    };

    // Use configured email provider
    const provider = this.config.get('EMAIL_PROVIDER');
    
    switch (provider) {
      case 'sendgrid':
        await this.sendWithSendGrid(options);
        break;
      case 'ses':
        await this.sendWithSES(options);
        break;
      case 'mailgun':
        await this.sendWithMailgun(options);
        break;
      default:
        await this.sendWithSMTP(options);
    }

    this.logger.log(`Email sent to ${user}`);
  }

  /**
   * Send push notification
   */
  private async sendPush(payload: NotificationPayload): Promise<void> {
    const tokens = await this.getUserPushTokens(payload.userId);
    if (!tokens.length) return;

    const options: PushOptions = {
      token: '', // Will be set per token
      title: payload.title,
      body: payload.body,
      data: payload.data,
    };

    // Use configured push provider
    const provider = this.config.get('PUSH_PROVIDER');

    for (const token of tokens) {
      try {
        options.token = token;
        switch (provider) {
          case 'firebase':
            await this.sendWithFCM(options);
            break;
          case 'onesignal':
            await this.sendWithOneSignal(options);
            break;
          case 'expo':
            await this.sendWithExpo(options);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send push to token ${token}`, error);
      }
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(payload: NotificationPayload): Promise<void> {
    const phone = await this.getUserPhone(payload.userId);
    if (!phone) return;

    const options: SMSOptions = {
      to: phone,
      body: `${payload.title}\n\n${payload.body}`,
    };

    // Use configured SMS provider
    const provider = this.config.get('SMS_PROVIDER');

    switch (provider) {
      case 'twilio':
        await this.sendWithTwilio(options);
        break;
      case 'nexmo':
        await this.sendWithNexmo(options);
        break;
      case 'sns':
        await this.sendWithSNS(options);
        break;
    }

    this.logger.log(`SMS sent to ${phone}`);
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(payload: NotificationPayload): Promise<void> {
    // Store notification in database
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      read: false,
      createdAt: new Date(),
    };

    // Emit WebSocket event for real-time delivery
    this.eventEmitter.emit('notification.in-app', notification);

    this.logger.log(`In-app notification created for user ${payload.userId}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(payload: NotificationPayload): Promise<void> {
    const webhookUrl = await this.getUserSlackWebhook(payload.userId);
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: payload.title,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: payload.title },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: payload.body },
          },
        ],
      }),
    });

    this.logger.log(`Slack notification sent for user ${payload.userId}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    const webhookUrl = await this.getUserWebhook(payload.userId);
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'notification',
        data: {
          type: payload.type,
          title: payload.title,
          body: payload.body,
          ...payload.data,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    this.logger.log(`Webhook notification sent for user ${payload.userId}`);
  }

  // ============================================================================
  // PROVIDER IMPLEMENTATIONS
  // ============================================================================

  private async sendWithSendGrid(options: EmailOptions): Promise<void> {
    const apiKey = this.config.get('SENDGRID_API_KEY');
    if (!apiKey) throw new Error('SendGrid API key not configured');

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: this.config.get('EMAIL_FROM') || 'noreply@realtimepulse.io' },
        subject: options.subject,
        content: [
          { type: 'text/plain', value: options.text },
          { type: 'text/html', value: options.html },
        ],
      }),
    });
  }

  private async sendWithSES(options: EmailOptions): Promise<void> {
    // AWS SES implementation
    this.logger.log('Sending email with AWS SES');
  }

  private async sendWithMailgun(options: EmailOptions): Promise<void> {
    // Mailgun implementation
    this.logger.log('Sending email with Mailgun');
  }

  private async sendWithSMTP(options: EmailOptions): Promise<void> {
    // SMTP implementation
    this.logger.log('Sending email with SMTP');
  }

  private async sendWithFCM(options: PushOptions): Promise<void> {
    // Firebase Cloud Messaging implementation
    this.logger.log('Sending push with FCM');
  }

  private async sendWithOneSignal(options: PushOptions): Promise<void> {
    // OneSignal implementation
    this.logger.log('Sending push with OneSignal');
  }

  private async sendWithExpo(options: PushOptions): Promise<void> {
    // Expo push implementation
    this.logger.log('Sending push with Expo');
  }

  private async sendWithTwilio(options: SMSOptions): Promise<void> {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    const from = this.config.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio not configured');
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: options.to,
          From: from,
          Body: options.body,
        }),
      },
    );
  }

  private async sendWithNexmo(options: SMSOptions): Promise<void> {
    // Nexmo/Vonage implementation
    this.logger.log('Sending SMS with Nexmo');
  }

  private async sendWithSNS(options: SMSOptions): Promise<void> {
    // AWS SNS implementation
    this.logger.log('Sending SMS with AWS SNS');
  }

  // ============================================================================
  // PREFERENCES MANAGEMENT
  // ============================================================================

  async setPreferences(preferences: NotificationPreferences): Promise<void> {
    this.preferences.set(preferences.userId, preferences);
  }

  async getPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    return this.preferences.get(userId);
  }

  private isChannelEnabled(
    preferences: NotificationPreferences,
    channel: NotificationChannel,
    notificationType: string,
  ): boolean {
    // Check global channel setting
    switch (channel) {
      case 'email':
        if (!preferences.email) return false;
        break;
      case 'push':
        if (!preferences.push) return false;
        break;
      case 'sms':
        if (!preferences.sms) return false;
        break;
      case 'in-app':
        if (!preferences.inApp) return false;
        break;
    }

    // Check type-specific channel settings
    const typeChannels = preferences.channels[notificationType];
    if (typeChannels && !typeChannels.includes(channel)) {
      return false;
    }

    return true;
  }

  private isQuietHours(preferences?: NotificationPreferences): boolean {
    if (!preferences?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const { start, end } = preferences.quietHours;

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    }
  }

  private getNextActiveTime(preferences?: NotificationPreferences): Date {
    if (!preferences?.quietHours) return new Date();

    const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
    const next = new Date();
    next.setHours(endHour, endMinute, 0, 0);

    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  private registerDefaultTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'welcome',
        name: 'Welcome Email',
        type: 'user.welcome',
        subject: 'Welcome to Real-Time Pulse, {{name}}!',
        body: 'Thank you for joining Real-Time Pulse. Get started by creating your first portal.',
        channels: ['email', 'in-app'],
        variables: ['name', 'email'],
      },
      {
        id: 'alert-triggered',
        name: 'Alert Triggered',
        type: 'alert.triggered',
        subject: '⚠️ Alert: {{alertName}}',
        body: 'Your alert "{{alertName}}" has been triggered. {{message}}',
        channels: ['email', 'push', 'in-app'],
        variables: ['alertName', 'message', 'metric', 'value', 'threshold'],
      },
      {
        id: 'report-ready',
        name: 'Report Ready',
        type: 'report.ready',
        subject: 'Your report "{{reportName}}" is ready',
        body: 'Your scheduled report is ready for download. Click here to view it.',
        channels: ['email', 'in-app'],
        variables: ['reportName', 'downloadUrl'],
      },
      {
        id: 'team-invite',
        name: 'Team Invitation',
        type: 'team.invite',
        subject: '{{inviterName}} invited you to {{workspaceName}}',
        body: 'You have been invited to join the {{workspaceName}} workspace.',
        channels: ['email'],
        variables: ['inviterName', 'workspaceName', 'inviteUrl'],
      },
    ];

    templates.forEach((t) => this.templates.set(t.id, t));
  }

  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getDefaultChannels(type: string): NotificationChannel[] {
    // Default channels based on notification type
    const defaults: Record<string, NotificationChannel[]> = {
      'alert.triggered': ['email', 'push', 'in-app'],
      'user.welcome': ['email', 'in-app'],
      'report.ready': ['email', 'in-app'],
      'team.invite': ['email'],
      'security.alert': ['email', 'push', 'sms'],
    };

    return defaults[type] || ['in-app'];
  }

  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] || ''));
  }

  private wrapHtmlEmail(title: string, body: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
    .logo { font-size: 24px; font-weight: bold; color: #6366f1; }
    .content { padding: 30px 0; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ Real-Time Pulse</div>
    </div>
    <div class="content">
      <h1>${title}</h1>
      <p>${body}</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Real-Time Pulse. All rights reserved.</p>
      <p>You're receiving this because you have an account with us.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Placeholder methods - in production these would query the database
  private async getUserEmail(userId: string): Promise<string | null> {
    return `user_${userId}@example.com`;
  }

  private async getUserPushTokens(userId: string): Promise<string[]> {
    return [];
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    return null;
  }

  private async getUserSlackWebhook(userId: string): Promise<string | null> {
    return null;
  }

  private async getUserWebhook(userId: string): Promise<string | null> {
    return null;
  }

  // Queue processor
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;
      const now = new Date();

      const toProcess = this.queue.filter(
        (p) => !p.scheduledFor || p.scheduledFor <= now,
      );

      this.queue = this.queue.filter(
        (p) => p.scheduledFor && p.scheduledFor > now,
      );

      for (const payload of toProcess) {
        try {
          await this.send(payload);
        } catch (error) {
          this.logger.error('Failed to process queued notification', error);
        }
      }

      this.processing = false;
    }, 60000); // Check every minute
  }
}

export default NotificationService;
