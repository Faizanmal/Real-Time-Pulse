# 🔒 Security Implementation Guide

## Overview

This document outlines the comprehensive security measures implemented in Real-Time Pulse to protect against common attacks, secure user data, and ensure system reliability.

---

## 1. Multi-Provider Authentication

### Supported Providers

| Provider | Status | Documentation |
|----------|--------|---------------|
| Email/Password | ✅ Active | Built-in |
| Google OAuth 2.0 | ✅ Active | [Setup Guide](#google-oauth) |
| GitHub OAuth | ✅ Active | [Setup Guide](#github-oauth) |
| Firebase Auth | ✅ Active | [Setup Guide](#firebase-auth) |

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/v1/auth/google/callback`
   - Production: `https://api.yourdomain.com/api/v1/auth/google/callback`
6. Set environment variables:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
   ```

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Homepage URL and Authorization callback URL
4. Set environment variables:
   ```env
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
   ```

### Firebase Auth Setup

1. Create project in [Firebase Console](https://console.firebase.google.com/)
2. Enable Email/Password authentication
3. Download service account JSON
4. Set environment variables:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```

---

## 2. Password Security

### Password Policy (Default)

- **Minimum Length:** 12 characters
- **Maximum Length:** 128 characters
- **Required Characters:**
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
  - At least 1 special character (!@#$%^&*(),.?":{}|<>)

### Password Hashing

- **Algorithm:** bcrypt
- **Salt Rounds:** 12 (configurable via `BCRYPT_ROUNDS`)
- **Features:**
  - Automatic salt generation
  - Timing-safe comparison
  - No password stored in plaintext

### Configuration

```env
PASSWORD_MIN_LENGTH=12
PASSWORD_MAX_LENGTH=128
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true
BCRYPT_ROUNDS=12
```

---

## 3. Token Management

### Access Tokens (JWT)

- **Expiration:** 15 minutes (configurable)
- **Algorithm:** HS256
- **Payload:** User ID, email, workspace ID, role
- **Issuer/Audience:** Validated on every request

### Refresh Tokens

- **Expiration:** 30 days
- **Storage:** Redis with device fingerprint
- **Rotation:** New refresh token on each use
- **Revocation:** Immediate via logout

### Token Blacklisting

- Tokens are blacklisted on logout
- Blacklist stored in Redis with TTL matching token expiry
- Prevents token reuse after logout

---

## 4. Rate Limiting

### Configuration

| Endpoint Type | Time Window | Max Requests |
|--------------|-------------|--------------|
| Global | 1 minute | 100 |
| Authentication | 15 minutes | 5 |
| API | 1 minute | 1000 |
| Password Reset | 1 hour | 3 |

### IP Blocking

- **Max Failed Attempts:** 10
- **Block Duration:** 30 minutes
- **Automatic Unblock:** After duration expires

### Implementation

```typescript
@Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
@Post('signin')
async signIn() { ... }
```

---

## 5. Attack Prevention

### SQL Injection Prevention

- ✅ Prisma ORM with parameterized queries
- ✅ Input validation with class-validator
- ✅ Pattern detection in security middleware

### XSS Prevention

- ✅ Content Security Policy headers
- ✅ Input sanitization
- ✅ Output encoding
- ✅ HttpOnly cookies

### CSRF Prevention

- ✅ SameSite cookie attribute
- ✅ Origin validation
- ✅ Custom header requirements

### SSRF Prevention

- ✅ URL validation middleware
- ✅ Internal IP blocking
- ✅ Allowlist for external requests

### Security Headers

```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
})
```

---

## 6. Bot Protection (reCAPTCHA v3)

### Setup

1. Get keys from [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Select reCAPTCHA v3
3. Add your domains
4. Configure environment:
   ```env
   RECAPTCHA_ENABLED=true
   RECAPTCHA_SITE_KEY=your-site-key
   RECAPTCHA_SECRET_KEY=your-secret-key
   RECAPTCHA_MIN_SCORE=0.5
   ```

### Usage

The system automatically validates reCAPTCHA tokens on:
- User registration
- Login attempts
- Password reset requests

---

## 7. Data Encryption

### At Rest

- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Encrypted Fields:**
  - OAuth tokens
  - API keys
  - Sensitive user data

### In Transit

- **Protocol:** TLS 1.2+ (1.3 preferred)
- **HSTS:** Enabled with preload
- **Certificate:** Required for production

### Implementation

```typescript
// Encrypting data
const encrypted = encryptionService.encrypt(sensitiveData);

// Decrypting data
const decrypted = encryptionService.decrypt(encrypted);
```

---

## 8. Backup & Recovery

### Automated Backups

- **Schedule:** Daily at 2:00 AM
- **Retention:** 30 days (configurable)
- **Storage:** Encrypted, local + optional remote

### Backup Features

- Full database backup
- Checksum verification
- Encryption at rest
- Automatic cleanup

### Recovery

```typescript
// List available backups
GET /api/v1/admin/backups

// Restore from backup (dry run)
POST /api/v1/admin/backups/{id}/restore?dryRun=true

// Actual restore
POST /api/v1/admin/backups/{id}/restore
```

---

## 9. Audit Logging

### Logged Events

- Authentication attempts (success/failure)
- Resource access (CRUD operations)
- Security events (blocked IPs, suspicious activity)
- Configuration changes

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "SIGN_IN",
  "userId": "user-123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "status": "success",
  "metadata": {}
}
```

### Retention

- Default: 365 days
- Configurable via `AUDIT_RETENTION_DAYS`

---

## 10. Security Checklist

### Before Production

- [ ] Generate strong JWT_SECRET (64+ characters)
- [ ] Generate strong ENCRYPTION_KEY (32+ characters)
- [ ] Configure OAuth providers with production URLs
- [ ] Enable reCAPTCHA for public endpoints
- [ ] Set up TLS/SSL certificates
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Test backup/restore procedures
- [ ] Review rate limiting settings
- [ ] Set up monitoring/alerting

### Environment Variables

Ensure all security-related environment variables are set:

```bash
# Verify required variables
node -e "
const required = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
  'REDIS_HOST'
];
required.forEach(key => {
  if (!process.env[key]) console.log('Missing:', key);
});
"
```

---

## 11. Security Headers Reference

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | See config | Prevents XSS |
| Strict-Transport-Security | max-age=31536000 | Forces HTTPS |
| X-Frame-Options | DENY | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-XSS-Protection | 1; mode=block | Legacy XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer |
| Permissions-Policy | Restrictive | Limits browser features |

---

## 12. Incident Response

### Detecting Security Events

Monitor the following:
- Failed login attempts (> 5 from same IP)
- Unusual API patterns
- Rate limit violations
- Token blacklist additions

### Response Steps

1. **Identify** - Review audit logs and security events
2. **Contain** - Block suspicious IPs/users
3. **Eradicate** - Remove compromised tokens/sessions
4. **Recover** - Restore from backup if needed
5. **Document** - Record incident details

### Emergency Actions

```bash
# Block an IP immediately
POST /api/v1/admin/security/block-ip
{ "ip": "malicious-ip", "reason": "Suspicious activity" }

# Revoke all sessions for a user
POST /api/v1/admin/users/{id}/revoke-sessions

# Force password reset
POST /api/v1/admin/users/{id}/force-password-reset
```

---

## 13. Compliance Notes

### Data Protection

- User passwords never stored in plaintext
- Sensitive data encrypted at rest
- Data access logged and auditable
- User can request data deletion

### Session Security

- Sessions expire after inactivity
- Concurrent session limits enforced
- Sessions revocable by user/admin

---

## Support

For security concerns or vulnerability reports:
- Email: security@yourdomain.com
- Create a private security advisory on GitHub

---

*Last Updated: December 2024*
