import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VIDEO_QUEUE_NAME } from '../../queue/constants/queue.constants.js';
import { VIDEO_WORKER_CONCURRENCY } from '../../worker/constants/worker.constants.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsService', () => {
  const aggregate = vi.fn();
  const getJobCounts = vi.fn();

  let service: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregate.mockReset();
    getJobCounts.mockResolvedValue({
      waiting: 2,
      active: 1,
      delayed: 0,
      completed: 10,
      failed: 1,
    });
    service = new AnalyticsService(
      { aggregate } as never,
      { getJobCounts } as never,
    );
  });

  it('builds analytics from aggregates', async () => {
    aggregate
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue([
          { _id: 'completed', count: 8 },
          { _id: 'failed', count: 2 },
          { _id: 'queued', count: 1 },
        ]),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue([
          { durationSec: 40, etaSeconds: 30 },
          { durationSec: 20, etaSeconds: 30 },
        ]),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue([
          { _id: 'completed', count: 3 },
          { _id: 'failed', count: 1 },
        ]),
      });

    const result = await service.getAnalytics('507f1f77bcf86cd799439011');

    expect(result.totals.all).toBe(11);
    expect(result.totals.completed).toBe(8);
    expect(result.failureRate).toBe(0.2);
    expect(result.processingTime.sampleSize).toBe(2);
    expect(result.processingTime.avgSeconds).toBe(30);
    expect(result.userActivity).toEqual({
      userId: '507f1f77bcf86cd799439011',
      uploads: 4,
      completed: 3,
      failed: 1,
    });
  });

  it('returns queue snapshot with wait estimate', async () => {
    aggregate.mockReturnValue({
      exec: vi.fn().mockResolvedValue([{ durationSec: 50 }]),
    });

    const result = await service.getQueueSnapshot();

    expect(getJobCounts).toHaveBeenCalled();
    expect(result.concurrency).toBe(VIDEO_WORKER_CONCURRENCY);
    expect(result.waiting).toBe(2);
    expect(result.estimatedWaitSeconds).toBe(100);
  });

  it('returns system snapshot from process + config', () => {
    const result = service.getSystem();

    expect(result.node.version).toMatch(/^v/);
    expect(result.memory.rss).toBeGreaterThan(0);
    expect(result.cpu.loadAvg).toHaveLength(3);
    expect(result.worker).toEqual({
      concurrency: VIDEO_WORKER_CONCURRENCY,
      queueName: VIDEO_QUEUE_NAME,
    });
  });
});
