import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoProcessingService } from './video-processing.service.js';

describe('VideoProcessingService.processJob', () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const findOne = vi.fn();
  const downloadObjectToFile = vi.fn();
  const uploadFile = vi.fn();
  const deleteProcessedArtifacts = vi.fn();
  const buildTaskOutputKey = vi.fn(
    (userId: string, taskId: string) =>
      `originals/${userId}/${taskId}/output.mp4`,
  );
  const buildTaskThumbnailKey = vi.fn(
    (userId: string, taskId: string) =>
      `thumbnails/${userId}/${taskId}/thumb.jpg`,
  );
  const statusCacheSet = vi.fn().mockResolvedValue(undefined);

  let service: VideoProcessingService;
  let task: {
    taskId: string;
    status: string;
    progress: number;
    metadata: { durationSec: number };
    failureReason?: string;
    save: typeof save;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    task = {
      taskId: 'task-1',
      status: 'queued',
      progress: 0,
      metadata: { durationSec: 10 },
      save,
    };
    findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(task) });
    downloadObjectToFile.mockRejectedValue(new Error('download blew up'));
    deleteProcessedArtifacts.mockResolvedValue(undefined);

    service = new VideoProcessingService(
      { findOne } as never,
      {
        downloadObjectToFile,
        uploadFile,
        deleteProcessedArtifacts,
        buildTaskOutputKey,
        buildTaskThumbnailKey,
      } as never,
      { set: statusCacheSet } as never,
      { get: () => 'ffmpeg' } as never,
    );
  });

  const job = (attemptsMade: number, attempts = 3) =>
    ({
      data: {
        taskId: 'task-1',
        userId: '507f1f77bcf86cd799439011',
        s3Key: 'originals/u/task-1/in.mp4',
      },
      attemptsMade,
      opts: { attempts },
    }) as never;

  it('rethrows without markFailed or orphan delete on non-final attempt', async () => {
    // attemptsMade 0 = first try; 1 = second try (still retryable with attempts=3)
    await expect(service.processJob(job(0, 3))).rejects.toThrow(
      'download blew up',
    );

    expect(task.status).toBe('processing');
    expect(deleteProcessedArtifacts).not.toHaveBeenCalled();
    expect(task.failureReason).toBeUndefined();
  });

  it('markFailed and deletes orphans on final attempt', async () => {
    // attemptsMade 2 with attempts 3 = third/final try
    await expect(service.processJob(job(2, 3))).rejects.toThrow(
      'download blew up',
    );

    expect(task.status).toBe('failed');
    expect(task.failureReason).toBe('download blew up');
    expect(deleteProcessedArtifacts).toHaveBeenCalledWith(
      'originals/507f1f77bcf86cd799439011/task-1/output.mp4',
      'thumbnails/507f1f77bcf86cd799439011/task-1/thumb.jpg',
    );
  });

  it('throws UnrecoverableError when task is missing', async () => {
    findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });

    await expect(service.processJob(job(1, 3))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(deleteProcessedArtifacts).not.toHaveBeenCalled();
  });

  it('skips work when task already completed', async () => {
    task.status = 'completed';

    await service.processJob(job(1, 3));

    expect(downloadObjectToFile).not.toHaveBeenCalled();
  });
});
