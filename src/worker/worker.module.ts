import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueModule } from '../queue/queue.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { VideoProcessingProcessor } from './processing/video-processing.processor.js';

/**
 * Worker process: BullMQ consumer only (no HTTP).
 * FFmpeg work lands in M4 inside VideoProcessingProcessor.
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
    RedisModule,
    QueueModule,
  ],
  providers: [VideoProcessingProcessor],
})
export class WorkerModule {}
