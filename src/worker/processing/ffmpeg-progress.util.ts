/** Parse FFmpeg `-progress` key=value lines into percent (0–100). */
export const progressPercentFromFfmpegLine = (
  line: string,
  durationSec: number,
): number | null => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return null;
  }
  const trimmed = line.trim();
  if (!trimmed.startsWith('out_time_ms=')) {
    return null;
  }
  const raw = Number(trimmed.slice('out_time_ms='.length));
  if (!Number.isFinite(raw) || raw < 0) {
    return null;
  }
  const currentSec = raw / 1_000_000;
  const percent = Math.min(99, Math.floor((currentSec / durationSec) * 100));
  return percent < 0 ? 0 : percent;
};

export const steppedProgress = (
  percent: number,
  step: number,
  lastReported: number,
): number | null => {
  const stepped = Math.floor(percent / step) * step;
  if (stepped > lastReported && stepped < 100) {
    return stepped;
  }
  return null;
};
