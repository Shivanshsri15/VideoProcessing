import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { createVideoUploadParseFilePipe } from './pipes/video-upload-file.pipe.js';
import { VideosService } from './videos.service.js';

@Controller('api/videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * Use case: accept an authenticated video upload, probe duration for ETA,
   * store the original in S3, and create a queued video task (no processing yet).
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
}
