import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
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
