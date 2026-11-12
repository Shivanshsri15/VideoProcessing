/** Default 500MB when MAX_UPLOAD_BYTES env is unset. */
export const DEFAULT_MAX_UPLOAD_BYTES = 524_288_000;

/** multipart field name for the video file */
export const VIDEO_UPLOAD_FIELD = 'file';

/** Upload endpoint rate limit (per authenticated user). */
export const VIDEO_UPLOAD_RATE_LIMIT = 5;
export const VIDEO_UPLOAD_RATE_TTL_MS = 60_000;
