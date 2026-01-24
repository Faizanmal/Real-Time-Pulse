import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationSeverity } from '@prisma/client';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private templatesCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const config = this.configService.get('email');

    this.transporter = nodemailer.createTransport({
      host: config.host as string,

      port: config.port as number,

      secure: config.secure as boolean,

      auth: config.auth as Record<string, string>,
    });

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('Email transporter verification failed', error);
      } else {
        this.logger.log('Email transporter is ready');
      }
    });
  }

  private loadTemplate(templateName: string): handlebars.TemplateDelegate {
    // Check cache first
    if (this.templatesCache.has(templateName)) {
      return this.templatesCache.get(templateName);
    }

    // Load from file
    const templatesDir = path.join(process.cwd(), 'src', 'email', 'templates');
    const templatePath = path.join(templatesDir, `${templateName}.hbs`);

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);
      this.templatesCache.set(templateName, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      this.logger.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const config = this.configService.get('email');
      let html = options.html;

      // Compile template if provided
      if (options.template && options.context) {
        const template = this.loadTemplate(options.template);

        html = template(options.context);
      }

      const mailOptions = {
        from: `${config.from.name} <${config.from.address}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully: ${info.messageId as string}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send email', error);
      return false;
    }
  }

  // Convenience methods for common email types
  async sendWelcomeEmail(to: string, userName: string, workspaceName: string) {
    return this.sendEmail({
      to,
      subject: `Welcome to ${workspaceName}!`,
      template: 'welcome',
      context: {
        userName,
        workspaceName,
        loginUrl: `${this.configService.get('app.frontendUrl')}/auth/signin`,
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string) {
    const resetUrl = `${this.configService.get('app.frontendUrl')}/auth/reset-password?token=${resetToken}`;

    return this.sendEmail({
      to,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: {
        resetUrl,
        expiryHours: 1,
      },
    });
  }

  async sendInvitationEmail(
    to: string,
    inviterName: string,
    workspaceName: string,
    inviteToken: string,
  ) {
    const inviteUrl = `${this.configService.get('app.frontendUrl')}/auth/accept-invite?token=${inviteToken}`;

    return this.sendEmail({
      to,
      subject: `You've been invited to join ${workspaceName}`,
      template: 'invitation',
      context: {
        inviterName,
        workspaceName,
        inviteUrl,
      },
    });
  }

  async sendWorkspaceInvitationEmail(options: {
    to: string;
    inviterName: string;
    workspaceName: string;
    tempPassword: string;
  }) {
    const loginUrl = `${this.configService.get('app.frontendUrl')}/auth/signin`;

    return this.sendEmail({
      to: options.to,
      subject: `Access to ${options.workspaceName}`,
      template: 'workspace-invitation',
      context: {
        inviterName: options.inviterName,
        workspaceName: options.workspaceName,
        tempPassword: options.tempPassword,
        loginUrl,
      },
    });
  }

  async sendValidationViolationEmail(options: {
    to: string[];
    ruleName: string;
    ruleSeverity: ValidationSeverity;
    workspaceName: string;
    fieldPath: string;
    expectedValue?: string;
    actualValue?: string;
    violationType: string;
  }) {
    return this.sendEmail({
      to: options.to,
      subject: `Data validation alert: ${options.ruleName}`,
      template: 'data-validation-violation',
      context: {
        ruleName: options.ruleName,
        ruleSeverity: options.ruleSeverity,
        workspaceName: options.workspaceName,
        fieldPath: options.fieldPath,
        expectedValue: options.expectedValue,
        actualValue: options.actualValue,
        violationType: options.violationType,
      },
    });
  }

  async sendPortalSharedEmail(to: string, portalName: string, shareUrl: string, message?: string) {
    return this.sendEmail({
      to,
      subject: `${portalName} has been shared with you`,
      template: 'portal-shared',
      context: {
        portalName,
        shareUrl,
        message: message || 'A new portal has been shared with you.',
      },
    });
  }

  async sendSubscriptionExpiringEmail(to: string, workspaceName: string, daysRemaining: number) {
    return this.sendEmail({
      to,
      subject: `Your ${workspaceName} subscription is expiring soon`,
      template: 'subscription-expiring',
      context: {
        workspaceName,
        daysRemaining,
        renewUrl: `${this.configService.get('app.frontendUrl')}/settings/billing`,
      },
    });
  }
}
