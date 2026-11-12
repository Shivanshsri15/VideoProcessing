import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./schemas/video-task.schema.js', () => ({
  VideoTask: class VideoTask {},
  VideoTaskSchema: {},
}));

const { VideosService } = await import('./videos.service.js');

describe('VideosService ownership', () => {
  const findOne = vi.fn();
  const countDocuments = vi.fn();
  const statusCacheGet = vi.fn();
  const statusCacheSet = vi.fn();

  let service: InstanceType<typeof VideosService>;

  beforeEach(() => {
    findOne.mockReset();
    countDocuments.mockReset();
    statusCacheGet.mockReset();
    statusCacheSet.mockReset();

    const videoTaskModel = {
      findOne: (...args: unknown[]) => {
        findOne(...args);
        return { exec: () => findOne.mock.results.at(-1)?.value };
      },
      countDocuments: (...args: unknown[]) => {
        countDocuments(...args);
        return { exec: () => countDocuments.mock.results.at(-1)?.value };
      },
    };

    service = new VideosService(
      videoTaskModel as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: statusCacheGet,
        set: statusCacheSet,
      } as never,
      { get: () => undefined } as never,
    );
  });

  const userId = '507f1f77bcf86cd799439011';

  it('returns 404 when task is missing for the user', async () => {
    statusCacheGet.mockResolvedValue(null);
    findOne.mockResolvedValue(null);

    await expect(
      service.getTask({ id: userId } as never, 'missing-task'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when cache hit but task is not owned', async () => {
    statusCacheGet.mockResolvedValue({
      taskId: 'task-1',
      status: 'queued',
      progress: 0,
      etaSeconds: 30,
      s3Key: 'k',
      metadata: { durationSec: 10 },
      updatedAt: new Date().toISOString(),
    });
    countDocuments.mockResolvedValue(0);

    await expect(
      service.getTask({ id: userId } as never, 'task-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
