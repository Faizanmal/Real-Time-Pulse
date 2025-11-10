/**
 * User payload for JWT tokens
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  workspaceId: string;
  role: string;
}

/**
 * User object attached to requests after authentication
 */
export interface RequestUser {
  id: string;
  email: string;
  workspaceId: string;
  role: string;
}
