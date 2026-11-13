import { describe, expect, it } from 'vitest';
import {
  buildTaskOutcomeHtml,
  buildTaskOutcomeSubject,
  buildTaskOutcomeText,
} from './email.templates.js';

describe('email.templates', () => {
  it('builds completed subject and bodies', () => {
    const input = { taskId: 'task-1', status: 'completed' as const };

    expect(buildTaskOutcomeSubject(input)).toBe(
      'Video task task-1 completed',
    );
    expect(buildTaskOutcomeText(input)).toContain('Status: completed');
    expect(buildTaskOutcomeHtml(input)).toContain('<strong>Status:</strong> completed');
    expect(buildTaskOutcomeHtml(input)).not.toContain('Reason');
  });

  it('includes failure reason and escapes HTML', () => {
    const input = {
      taskId: 'task-2',
      status: 'failed' as const,
      failureReason: 'boom <script>',
    };

    expect(buildTaskOutcomeSubject(input)).toBe('Video task task-2 failed');
    expect(buildTaskOutcomeText(input)).toContain('Reason: boom <script>');
    expect(buildTaskOutcomeHtml(input)).toContain('boom &lt;script&gt;');
  });
});
