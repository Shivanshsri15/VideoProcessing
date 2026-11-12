import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

@Global()
@Module({
  providers: [RedisService, RedisThrottlerStorage],
  exports: [RedisService, RedisThrottlerStorage],
})
export class RedisModule {}
