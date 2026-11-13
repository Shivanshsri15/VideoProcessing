import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { loadavg } from 'node:os';
import { Model, Types } from 'mongoose';
import { VIDEO_QUEUE_NAME } from '../../queue/constants/queue.constants.js';
import { VIDEO_WORKER_CONCURRENCY } from '../../worker/constants/worker.constants.js';
import {
  VideoTask,
  VideoTaskDocument,
} from '../schemas/video-task.schema.js';
import { VIDEO_TASK_STATUSES } from '../types/video-task-status.js';
import { ANALYTICS_DURATION_SAMPLE_LIMIT } from './analytics.constants.js';
import {
  average,
  buildDurationDistribution,
  failureRate,
  percentile,
} from './analytics.metrics.js';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(VideoTask.name)
    private readonly videoTaskModel: Model<VideoTaskDocument>,
    @InjectQueue(VIDEO_QUEUE_NAME) private readonly videoQueue: Queue,
  ) {}

  getAnalytics = async (userId: string) => {
    const [statusGroups, samples, userGroups] = await Promise.all([
      this.videoTaskModel
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.videoTaskModel
        .aggregate<{
          durationSec: number;
          etaSeconds: number;
        }>([
          {
            $match: {
              status: 'completed',
              startedAt: { $exists: true, $ne: null },
              completedAt: { $exists: true, $ne: null },
            },
          },
          { $sort: { completedAt: -1 } },
          { $limit: ANALYTICS_DURATION_SAMPLE_LIMIT },
          {
            $project: {
              _id: 0,
              etaSeconds: 1,
              durationSec: {
                $divide: [
                  { $subtract: ['$completedAt', '$startedAt'] },
                  1000,
                ],
              },
            },
          },
        ])
        .exec(),
      this.videoTaskModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { userId: new Types.ObjectId(userId) } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const totals = {
      all: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const status of VIDEO_TASK_STATUSES) {
      totals[status] = 0;
    }
    for (const row of statusGroups) {
      const key = row._id as keyof typeof totals;
      if (key in totals && key !== 'all') {
        totals[key] = row.count;
      }
      totals.all += row.count;
    }

    const durations = samples
      .map((s) => s.durationSec)
      .filter((n) => Number.isFinite(n) && n >= 0);
    const etas = samples
      .map((s) => s.etaSeconds)
      .filter((n) => Number.isFinite(n) && n >= 0);

    const userCounts = {
      uploads: 0,
      completed: 0,
      failed: 0,
    };
    for (const row of userGroups) {
      userCounts.uploads += row.count;
      if (row._id === 'completed') {
        userCounts.completed = row.count;
      }
      if (row._id === 'failed') {
        userCounts.failed = row.count;
      }
    }

    return {
      totals,
      failureRate: failureRate(totals.completed, totals.failed),
      processingTime: {
        sampleSize: durations.length,
        avgSeconds: average(durations),
        p50Seconds: percentile(durations, 50),
        p95Seconds: percentile(durations, 95),
        avgEtaSeconds: average(etas),
        distribution: buildDurationDistribution(durations),
      },
      userActivity: {
        userId,
        ...userCounts,
      },
    };
  };

  getQueueSnapshot = async () => {
    const counts = await this.videoQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
    );
    const waiting = counts.waiting ?? 0;
    const avgSeconds = await this.avgRecentCompletedDurationSec();
    const estimatedWaitSeconds =
      avgSeconds === null ? null : waiting * avgSeconds;

    return {
      concurrency: VIDEO_WORKER_CONCURRENCY,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
      },
      waiting,
      estimatedWaitSeconds,
    };
  };

  getSystem = () => {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
      node: {
        version: process.version,
        uptimeSeconds: process.uptime(),
      },
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
      cpu: {
        loadAvg: [...loadavg()],
        usageMicros: {
          user: cpu.user,
          system: cpu.system,
        },
      },
      worker: {
        concurrency: VIDEO_WORKER_CONCURRENCY,
        queueName: VIDEO_QUEUE_NAME,
      },
    };
  };

  private avgRecentCompletedDurationSec = async (): Promise<number | null> => {
    const samples = await this.videoTaskModel
      .aggregate<{ durationSec: number }>([
        {
          $match: {
            status: 'completed',
            startedAt: { $exists: true, $ne: null },
            completedAt: { $exists: true, $ne: null },
          },
        },
        { $sort: { completedAt: -1 } },
        { $limit: 200 },
        {
          $project: {
            _id: 0,
            durationSec: {
              $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000],
            },
          },
        },
      ])
      .exec();
    return average(
      samples
        .map((s) => s.durationSec)
        .filter((n) => Number.isFinite(n) && n >= 0),
    );
  };
}
