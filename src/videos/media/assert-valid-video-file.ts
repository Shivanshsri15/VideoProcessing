import { BadRequestException } from '@nestjs/common';
import { isAllowedVideoUpload } from './upload-validation.js';

export const assertValidVideoFile = (
  file: Express.Multer.File | undefined,
  maxUploadBytes: number,
): Express.Multer.File => {
  if (!file) {
    throw new BadRequestException('Video file is required');
  }
  if (file.size <= 0) {
    throw new BadRequestException('Video file is empty');
  }
  if (file.size > maxUploadBytes) {
    throw new BadRequestException('Video file exceeds maximum size of 500MB');
  }
  if (
    !isAllowedVideoUpload({
      filename: file.originalname,
      mimeType: file.mimetype || '',
    })
  ) {
    throw new BadRequestException(
      'Unsupported video format. Allowed: MP4, AVI, MOV, WMV, FLV',
    );
  }
  return file;
};
