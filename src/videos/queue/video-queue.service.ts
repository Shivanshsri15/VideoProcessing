import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  PROCESS_VIDEO_JOB_NAME,
  VIDEO_QUEUE_NAME,
} from '../../queue/constants/queue.constants.js';
import type { ProcessVideoJobPayload } from '../../queue/types/process-video-job.js';

/** Videos-module producer: enqueue processing jobs after upload. */
@Injectable()
export class VideoQueueService {
  constructor(
    @InjectQueue(VIDEO_QUEUE_NAME) private readonly videoQueue: Queue,
  ) {}

  /** Enqueue with jobId = taskId so each task has at most one active job. */
  enqueueProcessVideo = async (
    payload: ProcessVideoJobPayload,
  ): Promise<void> => {
    await this.videoQueue.add(PROCESS_VIDEO_JOB_NAME, payload, {
      jobId: payload.taskId,
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    });
  };
}
