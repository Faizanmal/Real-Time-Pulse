import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL || '60', 10), // Time window in seconds
  limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10), // Max requests per window

  // Public endpoints (more restrictive)
  public: {
    ttl: 60,
    limit: 20,
  },

  // Authentication endpoints (very restrictive)
  auth: {
    ttl: 900, // 15 minutes
    limit: 5, // Max 5 login attempts
  },

  // Authenticated endpoints (more permissive)
  authenticated: {
    ttl: 60,
    limit: 100,
  },
}));
