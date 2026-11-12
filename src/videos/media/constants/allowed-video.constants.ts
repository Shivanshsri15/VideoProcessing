export const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/x-msvideo',
  'video/avi',
  'video/quicktime',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/flv',
  'application/octet-stream',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS_SET = new Set<string>(
  ALLOWED_VIDEO_EXTENSIONS,
);

export const ALLOWED_VIDEO_MIME_TYPES_SET = new Set<string>(
  ALLOWED_VIDEO_MIME_TYPES,
);
