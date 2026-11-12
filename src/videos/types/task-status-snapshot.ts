import type { VideoTaskMetadata } from './video-task-metadata.js';
import type { VideoTaskStatus } from './video-task-status.js';

/** Cached / API-facing task status snapshot. */
export type TaskStatusSnapshot = {
  taskId: string;
  status: VideoTaskStatus;
  progress: number;
  etaSeconds: number;
  s3Key: string;
  metadata: VideoTaskMetadata;
  updatedAt: string;
  failureReason?: string;
  outputKey?: string;
  thumbnailKey?: string;
  startedAt?: string;
  completedAt?: string;
};
