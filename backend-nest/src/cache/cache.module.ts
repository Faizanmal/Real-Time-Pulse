import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
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
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService, BullModule],
})
export class CacheModule {}
