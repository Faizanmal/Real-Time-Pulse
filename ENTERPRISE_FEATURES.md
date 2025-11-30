# New Enterprise Features - Implementation Guide

This document describes all new features implemented in the Real-Time Pulse platform.

## Table of Contents

1. [Scheduled Reports](#1-scheduled-reports)
2. [Public Share Links](#2-public-share-links)
3. [Comments & Collaboration](#3-comments--collaboration)
4. [Widget & Portal Templates](#4-widget--portal-templates)
5. [Billing & Stripe Integration](#5-billing--stripe-integration)
6. [Extended Integrations](#6-extended-integrations)
7. [Enhanced AI Insights](#7-enhanced-ai-insights)
8. [Analytics Dashboard](#8-analytics-dashboard)
9. [Security & SSO](#9-security--sso)
10. [Mobile PWA Support](#10-mobile-pwa-support)

---

## 1. Scheduled Reports

Automate report generation and email delivery on custom schedules.

### API Endpoints

```bash
# Create scheduled report
POST /api/scheduled-reports
{
  "name": "Weekly KPI Report",
  "portalId": "portal-uuid",
  "schedule": "0 9 * * 1",  # Every Monday at 9am
  "format": "PDF",
  "recipients": ["client@example.com"],
  "timezone": "America/New_York",
  "includeWidgets": ["widget-1", "widget-2"]
}

# List scheduled reports
GET /api/scheduled-reports

# Update report
PATCH /api/scheduled-reports/:id

# Delete report
DELETE /api/scheduled-reports/:id

# Trigger immediate report
POST /api/scheduled-reports/:id/trigger
```

### Features
- Cron-based scheduling with timezone support
- Multiple formats: PDF, Excel, CSV
- Email delivery to multiple recipients
- Include/exclude specific widgets
- Custom date ranges

---

## 2. Public Share Links

Share portals with external users via secure links.

### API Endpoints

```bash
# Create share link
POST /api/share-links
{
  "portalId": "portal-uuid",
  "expiresAt": "2025-12-31T23:59:59Z",
  "password": "optional-password",
  "maxViews": 100,
  "permissions": ["view", "export"]
}

# Access portal via share link
GET /api/share-links/:token/access
# Include header: X-Share-Password: password (if required)

# List share links for portal
GET /api/share-links?portalId=portal-uuid

# Revoke share link
DELETE /api/share-links/:id
```

### Features
- Unique secure tokens
- Optional password protection
- Expiration dates
- View limits
- Granular permissions
- Access analytics

---

## 3. Comments & Collaboration

Add threaded comments to portal widgets.

### API Endpoints

```bash
# Create comment
POST /api/comments
{
  "portalId": "portal-uuid",
  "widgetId": "widget-uuid",
  "content": "Great progress on this metric!",
  "parentId": null,  # For replies
  "mentions": ["user-uuid-1", "user-uuid-2"]
}

# Get portal comments
GET /api/comments?portalId=portal-uuid

# Update comment
PATCH /api/comments/:id

# Delete comment
DELETE /api/comments/:id
```

### Features
- Threaded discussions
- @mentions with notifications
- Real-time updates via WebSocket
- Markdown support
- Comment reactions

---

## 4. Widget & Portal Templates

Create and share reusable templates.

### API Endpoints

```bash
# Create widget template
POST /api/templates/widgets
{
  "name": "KPI Scorecard",
  "description": "Standard KPI display widget",
  "type": "CHART",
  "config": { ... },
  "isPublic": true,
  "category": "Analytics",
  "tags": ["kpi", "scorecard"]
}

# Create portal template
POST /api/templates/portals
{
  "name": "Marketing Dashboard",
  "description": "Complete marketing analytics portal",
  "config": { ... },
  "widgets": [...],
  "isPublic": true
}

# Clone template
POST /api/templates/widgets/:id/clone
POST /api/templates/portals/:id/clone

# Browse public templates
GET /api/templates/widgets/public
GET /api/templates/portals/public

# Rate template
POST /api/templates/widgets/:id/rate
{
  "rating": 5
}
```

### Features
- Widget templates
- Full portal templates
- Public template marketplace
- Rating system
- Easy cloning
- Category organization

---

## 5. Billing & Stripe Integration

Full subscription management with Stripe.

### API Endpoints

```bash
# Create checkout session
POST /api/billing/checkout
{
  "planId": "professional",
  "successUrl": "https://app.example.com/billing?success=true",
  "cancelUrl": "https://app.example.com/billing?canceled=true"
}

# Create billing portal session
POST /api/billing/portal

# Get subscription status
GET /api/billing/subscription

# Get invoices
GET /api/billing/invoices

# Handle webhook (internal)
POST /api/billing/webhook
```

### Plans

| Plan | Portals | Widgets | Integrations | Users |
|------|---------|---------|--------------|-------|
| Free | 3 | 10 | 2 | 1 |
| Starter | 10 | 50 | 5 | 5 |
| Professional | 50 | 200 | 20 | 25 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

---

## 6. Extended Integrations

New data source integrations.

### Supported Platforms

| Platform | Data Types |
|----------|------------|
| Jira | Issues, Sprints, Boards, Projects |
| Trello | Boards, Lists, Cards |
| GitHub | Repositories, Issues, Pull Requests, Commits |
| HubSpot | Contacts, Deals, Pipelines, Campaigns |
| Slack | Messages, Channels, Users |
| Monday.com | Boards, Items (coming soon) |
| QuickBooks | Invoices, Accounts (coming soon) |

### API Endpoints

```bash
# Connect integration
POST /api/integrations
{
  "provider": "GITHUB",
  "name": "My GitHub",
  "credentials": {
    "accessToken": "ghp_..."
  },
  "config": {
    "organization": "my-org"
  }
}

# Fetch data
POST /api/integrations/:id/fetch
{
  "dataType": "repositories"
}

# Test connection
POST /api/integrations/:id/test
```

---

## 7. Enhanced AI Insights

Advanced AI-powered analytics.

### API Endpoints

```bash
# Get predictive insights
GET /api/ai-insights/portal/:portalId/predictive

# Get metric forecast
GET /api/ai-insights/forecast?metricId=metric-uuid&days=30

# Ask natural language question
POST /api/ai-insights/ask
{
  "question": "What's driving the increase in conversion rates?",
  "context": { "portalId": "portal-uuid" }
}

# Generate standard insights
GET /api/ai-insights/portal/:portalId
```

### Features
- Predictive analytics with completion forecasting
- Trend analysis and anomaly detection
- Natural language queries
- Goal tracking predictions
- Metric correlations

### Environment Variables

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

---

## 8. Analytics Dashboard

System-wide usage analytics and monitoring.

### API Endpoints

```bash
# Get dashboard stats
GET /api/analytics/dashboard

# Track custom event
POST /api/analytics/events
{
  "eventType": "PORTAL_VIEW",
  "resourceId": "portal-uuid",
  "metadata": { "source": "share_link" }
}

# Get recent events
GET /api/analytics/events?limit=50

# Get usage metrics
GET /api/analytics/usage?startDate=2025-01-01&endDate=2025-01-31&aggregation=daily

# Get system health
GET /api/analytics/system/health
```

### Dashboard Metrics
- Total portals, widgets, users
- Active users (24h)
- API calls
- Data syncs
- System health (CPU, memory, disk, Redis)

---

## 9. Security & SSO

Enterprise security features.

### API Endpoints

```bash
# Get security settings
GET /api/security/settings

# Update security settings
PUT /api/security/settings
{
  "mfaEnabled": true,
  "mfaMethod": "totp",
  "passwordPolicy": {
    "minLength": 12,
    "requireSpecial": true
  },
  "sessionPolicy": {
    "maxConcurrentSessions": 3
  }
}

# Setup TOTP
POST /api/security/2fa/totp/setup
# Returns: { secret, qrCode, backupCodes }

# Verify TOTP
POST /api/security/2fa/totp/verify
{ "token": "123456" }

# Configure SSO provider
POST /api/security/sso/providers
{
  "id": "okta",
  "name": "Okta",
  "type": "oidc",
  "enabled": true,
  "config": {
    "issuer": "https://company.okta.com",
    "clientId": "...",
    "clientSecret": "...",
    "redirectUri": "https://app.example.com/auth/callback"
  }
}

# Get active sessions
GET /api/security/sessions

# Terminate session
DELETE /api/security/sessions/:sessionId
```

### Features
- Two-factor authentication (TOTP, Email)
- Backup codes
- Password policies
- Session management
- Account lockout protection
- IP whitelisting
- SSO (SAML, OIDC, OAuth2)

---

## 10. Mobile PWA Support

Progressive Web App for mobile access.

### Features
- Installable on mobile devices
- Offline support with service worker
- Push notifications
- Background sync
- Responsive design

### Service Worker Registration

```typescript
// In your app
import { usePWA, useInstallPrompt } from '@/hooks/use-pwa';

function App() {
  const { isOffline, updateAvailable, update, install } = usePWA();
  const canInstall = useInstallPrompt();

  return (
    <div>
      {isOffline && <OfflineBanner />}
      {updateAvailable && <UpdateBanner onUpdate={update} />}
      {canInstall && <InstallButton onClick={install} />}
    </div>
  );
}
```

### Push Notifications

```typescript
const { requestNotificationPermission, subscribeToPush } = usePWA();

async function enableNotifications() {
  const permission = await requestNotificationPermission();
  if (permission === 'granted') {
    await subscribeToPush();
  }
}
```

---

## Installation

### Backend Dependencies

```bash
cd backend-nest
npm install
```

New packages added:
- `@nestjs/schedule` - Cron job scheduling
- `cron-parser` - Schedule validation
- `stripe` - Payment processing
- `openai` - AI/NLP features
- `speakeasy` - TOTP generation
- `qrcode` - QR code generation
- `web-push` - Push notifications

### Database Migration

```bash
cd backend-nest
npx prisma migrate dev --name add_new_features
npx prisma generate
```

### Environment Variables

Add to your `.env` file:

```env
# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# OpenAI
OPENAI_API_KEY=

# Push Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com

# Integration API Keys
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
HUBSPOT_API_KEY=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
```

---

## Architecture Overview

```
backend-nest/src/
├── scheduled-reports/    # Automated report generation
├── share-links/          # Public portal sharing
├── comments/             # Collaboration features
├── templates/            # Widget/portal templates
├── billing/              # Stripe subscription management
├── analytics/            # Usage tracking & monitoring
├── security/             # 2FA, SSO, security policies
├── integrations/
│   └── services/
│       ├── jira.service.ts
│       ├── trello.service.ts
│       ├── github.service.ts
│       ├── hubspot.service.ts
│       └── slack.service.ts
├── ai-insights/          # Enhanced with predictive & NLP
└── config/
    └── billing.config.ts
```

---

## Support

For questions or issues with these features, please open an issue on GitHub or contact support.
