import { BullModule } from '@nestjs/bull';
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AdvancedCacheService } from './advanced-cache.service';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) =>
        ({
          redis: {
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            password: configService.get<string>('redis.password'),
            db: configService.get<number>('redis.db'),
          },
        }) as any,
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService, CacheService, AdvancedCacheService],
  exports: [RedisService, CacheService, AdvancedCacheService, BullModule],
})
export class CacheModule {}
