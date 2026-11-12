import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  S3_DEFAULT_CONTENT_TYPE,
  S3_DEFAULT_ORIGINAL_PREFIX,
} from './s3.constants.js';
import { sanitizeS3ObjectName } from './s3.helpers.js';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly originalPrefix: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.originalPrefix = this.config.get<string>(
      'S3_ORIGINAL_PREFIX',
      S3_DEFAULT_ORIGINAL_PREFIX,
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
    const prefix = this.originalPrefix.endsWith('/')
      ? this.originalPrefix
      : `${this.originalPrefix}/`;
    return `${prefix}${userId}/${taskId}/${safeName}`;
  };

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
}
