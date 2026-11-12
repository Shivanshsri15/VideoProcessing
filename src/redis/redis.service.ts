import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit = (): void => {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  };

  onModuleDestroy = async (): Promise<void> => {
    if (this.client) {
      await this.client.quit();
    }
  };

  getClient = (): Redis => this.client;

  exists = async (key: string): Promise<boolean> => {
    const result = await this.client.exists(key);
    return result === 1;
  };

  get = async (key: string): Promise<string | null> => this.client.get(key);

  setWithTtlSeconds = async (
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> => {
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    await this.client.set(key, value, 'EX', ttl);
  };

  incr = async (key: string): Promise<number> => this.client.incr(key);

  expire = async (key: string, ttlSeconds: number): Promise<void> => {
    await this.client.expire(key, Math.max(1, Math.ceil(ttlSeconds)));
  };

  pttl = async (key: string): Promise<number> => this.client.pttl(key);
}
