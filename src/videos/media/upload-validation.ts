import {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS_SET,
  ALLOWED_VIDEO_MIME_TYPES_SET,
} from './constants/allowed-video.constants.js';

export const getFileExtension = (filename: string): string => {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) {
    return '';
  }
  return filename.slice(idx).toLowerCase();
};

export const isAllowedVideoUpload = (input: {
  filename: string;
  mimeType: string;
}): boolean => {
  const ext = getFileExtension(input.filename);
  if (!ALLOWED_VIDEO_EXTENSIONS_SET.has(ext)) {
    return false;
  }
  const mime = input.mimeType.toLowerCase().trim();
  if (!mime) {
    return true;
  }
  return ALLOWED_VIDEO_MIME_TYPES_SET.has(mime);
};

export { ALLOWED_VIDEO_EXTENSIONS };
