import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Allows unassigned bearer links to stay anonymous, while validating a supplied session. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_error: any, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
