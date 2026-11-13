import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: '1' });
    createTransport.mockReturnValue({ sendMail });
  });

  it('sends task outcome mail via nodemailer', async () => {
    const { EmailService } = await import('./email.service.js');
    const service = new EmailService({
      get: (key: string, fallback?: unknown) => {
        const map: Record<string, unknown> = {
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_SECURE: 'false',
          SMTP_USER: '',
          SMTP_PASS: '',
          MAIL_FROM: 'Video Process <noreply@localhost>',
        };
        return map[key] ?? fallback;
      },
    } as never);

    await service.sendTaskOutcome({
      to: 'user@example.com',
      taskId: 'task-1',
      status: 'completed',
    });

    expect(createTransport).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Video task task-1 completed',
        text: expect.stringContaining('Status: completed'),
        html: expect.stringContaining('completed'),
      }),
    );
  });
});
