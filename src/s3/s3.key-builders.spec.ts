import { describe, expect, it } from 'vitest';
import {
  S3_DEFAULT_ORIGINAL_PREFIX,
  S3_DEFAULT_THUMBNAIL_PREFIX,
  S3_OUTPUT_FILENAME,
  S3_THUMBNAIL_FILENAME,
} from './s3.constants.js';

describe('S3 key layout', () => {
  it('keeps output under originals task folder and thumb under thumbnails', () => {
    const userId = 'user-1';
    const taskId = 'task-1';
    const outputKey = `${S3_DEFAULT_ORIGINAL_PREFIX}${userId}/${taskId}/${S3_OUTPUT_FILENAME}`;
    const thumbKey = `${S3_DEFAULT_THUMBNAIL_PREFIX}${userId}/${taskId}/${S3_THUMBNAIL_FILENAME}`;

    expect(outputKey).toBe('originals/user-1/task-1/output.mp4');
    expect(thumbKey).toBe('thumbnails/user-1/task-1/thumb.jpg');
  });
});
