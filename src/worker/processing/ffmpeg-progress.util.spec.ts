import { describe, expect, it } from 'vitest';
import {
  progressPercentFromFfmpegLine,
  steppedProgress,
} from './ffmpeg-progress.util.js';

describe('ffmpeg-progress.util', () => {
  it('parses out_time_ms into percent of duration', () => {
    // 15s of a 60s video → 25%
    expect(
      progressPercentFromFfmpegLine('out_time_ms=15000000', 60),
    ).toBe(25);
  });

  it('caps below 100 while encoding', () => {
    expect(
      progressPercentFromFfmpegLine('out_time_ms=60000000', 60),
    ).toBe(99);
  });

  it('ignores unrelated progress lines', () => {
    expect(progressPercentFromFfmpegLine('progress=continue', 60)).toBeNull();
  });

  it('steps progress in 5% increments', () => {
    expect(steppedProgress(12, 5, 0)).toBe(10);
    expect(steppedProgress(14, 5, 10)).toBeNull();
    expect(steppedProgress(20, 5, 10)).toBe(20);
  });
});
