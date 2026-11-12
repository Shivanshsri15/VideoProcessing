import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VIDEO_WORKER_CONCURRENCY } from './worker/constants/worker.constants.js';
import { WorkerModule } from './worker/worker.module.js';

async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn'],
  });
  app.enableShutdownHooks();
  logger.log(
    `Video worker started (global concurrency=${VIDEO_WORKER_CONCURRENCY}; FFmpeg in M4)`,
  );
}

await bootstrap();
