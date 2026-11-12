import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { GetUser } from '../auth/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UserThrottlerGuard } from '../auth/guards/user-throttler.guard.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.js';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  VIDEO_UPLOAD_FIELD,
  VIDEO_UPLOAD_RATE_LIMIT,
  VIDEO_UPLOAD_RATE_TTL_MS,
} from './constants/upload.constants.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import { createVideoUploadParseFilePipe } from './pipes/video-upload-file.pipe.js';
import { VideosService } from './videos.service.js';

@Controller('api/videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * Use case: accept an authenticated video upload, probe duration for ETA,
   * store the original in S3, create a queued video task, and enqueue BullMQ.
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({
    default: {
      limit: VIDEO_UPLOAD_RATE_LIMIT,
      ttl: VIDEO_UPLOAD_RATE_TTL_MS,
    },
  })
  @UseInterceptors(
    FileInterceptor(VIDEO_UPLOAD_FIELD, {
      storage: memoryStorage(),
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  upload(
    @GetUser() user: AuthenticatedUser,
    @UploadedFile(createVideoUploadParseFilePipe(DEFAULT_MAX_UPLOAD_BYTES))
    file: Express.Multer.File,
  ) {
    return this.videosService.handleUpload(user, file);
  }

  /** List the authenticated user's video tasks (newest first). */
  @Get('tasks')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  listTasks(
    @GetUser() user: AuthenticatedUser,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.videosService.listTasks(user, query.limit, query.skip);
  }

  /** Get one task status (owner-only; Redis cache with Mongo fallback). */
  @Get('tasks/:taskId')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  getTask(
    @GetUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.videosService.getTask(user, taskId);
  }

  /** Progress snapshot for a task. */
  @Get('tasks/:taskId/progress')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  getTaskProgress(
    @GetUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.videosService.getTaskProgress(user, taskId);
  }

  /** Stream the generated JPEG thumbnail (owner-only; available when completed). */
  @Get('tasks/:taskId/thumbnail')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Header('Content-Type', 'image/jpeg')
  async getThumbnail(
    @GetUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ): Promise<StreamableFile> {
    const buffer = await this.videosService.getThumbnail(user, taskId);
    return new StreamableFile(buffer);
  }
}
