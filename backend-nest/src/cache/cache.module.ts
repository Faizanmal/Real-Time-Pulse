import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { AdvancedCacheService } from './advanced-cache.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host') as string,
          port: configService.get<number>('redis.port') as number,
          password: configService.get<string>('redis.password'),
          db: configService.get<number>('redis.db') as number,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService, CacheService, AdvancedCacheService],
  exports: [RedisService, CacheService, AdvancedCacheService, BullModule],
})
export class CacheModule {}
