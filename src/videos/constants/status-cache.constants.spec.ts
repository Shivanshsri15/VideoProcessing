import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TASK_STATUS_CACHE_TTL_SEC,
  TASK_STATUS_CACHE_KEY_PREFIX,
  taskStatusCacheKey,
} from './status-cache.constants.js';

describe('status-cache.constants', () => {
  it('builds Redis key with prefix and taskId', () => {
    expect(taskStatusCacheKey('abc-123')).toBe(
      `${TASK_STATUS_CACHE_KEY_PREFIX}abc-123`,
    );
  });

  it('defaults TTL to 24 hours', () => {
    expect(DEFAULT_TASK_STATUS_CACHE_TTL_SEC).toBe(86_400);
  });
});
