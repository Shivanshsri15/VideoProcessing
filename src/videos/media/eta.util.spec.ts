import { describe, expect, it } from 'vitest';
import { estimateProcessingSeconds } from './eta.util.js';

describe('estimateProcessingSeconds', () => {
  it('uses 30 seconds per ceil-minute of video', () => {
    expect(estimateProcessingSeconds(0)).toBe(0);
    expect(estimateProcessingSeconds(60)).toBe(30);
    expect(estimateProcessingSeconds(61)).toBe(60);
    expect(estimateProcessingSeconds(125.4)).toBe(90);
  });

  it('rejects invalid durations', () => {
    expect(() => estimateProcessingSeconds(Number.NaN)).toThrow();
    expect(() => estimateProcessingSeconds(-1)).toThrow();
  });
});
