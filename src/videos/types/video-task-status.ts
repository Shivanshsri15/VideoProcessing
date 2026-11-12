export const VIDEO_TASK_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

export type VideoTaskStatus = (typeof VIDEO_TASK_STATUSES)[number];
