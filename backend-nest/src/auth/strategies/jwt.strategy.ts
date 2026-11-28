import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import type { JwtPayload, RequestUser } from '../../common/interfaces/auth.interface';
import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.pulse_access || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      passReqToCallback: true,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<RequestUser> {
    const authorization = request.headers.authorization;
    const token = request.cookies?.pulse_access ||
      (authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined);
    if (token && await this.cacheService.get(`token_blacklist:${token}`)) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        workspaceId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      workspaceId: user.workspaceId,
      role: user.role,
    };
  }
}
