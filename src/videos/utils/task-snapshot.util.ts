import type { VideoTaskDocument } from '../schemas/video-task.schema.js';
import type { TaskStatusSnapshot } from '../types/task-status-snapshot.js';

/** Map a Mongo video task document to the Redis/API status snapshot. */
export const buildTaskStatusSnapshot = (
  task: VideoTaskDocument,
): TaskStatusSnapshot => {
  const updatedAt =
    task.updatedAt instanceof Date
      ? task.updatedAt.toISOString()
      : new Date().toISOString();

  const snapshot: TaskStatusSnapshot = {
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    etaSeconds: task.etaSeconds,
    s3Key: task.s3Key,
    metadata: { durationSec: task.metadata.durationSec },
    updatedAt,
  };

  if (task.failureReason) {
    snapshot.failureReason = task.failureReason;
  }
  if (task.outputKey) {
    snapshot.outputKey = task.outputKey;
  }
  if (task.thumbnailKey) {
    snapshot.thumbnailKey = task.thumbnailKey;
  }
  if (task.startedAt instanceof Date) {
    snapshot.startedAt = task.startedAt.toISOString();
  }
  if (task.completedAt instanceof Date) {
    snapshot.completedAt = task.completedAt.toISOString();
  }

  return snapshot;
};
