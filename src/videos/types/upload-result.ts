import type { VideoTaskMetadata } from './video-task-metadata.js';
import type { VideoTaskStatus } from './video-task-status.js';

export type UploadResult = {
  taskId: string;
  status: VideoTaskStatus;
  s3Key: string;
  etaSeconds: number;
  progress: number;
  metadata: VideoTaskMetadata;
};
