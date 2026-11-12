import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service.js';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `rl:${throttlerName}:${key}`;
    const totalHits = await this.redis.incr(redisKey);

    if (totalHits === 1) {
      await this.redis.expire(redisKey, Math.ceil(ttl / 1000));
    }

    const msBeforeNext = await this.redis.pttl(redisKey);
    const timeToExpire = msBeforeNext > 0 ? msBeforeNext : ttl;
    const isBlocked = totalHits > limit;
    const timeToBlockExpire = isBlocked
      ? Math.max(blockDuration, timeToExpire)
      : 0;

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
