import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmailService } from '../../email/email.service';
import { QUEUE_NAMES } from '../queue.constants';
import { EmailJobData } from '../jobs.service';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJobData>) {
    this.logger.log(`Processing email job ${job.id}`);

    try {
      await this.emailService.sendEmail({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template,
        context: job.data.context,
        html: job.data.html,
      });

      this.logger.log(`Email sent successfully for job ${job.id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send email for job ${job.id}`, error);
      throw error; // Will trigger retry
    }
  }
}
