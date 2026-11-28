import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      db: this.configService.get<number>('redis.db'),
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
      },
    });

    this.client.on('error', (error) => {
      console.error('Redis Client Error:', error);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Atomically read and delete a one-time value, preventing concurrent refresh reuse. */
  async consume(key: string): Promise<string | null> {
    const result = await this.client.eval(
      "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
      1,
      key,
    );
    return typeof result === 'string' ? result : null;
  }

  async addToSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.client.sadd(key, value);
    if (ttlSeconds) await this.client.expire(key, ttlSeconds);
  }

  /** Claim an idempotency token with a TTL in one Redis transaction. */
  async claimSetMember(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const claimed = await this.client.eval(
      "local added = redis.call('SADD', KEYS[1], ARGV[1]); if added == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]); end; return added",
      1,
      key,
      value,
      String(ttlSeconds),
    );
    return Number(claimed) === 1;
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    await this.client.srem(key, value);
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const data = await this.get(key);

    return data ? JSON.parse(data) : null;
  }

  async setJSON<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
