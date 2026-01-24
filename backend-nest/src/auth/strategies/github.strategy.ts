import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

interface GitHubProfile {
  id: string;
  username: string;
  displayName: string;
  emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  _json: {
    login: string;
    avatar_url: string;
    name?: string;
    email?: string;
    bio?: string;
  };
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('oauth.github.clientId');
    const clientSecret = configService.get<string>('oauth.github.clientSecret');

    if (!clientID || !clientSecret) {
      console.warn('GitHub OAuth credentials not provided. GitHub authentication will not work.');
    }

    super({
      clientID: clientID || 'MISSING_CLIENT_ID',
      clientSecret: clientSecret || 'MISSING_CLIENT_SECRET',
      callbackURL: configService.get<string>('oauth.github.callbackUrl'),
      scope: ['user:email', 'read:user'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
    done: (error: any, user?: any) => void,
  ): void {
    const { id, emails, photos, _json } = profile;

    // Get primary email or first verified email
    let email = '';
    if (emails && emails.length > 0) {
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      const verifiedEmail = emails.find((e) => e.verified);
      email = primaryEmail?.value || verifiedEmail?.value || emails[0].value;
    }

    // Parse name from displayName or JSON
    let firstName = '';
    let lastName = '';
    if (_json.name) {
      const nameParts = _json.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    } else {
      firstName = _json.login;
    }

    const user = {
      githubId: id,
      email,
      firstName,
      lastName,
      avatar: photos?.[0]?.value || _json.avatar_url,
      username: _json.login,
    };

    done(null, user);
  }
}
