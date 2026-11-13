import { Readable } from 'node:stream';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class FakeCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send = send;
    },
    GetObjectCommand: class extends FakeCommand {},
    HeadObjectCommand: class extends FakeCommand {},
    PutObjectCommand: class extends FakeCommand {},
    DeleteObjectCommand: class extends FakeCommand {},
  };
});

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: class {
    done = vi.fn().mockResolvedValue(undefined);
  },
}));

describe('S3Service.downloadObjectToFile', () => {
  let destPath: string;
  let service: InstanceType<
    typeof import('./s3.service.js').S3Service
  >;

  beforeEach(async () => {
    send.mockReset();
    destPath = join(
      tmpdir(),
      `s3-download-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const { S3Service } = await import('./s3.service.js');
    service = new S3Service({
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          S3_BUCKET: 'bucket',
          AWS_ACCESS_KEY_ID: 'ak',
          AWS_SECRET_ACCESS_KEY: 'sk',
        };
        return map[key] ?? '';
      },
      get: (_key: string, fallback?: string) => fallback,
    } as never);
  });

  afterEach(async () => {
    await fs.rm(destPath, { force: true }).catch(() => undefined);
  });

  it('skips GetObject when local file already matches ContentLength', async () => {
    await fs.writeFile(destPath, Buffer.from('abcdefghij'));
    send.mockResolvedValueOnce({ ContentLength: 10 });

    await service.downloadObjectToFile('originals/a/b/in.mp4', destPath);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].constructor.name).toBe('HeadObjectCommand');
  });

  it('resumes with Range when a partial file exists', async () => {
    await fs.writeFile(destPath, Buffer.from('abc'));
    send
      .mockResolvedValueOnce({ ContentLength: 10 })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from('defghij')]),
      });

    await service.downloadObjectToFile('originals/a/b/in.mp4', destPath);

    expect(send).toHaveBeenCalledTimes(2);
    const getCmd = send.mock.calls[1][0];
    expect(getCmd.constructor.name).toBe('GetObjectCommand');
    expect(getCmd.input.Range).toBe('bytes=3-');
    const final = await fs.readFile(destPath);
    expect(final.toString()).toBe('abcdefghij');
  });

  it('writes a full object when no local file exists', async () => {
    send
      .mockResolvedValueOnce({ ContentLength: 5 })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from('hello')]),
      });

    await service.downloadObjectToFile('originals/a/b/in.mp4', destPath);

    const getCmd = send.mock.calls[1][0];
    expect(getCmd.input.Range).toBeUndefined();
    expect(await fs.readFile(destPath, 'utf8')).toBe('hello');
  });
});
