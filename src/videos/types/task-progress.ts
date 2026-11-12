import type { VideoTaskStatus } from './video-task-status.js';

export type TaskProgressResult = {
  taskId: string;
  status: VideoTaskStatus;
  progress: number;
  etaSeconds: number;
};
