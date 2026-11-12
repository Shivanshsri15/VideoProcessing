import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueModule } from '../queue/queue.module.js';
import { S3Module } from '../s3/s3.module.js';
import { FfprobeService } from './media/ffprobe.service.js';
import { VideoQueueService } from './queue/video-queue.service.js';
import {
  VideoTask,
  VideoTaskSchema,
} from './schemas/video-task.schema.js';
import { StatusCacheService } from './status-cache.service.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

@Module({
  imports: [
    S3Module,
    QueueModule,
    MongooseModule.forFeature([
      { name: VideoTask.name, schema: VideoTaskSchema },
    ]),
  ],
  controllers: [VideosController],
  providers: [
    VideosService,
    FfprobeService,
    StatusCacheService,
    VideoQueueService,
  ],
  exports: [VideosService],
})
export class VideosModule {}
