import { beforeEach, describe, expect, it, vi } from 'vitest';
import { taskStatusCacheKey } from './constants/status-cache.constants.js';
import { StatusCacheService } from './status-cache.service.js';

describe('StatusCacheService', () => {
  const setWithTtlSeconds = vi.fn();
  const get = vi.fn();
  let service: StatusCacheService;

  beforeEach(() => {
    setWithTtlSeconds.mockReset();
    get.mockReset();
    service = new StatusCacheService(
      { setWithTtlSeconds, get } as never,
      { get: () => '3600' } as never,
    );
  });

  it('writes JSON snapshot with configured TTL', async () => {
    const snapshot = {
      taskId: 't1',
      status: 'queued' as const,
      progress: 0,
      etaSeconds: 30,
      s3Key: 'k',
      metadata: { durationSec: 12 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await service.set(snapshot);

    expect(setWithTtlSeconds).toHaveBeenCalledWith(
      taskStatusCacheKey('t1'),
      JSON.stringify(snapshot),
      3600,
    );
  });

  it('returns null for missing or invalid cache entries', async () => {
    get.mockResolvedValueOnce(null);
    expect(await service.get('missing')).toBeNull();

    get.mockResolvedValueOnce('{not-json');
    expect(await service.get('bad')).toBeNull();
  });
});
