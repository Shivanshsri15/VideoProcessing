import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage.js';
import { UsersModule } from './users/users.module.js';

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
    ThrottlerModule.forRootAsync({
      imports: [RedisModule, ConfigModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get<string>('THROTTLE_TTL_MS') ?? 60_000),
            limit: Number(config.get<string>('THROTTLE_LIMIT') ?? 60),
          },
        ],
        storage,
      }),
    }),
    UsersModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
