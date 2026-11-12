export const sanitizeS3ObjectName = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, '_');
