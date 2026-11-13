export type TaskOutcomeMailInput = {
  taskId: string;
  status: 'completed' | 'failed';
  failureReason?: string;
};

export const buildTaskOutcomeSubject = (
  input: TaskOutcomeMailInput,
): string => `Video task ${input.taskId} ${input.status}`;

export const buildTaskOutcomeText = (input: TaskOutcomeMailInput): string => {
  const lines = [
    `Your video task has finished.`,
    ``,
    `Task ID: ${input.taskId}`,
    `Status: ${input.status}`,
  ];
  if (input.status === 'failed' && input.failureReason) {
    lines.push(`Reason: ${input.failureReason}`);
  }
  return lines.join('\n');
};

export const buildTaskOutcomeHtml = (input: TaskOutcomeMailInput): string => {
  const reason =
    input.status === 'failed' && input.failureReason
      ? `<p><strong>Reason:</strong> ${escapeHtml(input.failureReason)}</p>`
      : '';
  return [
    `<p>Your video task has finished.</p>`,
    `<p><strong>Task ID:</strong> ${escapeHtml(input.taskId)}</p>`,
    `<p><strong>Status:</strong> ${escapeHtml(input.status)}</p>`,
    reason,
  ].join('\n');
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
