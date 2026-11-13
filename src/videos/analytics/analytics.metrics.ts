export type DurationDistribution = {
  le30: number;
  le60: number;
  le120: number;
  le300: number;
  gt300: number;
};

export const failureRate = (completed: number, failed: number): number => {
  const denom = completed + failed;
  if (denom <= 0) {
    return 0;
  }
  return failed / denom;
};

export const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

/** Inclusive percentile on a sorted copy (nearest-rank). */
export const percentile = (
  values: number[],
  p: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[index] ?? null;
};

export const buildDurationDistribution = (
  durationsSec: number[],
): DurationDistribution => {
  const dist: DurationDistribution = {
    le30: 0,
    le60: 0,
    le120: 0,
    le300: 0,
    gt300: 0,
  };
  for (const sec of durationsSec) {
    if (sec <= 30) {
      dist.le30 += 1;
    } else if (sec <= 60) {
      dist.le60 += 1;
    } else if (sec <= 120) {
      dist.le120 += 1;
    } else if (sec <= 300) {
      dist.le300 += 1;
    } else {
      dist.gt300 += 1;
    }
  }
  return dist;
};
