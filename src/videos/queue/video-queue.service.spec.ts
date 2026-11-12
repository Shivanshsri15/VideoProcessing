import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROCESS_VIDEO_JOB_NAME } from '../../queue/constants/queue.constants.js';
import { VideoQueueService } from './video-queue.service.js';

describe('VideoQueueService', () => {
  const add = vi.fn();
  let service: VideoQueueService;

  beforeEach(() => {
    add.mockReset();
    add.mockResolvedValue(undefined);
    service = new VideoQueueService({ add } as never);
  });

  it('enqueues with jobId equal to taskId', async () => {
    const payload = {
      taskId: 'task-1',
      userId: 'user-1',
      s3Key: 'originals/user-1/task-1.mp4',
    };

    await service.enqueueProcessVideo(payload);

    expect(add).toHaveBeenCalledWith(PROCESS_VIDEO_JOB_NAME, payload, {
      jobId: 'task-1',
      removeOnComplete: false,
      removeOnFail: false,
    });
  });
});
