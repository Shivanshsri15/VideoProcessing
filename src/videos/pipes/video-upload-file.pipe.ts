import {
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { DEFAULT_MAX_UPLOAD_BYTES } from '../constants/upload.constants.js';

/** Shared ParseFilePipe for video upload endpoints (required file + max size). */
export const createVideoUploadParseFilePipe = (
  maxSizeBytes: number = DEFAULT_MAX_UPLOAD_BYTES,
): ParseFilePipe =>
  new ParseFilePipe({
    fileIsRequired: true,
    validators: [new MaxFileSizeValidator({ maxSize: maxSizeBytes })],
  });
