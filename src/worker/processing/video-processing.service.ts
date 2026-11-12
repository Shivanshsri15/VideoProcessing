import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { UnrecoverableError } from 'bullmq';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Model } from 'mongoose';
import type { ProcessVideoJobPayload } from '../../queue/types/process-video-job.js';
import {
  S3_OUTPUT_FILENAME,
  S3_THUMBNAIL_FILENAME,
} from '../../s3/s3.constants.js';
import { S3Service } from '../../s3/s3.service.js';
import {
  VideoTask,
  VideoTaskDocument,
} from '../../videos/schemas/video-task.schema.js';
import { StatusCacheService } from '../../videos/status-cache.service.js';
import { buildTaskStatusSnapshot } from '../../videos/utils/task-snapshot.util.js';
import {
  CACHE_UPDATE_STEP_PERCENT,
  FFMPEG_DEFAULT_PATH,
  PROGRESS_UPDATE_STEP_PERCENT,
} from '../constants/worker.constants.js';
import {
  progressPercentFromFfmpegLine,
  steppedProgress,
} from './ffmpeg-progress.util.js';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly ffmpegPath: string;

  constructor(
    @InjectModel(VideoTask.name)
    private readonly videoTaskModel: Model<VideoTaskDocument>,
    private readonly s3: S3Service,
    private readonly statusCache: StatusCacheService,
    config: ConfigService,
  ) {
    this.ffmpegPath = config.get<string>('FFMPEG_PATH', FFMPEG_DEFAULT_PATH);
  }

  processJob = async (payload: ProcessVideoJobPayload): Promise<void> => {
    const task = await this.videoTaskModel
      .findOne({ taskId: payload.taskId })
      .exec();

    if (!task) {
      throw new UnrecoverableError(`Task not found: ${payload.taskId}`);
    }
    if (task.status === 'completed') {
      this.logger.log(`Task ${payload.taskId} already completed; skipping`);
      return;
    }

    const workDir = join(tmpdir(), `process-${payload.taskId}`);
    const inputPath = join(workDir, 'input');
    const outputPath = join(workDir, S3_OUTPUT_FILENAME);
    const thumbPath = join(workDir, S3_THUMBNAIL_FILENAME);

    try {
      await fs.mkdir(workDir, { recursive: true });
      await this.markProcessing(task);

      const original = await this.s3.getObjectBuffer(payload.s3Key);
      await fs.writeFile(inputPath, original);

      const durationSec = task.metadata.durationSec;
      await this.transcodeToMp4(inputPath, outputPath, durationSec, (p) =>
        this.maybeUpdateProgress(task, p),
      );
      await this.extractThumbnail(inputPath, thumbPath);

      const outputKey = this.s3.buildTaskOutputKey(
        payload.userId,
        payload.taskId,
      );
      const thumbnailKey = this.s3.buildTaskThumbnailKey(
        payload.userId,
        payload.taskId,
      );

      await this.s3.putProcessedOutput(
        outputKey,
        await fs.readFile(outputPath),
      );
      await this.s3.putThumbnail(thumbnailKey, await fs.readFile(thumbPath));

      await this.markCompleted(task, outputKey, thumbnailKey);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Processing failed';
      this.logger.error(`Processing failed taskId=${payload.taskId}`, error);
      await this.markFailed(task, reason);
      throw new UnrecoverableError(reason);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  };

  private markProcessing = async (task: VideoTaskDocument): Promise<void> => {
    task.status = 'processing';
    task.progress = 0;
    task.startedAt = new Date();
    task.failureReason = undefined;
    await task.save();
    await this.statusCache.set(buildTaskStatusSnapshot(task));
  };

  private maybeUpdateProgress = async (
    task: VideoTaskDocument,
    percent: number,
  ): Promise<void> => {
    const next = steppedProgress(
      percent,
      PROGRESS_UPDATE_STEP_PERCENT,
      task.progress,
    );
    if (next === null) {
      return;
    }
    const previous = task.progress;
    task.progress = next;
    // Durable progress every 5%; Redis only every 10% (status GET falls back to Mongo).
    await task.save();
    const crossedCacheStep =
      Math.floor(previous / CACHE_UPDATE_STEP_PERCENT) <
      Math.floor(next / CACHE_UPDATE_STEP_PERCENT);
    if (crossedCacheStep) {
      await this.statusCache.set(buildTaskStatusSnapshot(task));
    }
  };

  private markCompleted = async (
    task: VideoTaskDocument,
    outputKey: string,
    thumbnailKey: string,
  ): Promise<void> => {
    task.status = 'completed';
    task.progress = 100;
    task.outputKey = outputKey;
    task.thumbnailKey = thumbnailKey;
    task.completedAt = new Date();
    task.failureReason = undefined;
    await task.save();
    await this.statusCache.set(buildTaskStatusSnapshot(task));
  };

  private markFailed = async (
    task: VideoTaskDocument,
    reason: string,
  ): Promise<void> => {
    try {
      task.status = 'failed';
      task.failureReason = reason.slice(0, 500);
      await task.save();
      await this.statusCache.set(buildTaskStatusSnapshot(task));
    } catch (persistError) {
      this.logger.error(
        `Failed to persist failure for taskId=${task.taskId}`,
        persistError,
      );
    }
  };

  private transcodeToMp4 = async (
    inputPath: string,
    outputPath: string,
    durationSec: number,
    onProgress: (percent: number) => Promise<void>,
  ): Promise<void> => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-progress',
      'pipe:1',
      '-nostats',
      outputPath,
    ];
    await this.runFfmpeg(args, durationSec, onProgress);
  };

  private extractThumbnail = async (
    inputPath: string,
    thumbPath: string,
  ): Promise<void> => {
    const args = [
      '-y',
      '-ss',
      '0',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      thumbPath,
    ];
    await this.runFfmpeg(args, 0, async () => undefined);
  };

  private runFfmpeg = (
    args: string[],
    durationSec: number,
    onProgress: (percent: number) => Promise<void>,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      let progressChain: Promise<void> = Promise.resolve();

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          const percent = progressPercentFromFfmpegLine(line, durationSec);
          if (percent === null) {
            continue;
          }
          progressChain = progressChain
            .then(() => onProgress(percent))
            .catch((err) => {
              this.logger.warn('Progress update failed', err);
            });
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        void progressChain.finally(() => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(
            new Error(
              `ffmpeg exited with code ${code}: ${stderr.slice(-500)}`,
            ),
          );
        });
      });
    });
}
