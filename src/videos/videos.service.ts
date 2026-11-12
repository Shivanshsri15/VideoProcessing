import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
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
import {
  DEFAULT_TASK_LIST_LIMIT,
  MAX_TASK_LIST_LIMIT,
} from './constants/task-list.constants.js';
import { DEFAULT_MAX_UPLOAD_BYTES } from './constants/upload.constants.js';
import { estimateProcessingSeconds } from './media/eta.util.js';
import { FfprobeService } from './media/ffprobe.service.js';
import { isAllowedVideoUpload } from './media/upload-validation.js';
import { VideoQueueService } from './queue/video-queue.service.js';
import {
  VideoTask,
  VideoTaskDocument,
} from './schemas/video-task.schema.js';
import { StatusCacheService } from './status-cache.service.js';
import type { TaskProgressResult } from './types/task-progress.js';
import type { TaskStatusSnapshot } from './types/task-status-snapshot.js';
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
    private readonly videoQueue: VideoQueueService,
    private readonly statusCache: StatusCacheService,
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
    if (
      !isAllowedVideoUpload({
        filename: file?.originalname ?? '',
        mimeType: file?.mimetype ?? '',
      })
    ) {
      throw new BadRequestException(
        'Unsupported video format. Allowed: MP4, AVI, MOV, WMV, FLV',
      );
    }

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

      const snapshot = this.toSnapshot(task);
      await this.statusCache.set(snapshot);

      try {
        await this.videoQueue.enqueueProcessVideo({
          taskId: task.taskId,
          userId: user.id,
          s3Key: task.s3Key,
        });
      } catch (enqueueError) {
        this.logger.error(
          `Enqueue failed for taskId=${task.taskId}`,
          enqueueError,
        );
        task.status = 'failed';
        task.failureReason = 'Failed to enqueue processing job';
        await task.save();
        await this.statusCache.set(this.toSnapshot(task));
        throw new InternalServerErrorException('Upload failed');
      }

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
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`Upload failed for user=${user.id}`, error);
      throw new InternalServerErrorException('Upload failed');
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  };

  listTasks = async (
    user: AuthenticatedUser,
    limit = DEFAULT_TASK_LIST_LIMIT,
    skip = 0,
  ): Promise<TaskStatusSnapshot[]> => {
    const safeLimit = Math.min(
      Math.max(1, limit),
      MAX_TASK_LIST_LIMIT,
    );
    const safeSkip = Math.max(0, skip);

    const tasks = await this.videoTaskModel
      .find({ userId: new Types.ObjectId(user.id) })
      .sort({ createdAt: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .exec();

    return tasks.map((task) => this.toSnapshot(task));
  };

  getTask = async (
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<TaskStatusSnapshot> => {
    const cached = await this.statusCache.get(taskId);
    if (cached) {
      const owned = await this.isOwnedByUser(taskId, user.id);
      if (!owned) {
        throw new NotFoundException('Task not found');
      }
      return cached;
    }

    const task = await this.findOwnedTaskOrThrow(user.id, taskId);
    const snapshot = this.toSnapshot(task);
    await this.statusCache.set(snapshot);
    return snapshot;
  };

  getTaskProgress = async (
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<TaskProgressResult> => {
    const snapshot = await this.getTask(user, taskId);
    return {
      taskId: snapshot.taskId,
      status: snapshot.status,
      progress: snapshot.progress,
      etaSeconds: snapshot.etaSeconds,
    };
  };

  private isOwnedByUser = async (
    taskId: string,
    userId: string,
  ): Promise<boolean> => {
    const count = await this.videoTaskModel
      .countDocuments({
        taskId,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    return count > 0;
  };

  private findOwnedTaskOrThrow = async (
    userId: string,
    taskId: string,
  ): Promise<VideoTaskDocument> => {
    const task = await this.videoTaskModel
      .findOne({
        taskId,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  };

  private toSnapshot = (task: VideoTaskDocument): TaskStatusSnapshot => {
    const updatedAt =
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : new Date().toISOString();

    const snapshot: TaskStatusSnapshot = {
      taskId: task.taskId,
      status: task.status,
      progress: task.progress,
      etaSeconds: task.etaSeconds,
      s3Key: task.s3Key,
      metadata: { durationSec: task.metadata.durationSec },
      updatedAt,
    };

    if (task.failureReason) {
      snapshot.failureReason = task.failureReason;
    }

    return snapshot;
  };
}
