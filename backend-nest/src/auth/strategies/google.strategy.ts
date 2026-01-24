import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('oauth.google.clientId');
    const clientSecret = configService.get<string>('oauth.google.clientSecret');
    const callbackURL =
      configService.get<string>('oauth.google.callbackUrl') ||
      'http://localhost:3001/api/v1/auth/google/callback';

    // Log configuration status
    if (!clientID || !clientSecret) {
      console.error('========================================');
      console.error('GOOGLE OAUTH NOT CONFIGURED');
      console.error('========================================');
      console.error('To enable Google Sign-in, add these to your .env file:');
      console.error('  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
      console.error('  GOOGLE_CLIENT_SECRET=your-client-secret');
      console.error('  GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback');
      console.error('');
      console.error('Get credentials from: https://console.cloud.google.com/apis/credentials');
      console.error('========================================');
    } else {
      console.log('✓ Google OAuth configured with callback URL:', callbackURL);
    }

    super({
      clientID: clientID || 'NOT_CONFIGURED',
      clientSecret: clientSecret || 'NOT_CONFIGURED',
      callbackURL: callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): any {
    const { id, emails, name, photos } = profile;

    const user = {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      avatar: photos[0]?.value,
    };

    this.logger.log(`Google OAuth login: ${user.email}`);
    done(null, user);
  }
}
