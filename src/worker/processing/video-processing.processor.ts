import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VIDEO_QUEUE_NAME } from '../../queue/constants/queue.constants.js';
import type { ProcessVideoJobPayload } from '../../queue/types/process-video-job.js';
import { VIDEO_WORKER_CONCURRENCY } from '../constants/worker.constants.js';
import { VideoProcessingService } from './video-processing.service.js';

/** Thin BullMQ adapter — all pipeline logic lives in VideoProcessingService. */
@Processor(VIDEO_QUEUE_NAME, { concurrency: VIDEO_WORKER_CONCURRENCY })
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(private readonly processing: VideoProcessingService) {
    super();
  }

  // Nest/BullMQ require a prototype process hook on WorkerHost.
  async process(job: Job<ProcessVideoJobPayload>): Promise<void> {
    this.logger.log(
      `Processing taskId=${job.data.taskId} attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 1} (concurrency=${VIDEO_WORKER_CONCURRENCY})`,
    );
    await this.processing.processJob(job);
  }
}
