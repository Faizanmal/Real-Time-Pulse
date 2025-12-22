import { Request } from 'express';

/**
 * User payload for JWT tokens
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  workspaceId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * User object attached to requests after authentication
 */
export interface RequestUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  workspaceId: string;
  role: string;
  permissions?: string[];
}

/**
 * Authenticated request with user context
 */
export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  requestId?: string;
  correlationId?: string;
  startTime?: number;
}

/**
 * API Key user context
 */
export interface ApiKeyUser {
  id: string;
  workspaceId: string;
  scopes: string[];
  name: string;
}

/**
 * Request with optional API key authentication
 */
export interface ApiKeyRequest extends Request {
  apiKey?: ApiKeyUser;
}

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user !== undefined && typeof (req as AuthenticatedRequest).user.id === 'string';
}

/**
 * Type guard to check if request has API key
 */
export function hasApiKey(req: Request): req is ApiKeyRequest {
  return 'apiKey' in req && req.apiKey !== undefined;
}
