/**
 * Global worker concurrency — one video at a time for the whole system.
 * Not per-user. Keep Compose at a single worker replica.
 */
export const VIDEO_WORKER_CONCURRENCY = 1;

export const FFMPEG_DEFAULT_PATH = 'ffmpeg';

/** Persist progress to Mongo at this percent step. */
export const PROGRESS_UPDATE_STEP_PERCENT = 20;

export const CACHE_UPDATE_STEP_PERCENT = 5;
