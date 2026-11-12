import { PROCESSING_SECONDS_PER_VIDEO_MINUTE } from './constants/eta.constants.js';

/** Assignment rule: fixed processing seconds per ceil-minute of video. */
export const estimateProcessingSeconds = (durationSec: number): number => {
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw new Error('durationSec must be a non-negative finite number');
  }
  return Math.ceil(durationSec / 60) * PROCESSING_SECONDS_PER_VIDEO_MINUTE;
};
