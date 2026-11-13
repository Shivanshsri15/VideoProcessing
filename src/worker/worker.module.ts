import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../email/email.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { S3Module } from '../s3/s3.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  VideoTask,
  VideoTaskSchema,
} from '../videos/schemas/video-task.schema.js';
import { StatusCacheService } from '../videos/status-cache.service.js';
import { VideoProcessingProcessor } from './processing/video-processing.processor.js';
import { VideoProcessingService } from './processing/video-processing.service.js';

/**
 * Worker process: BullMQ consumer only (no HTTP).
 * FFmpeg pipeline lives in VideoProcessingService.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    MongooseModule.forFeature([
      { name: VideoTask.name, schema: VideoTaskSchema },
    ]),
    RedisModule,
    QueueModule,
    S3Module,
    EmailModule,
    UsersModule,
  ],
  providers: [
    StatusCacheService,
    VideoProcessingService,
    VideoProcessingProcessor,
  ],
})
export class WorkerModule {}
