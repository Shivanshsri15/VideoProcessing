import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VIDEO_QUEUE_NAME } from './constants/queue.constants.js';

/**
 * Shared BullMQ connection + queue registration.
 * Producer (videos) and consumer (worker) both import this; they do not share services.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: VIDEO_QUEUE_NAME,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
