import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import { VIDEO_QUEUE_NAME } from '../../queue/constants/queue.constants.js';
import type { ProcessVideoJobPayload } from '../../queue/types/process-video-job.js';
import {
  M3_STUB_DELAY_MS,
  VIDEO_WORKER_CONCURRENCY,
} from '../constants/worker.constants.js';

/**
 * M3 scaffold: global concurrency 1, no FFmpeg.
 * Delays the job so it stays pending for M4 without completing/failing.
 */
@Processor(VIDEO_QUEUE_NAME, { concurrency: VIDEO_WORKER_CONCURRENCY })
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  // Nest/BullMQ require a prototype process hook on WorkerHost.
  async process(
    job: Job<ProcessVideoJobPayload>,
    token?: string,
  ): Promise<void> {
    return this.holdForM4(job, token);
  }

  private readonly holdForM4 = async (
    job: Job<ProcessVideoJobPayload>,
    token?: string,
  ): Promise<void> => {
    this.logger.log(
      `M3 stub (concurrency=${VIDEO_WORKER_CONCURRENCY}): holding taskId=${job.data.taskId} until M4 FFmpeg`,
    );
    await job.moveToDelayed(Date.now() + M3_STUB_DELAY_MS, token);
    throw new DelayedError();
  };
}
