import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from '../s3/s3.module.js';
import { FfprobeService } from './media/ffprobe.service.js';
import {
  VideoTask,
  VideoTaskSchema,
} from './schemas/video-task.schema.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

@Module({
  imports: [
    S3Module,
    MongooseModule.forFeature([
      { name: VideoTask.name, schema: VideoTaskSchema },
    ]),
  ],
  controllers: [VideosController],
  providers: [VideosService, FfprobeService],
  exports: [VideosService],
})
export class VideosModule {}
