/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX REALTIME MODULE
 * ============================================================================
 * Comprehensive real-time module for WebSocket communication, presence,
 * and live updates across the platform.
 */

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PresenceService } from './presence.service';
import { BroadcastService } from './broadcast.service';
import { RoomService } from './room.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresRaw = configService.get<string>('jwt.expiresIn') ?? '1h';
        const expiresIn = Number.isFinite(Number(expiresRaw)) ? Number(expiresRaw) : expiresRaw;
        return {
          secret: configService.get<string>('jwt.secret'),
          signOptions: {
            // Cast to any to satisfy JwtModuleOptions type which expects number | StringValue
            expiresIn: expiresIn as unknown as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [RealtimeGateway, RealtimeService, PresenceService, BroadcastService, RoomService],
  exports: [RealtimeGateway, RealtimeService, PresenceService, BroadcastService, RoomService],
})
export class RealtimeModule {}
