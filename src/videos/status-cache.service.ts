import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service.js';
import {
  DEFAULT_TASK_STATUS_CACHE_TTL_SEC,
  taskStatusCacheKey,
} from './constants/status-cache.constants.js';
import type { TaskStatusSnapshot } from './types/task-status-snapshot.js';

@Injectable()
export class StatusCacheService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(
      config.get<string>('TASK_STATUS_CACHE_TTL_SEC') ??
        DEFAULT_TASK_STATUS_CACHE_TTL_SEC,
    );
  }

  set = async (snapshot: TaskStatusSnapshot): Promise<void> => {
    await this.redis.setWithTtlSeconds(
      taskStatusCacheKey(snapshot.taskId),
      JSON.stringify(snapshot),
      this.ttlSeconds,
    );
  };

  get = async (taskId: string): Promise<TaskStatusSnapshot | null> => {
    const raw = await this.redis.get(taskStatusCacheKey(taskId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as TaskStatusSnapshot;
    } catch {
      return null;
    }
  };
}
