/**
 * Global worker concurrency — one video at a time for the whole system.
 * Not per-user. Keep Compose at a single worker replica.
 */
export const VIDEO_WORKER_CONCURRENCY = 1;

/** M3 stub: hold jobs pending until M4 FFmpeg (ms). */
export const M3_STUB_DELAY_MS = 24 * 60 * 60 * 1000;
