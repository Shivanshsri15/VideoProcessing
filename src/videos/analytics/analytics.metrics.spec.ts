import { describe, expect, it } from 'vitest';
import {
  average,
  buildDurationDistribution,
  failureRate,
  percentile,
} from './analytics.metrics.js';

describe('analytics.metrics', () => {
  it('computes failureRate', () => {
    expect(failureRate(0, 0)).toBe(0);
    expect(failureRate(8, 2)).toBe(0.2);
  });

  it('averages and percentiles', () => {
    expect(average([])).toBeNull();
    expect(average([10, 20, 30])).toBe(20);
    expect(percentile([], 50)).toBeNull();
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 95)).toBe(4);
  });

  it('buckets durations', () => {
    expect(
      buildDurationDistribution([10, 45, 90, 200, 400]),
    ).toEqual({
      le30: 1,
      le60: 1,
      le120: 1,
      le300: 1,
      gt300: 1,
    });
  });
});
