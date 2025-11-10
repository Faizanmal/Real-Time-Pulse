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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { id, emails, name, photos } = profile;

    const user = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      googleId: id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: emails[0].value,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      firstName: name.givenName,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      lastName: name.familyName,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      avatar: photos[0]?.value,
    };
    done(null, user);
  }
}
