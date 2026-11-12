import { describe, expect, it } from 'vitest';
import { isAllowedVideoUpload } from './upload-validation.js';

describe('isAllowedVideoUpload', () => {
  it('accepts allowlisted extensions and mime types', () => {
    expect(
      isAllowedVideoUpload({
        filename: 'clip.mp4',
        mimeType: 'video/mp4',
      }),
    ).toBe(true);
    expect(
      isAllowedVideoUpload({
        filename: 'clip.MOV',
        mimeType: 'video/quicktime',
      }),
    ).toBe(true);
  });

  it('rejects unsupported extensions', () => {
    expect(
      isAllowedVideoUpload({
        filename: 'clip.mkv',
        mimeType: 'video/x-matroska',
      }),
    ).toBe(false);
  });
});
