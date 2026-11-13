import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  S3_DEFAULT_CONTENT_TYPE,
  S3_DEFAULT_ORIGINAL_PREFIX,
  S3_DEFAULT_THUMBNAIL_PREFIX,
  S3_OUTPUT_CONTENT_TYPE,
  S3_OUTPUT_FILENAME,
  S3_THUMBNAIL_CONTENT_TYPE,
  S3_THUMBNAIL_FILENAME,
} from './s3.constants.js';
import { sanitizeS3ObjectName } from './s3.helpers.js';

const normalizePrefix = (prefix: string): string =>
  prefix.endsWith('/') ? prefix : `${prefix}/`;

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly originalPrefix: string;
  private readonly thumbnailPrefix: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.originalPrefix = normalizePrefix(
      this.config.get<string>(
        'S3_ORIGINAL_PREFIX',
        S3_DEFAULT_ORIGINAL_PREFIX,
      ),
    );
    this.thumbnailPrefix = normalizePrefix(
      this.config.get<string>(
        'S3_THUMBNAIL_PREFIX',
        S3_DEFAULT_THUMBNAIL_PREFIX,
      ),
    );
    this.client = new S3Client({
      region,
    });
  }

  buildOriginalKey = (
    userId: string,
    taskId: string,
    filename: string,
  ): string => {
    const safeName = sanitizeS3ObjectName(filename);
    return `${this.originalPrefix}${userId}/${taskId}/${safeName}`;
  };

  buildTaskOutputKey = (userId: string, taskId: string): string =>
    `${this.originalPrefix}${userId}/${taskId}/${S3_OUTPUT_FILENAME}`;

  buildTaskThumbnailKey = (userId: string, taskId: string): string =>
    `${this.thumbnailPrefix}${userId}/${taskId}/${S3_THUMBNAIL_FILENAME}`;

  putObject = async (input: {
    key: string;
    body: Buffer;
    contentType?: string;
  }): Promise<void> => {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType || S3_DEFAULT_CONTENT_TYPE,
        }),
      );
    } catch (error) {
      this.logger.error(`S3 PutObject failed for key=${input.key}`, error);
      throw error;
    }
  };

  putProcessedOutput = async (key: string, body: Buffer): Promise<void> =>
    this.putObject({
      key,
      body,
      contentType: S3_OUTPUT_CONTENT_TYPE,
    });

  putThumbnail = async (key: string, body: Buffer): Promise<void> =>
    this.putObject({
      key,
      body,
      contentType: S3_THUMBNAIL_CONTENT_TYPE,
    });

  headObjectContentLength = async (key: string): Promise<number> => {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      const length = response.ContentLength;
      if (typeof length !== 'number' || !Number.isFinite(length) || length < 0) {
        throw new Error(`missing ContentLength for key=${key}`);
      }
      return length;
    } catch (error) {
      this.logger.error(`S3 HeadObject failed for key=${key}`, error);
      throw error;
    }
  };

  /**
   * Stream object to disk. Resumes via Range GET when a partial file already exists.
   */
  downloadObjectToFile = async (
    key: string,
    destPath: string,
  ): Promise<void> => {
    try {
      const expected = await this.headObjectContentLength(key);
      await fs.mkdir(dirname(destPath), { recursive: true });

      let existingSize = 0;
      try {
        const stat = await fs.stat(destPath);
        existingSize = stat.size;
      } catch {
        existingSize = 0;
      }

      if (existingSize === expected) {
        this.logger.debug(
          `S3 download already complete key=${key} size=${expected}`,
        );
        return;
      }

      if (existingSize > expected) {
        await fs.unlink(destPath);
        existingSize = 0;
      }

      const range =
        existingSize > 0 ? `bytes=${existingSize}-` : undefined;
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(range ? { Range: range } : {}),
        }),
      );
      if (!response.Body) {
        throw new Error('empty S3 body');
      }

      const body = response.Body as Readable;
      const writeStream = createWriteStream(destPath, {
        flags: existingSize > 0 ? 'a' : 'w',
      });
      await pipeline(body, writeStream);

      const finalStat = await fs.stat(destPath);
      if (finalStat.size !== expected) {
        throw new Error(
          `incomplete download for key=${key}: got ${finalStat.size}, expected ${expected}`,
        );
      }
    } catch (error) {
      this.logger.error(`S3 download to file failed for key=${key}`, error);
      throw error;
    }
  };

  uploadFile = async (
    key: string,
    filePath: string,
    contentType: string,
  ): Promise<void> => {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: contentType,
        },
      });
      await upload.done();
    } catch (error) {
      this.logger.error(`S3 uploadFile failed for key=${key}`, error);
      throw error;
    }
  };

  deleteObject = async (key: string): Promise<void> => {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(`S3 DeleteObject failed for key=${key}`, error);
    }
  };

  deleteProcessedArtifacts = async (
    outputKey: string,
    thumbnailKey: string,
  ): Promise<void> => {
    await Promise.all([
      this.deleteObject(outputKey),
      this.deleteObject(thumbnailKey),
    ]);
  };

  getObjectBuffer = async (key: string): Promise<Buffer> => {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new Error('empty S3 body');
      }
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      this.logger.error(`S3 GetObject failed for key=${key}`, error);
      throw error;
    }
  };
}
