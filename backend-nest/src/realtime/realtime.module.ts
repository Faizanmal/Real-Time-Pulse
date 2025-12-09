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
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
    PresenceService,
    BroadcastService,
    RoomService,
  ],
  exports: [
    RealtimeGateway,
    RealtimeService,
    PresenceService,
    BroadcastService,
    RoomService,
  ],
})
export class RealtimeModule {}
