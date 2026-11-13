/** Single shared queue for all users (system-wide processing). */
export const VIDEO_QUEUE_NAME = 'video-processing';

/** BullMQ job name for video processing work. */
export const PROCESS_VIDEO_JOB_NAME = 'process-video';

/** Max BullMQ attempts for process-video jobs (transient S3/FFmpeg failures). */
export const PROCESS_JOB_ATTEMPTS = 3;

/** Base delay (ms) for exponential backoff: ~5s → 10s → 20s. */
export const PROCESS_JOB_BACKOFF_MS = 5000;
