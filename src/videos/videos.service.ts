import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.js';
import { S3_DEFAULT_CONTENT_TYPE } from '../s3/s3.constants.js';
import { S3Service } from '../s3/s3.service.js';
import { DEFAULT_MAX_UPLOAD_BYTES } from './constants/upload.constants.js';
import { estimateProcessingSeconds } from './media/eta.util.js';
import { FfprobeService } from './media/ffprobe.service.js';
import { isAllowedVideoUpload } from './media/upload-validation.js';
import {
  VideoTask,
  VideoTaskDocument,
} from './schemas/video-task.schema.js';
import type { UploadResult } from './types/upload-result.js';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly maxUploadBytes: number;

  constructor(
    @InjectModel(VideoTask.name)
    private readonly videoTaskModel: Model<VideoTaskDocument>,
    private readonly s3: S3Service,
    private readonly ffprobe: FfprobeService,
    config: ConfigService,
  ) {
    this.maxUploadBytes = Number(
      config.get<string>('MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES,
    );
  }

  handleUpload = async (
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<UploadResult> => {
    const upload = isAllowedVideoUpload({
      filename: file?.originalname ?? '',
      mimeType: file?.mimetype ?? '',
    });

    const taskId = randomUUID();
    const tempPath = join(tmpdir(), `upload-${taskId}`);
    await fs.writeFile(tempPath, file?.buffer ?? Buffer.from([]));

    try {
      const durationSec = await this.ffprobe.getDurationSeconds(tempPath);
      const etaSeconds = estimateProcessingSeconds(durationSec);
      const s3Key = this.s3.buildOriginalKey(
        user.id,
        taskId,
        file?.originalname ?? '',
      );

      await this.s3.putObject({
        key: s3Key,
        body: file?.buffer ?? Buffer.from([]),
        contentType: file?.mimetype ?? S3_DEFAULT_CONTENT_TYPE,
      });

      const task = await this.videoTaskModel.create({
        taskId,
        userId: new Types.ObjectId(user.id),
        status: 'queued',
        s3Key,
        metadata: { durationSec },
        progress: 0,
        etaSeconds,
      });

      return {
        taskId: task.taskId,
        status: task.status,
        s3Key: task.s3Key,
        etaSeconds: task.etaSeconds,
        progress: task.progress,
        metadata: { durationSec: task.metadata.durationSec },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      this.logger.error(`Upload failed for user=${user.id}`, error);
      throw new InternalServerErrorException('Upload failed');
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  };
}
