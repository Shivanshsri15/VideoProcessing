/** Redis key prefix for hot task status snapshots. */
export const TASK_STATUS_CACHE_KEY_PREFIX = 'task:status:';

/** Default TTL (24h) when TASK_STATUS_CACHE_TTL_SEC env is unset. */
export const DEFAULT_TASK_STATUS_CACHE_TTL_SEC = 86_400;

export const taskStatusCacheKey = (taskId: string): string =>
  `${TASK_STATUS_CACHE_KEY_PREFIX}${taskId}`;
