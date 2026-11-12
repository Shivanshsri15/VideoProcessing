export const FFPROBE_DEFAULT_PATH = 'ffprobe';

export const FFPROBE_DURATION_ARGS = [
  '-v',
  'error',
  '-show_entries',
  'format=duration',
  '-of',
  'json',
] as const;
