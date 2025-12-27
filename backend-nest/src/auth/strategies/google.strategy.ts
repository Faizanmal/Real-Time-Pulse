import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('oauth.google.clientId') as string,
      clientSecret: configService.get<string>(
        'oauth.google.clientSecret',
      ) as string,
      callbackURL: configService.get<string>(
        'oauth.google.callbackUrl',
      ) as string,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): any {
    const { id, emails, name, photos } = profile;

    const user = {
      googleId: id,

      email: emails[0].value,

      firstName: name.givenName,

      lastName: name.familyName,

      avatar: photos[0]?.value,
    };
    done(null, user);
  }
}
