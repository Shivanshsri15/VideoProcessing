import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  MAIL_FROM_DEFAULT,
  SMTP_DEFAULT_HOST,
  SMTP_DEFAULT_PORT,
  SMTP_DEFAULT_SECURE,
} from './constants/email.constants.js';
import {
  buildTaskOutcomeHtml,
  buildTaskOutcomeSubject,
  buildTaskOutcomeText,
  type TaskOutcomeMailInput,
} from './email.templates.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST', SMTP_DEFAULT_HOST);
    const port = Number(
      config.get<string | number>('SMTP_PORT', SMTP_DEFAULT_PORT),
    );
    const secure =
      String(config.get('SMTP_SECURE', SMTP_DEFAULT_SECURE)) === 'true';
    const user = config.get<string>('SMTP_USER', '')?.trim();
    const pass = config.get<string>('SMTP_PASS', '')?.trim();

    this.from = config.get<string>('MAIL_FROM', MAIL_FROM_DEFAULT);
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user || pass ? { auth: { user: user || '', pass: pass || '' } } : {}),
    });
  }

  sendTaskOutcome = async (
    input: TaskOutcomeMailInput & { to: string },
  ): Promise<void> => {
    const { to, ...templateInput } = input;
    const subject = buildTaskOutcomeSubject(templateInput);
    const text = buildTaskOutcomeText(templateInput);
    const html = buildTaskOutcomeHtml(templateInput);

    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
    this.logger.log(
      `Sent task outcome mail taskId=${templateInput.taskId} status=${templateInput.status} to=${to}`,
    );
  };
}
