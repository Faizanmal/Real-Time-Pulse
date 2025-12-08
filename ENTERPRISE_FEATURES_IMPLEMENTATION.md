# New Enterprise Features Implementation Guide

This document describes the newly implemented enterprise features in Real-Time Pulse.

## Features Overview

### 1. Data Backup & Point-in-Time Recovery ✅

**Location:** `backend-nest/src/backup/`

**Features:**
- Automated daily backups at 2:00 AM
- Encrypted backup storage with AES-256-GCM
- Point-in-time recovery for accidental deletions
- Cross-region backup replication support
- Compression to reduce storage costs
- 30-day retention policy (configurable)

**API Endpoints:**
- `POST /api/backups` - Create manual backup
- `GET /api/backups` - List all backups
- `POST /api/backups/:id/restore` - Restore from backup
- `POST /api/backups/restore/point-in-time` - Restore to specific timestamp

**Frontend Component:** `BackupManager` (`frontend/src/components/backup/BackupManager.tsx`)

**Environment Variables:**
```env
BACKUP_ENCRYPTION_KEY=your-32-byte-encryption-key
BACKUP_RETENTION_DAYS=30
```

---

### 2. Custom Integration Builder 🔌

**Location:** `backend-nest/src/integration-builder/`

**Features:**
- No-code integration builder
- OAuth2 authentication support
- OpenAPI specification import
- Custom data transformation rules (map, filter, aggregate, calculate)
- Custom widget type creation
- API endpoint testing
- Token refresh automation

**API Endpoints:**
- `POST /api/integration-builder/integrations` - Create integration
- `POST /api/integration-builder/integrations/import-openapi` - Import from OpenAPI spec
- `POST /api/integration-builder/integrations/:id/oauth2` - Setup OAuth2
- `POST /api/integration-builder/integrations/:id/transformations` - Add transformation
- `POST /api/integration-builder/integrations/:id/widgets` - Create custom widget
- `POST /api/integration-builder/integrations/:id/test/:endpointId` - Test endpoint
- `POST /api/integration-builder/integrations/:id/execute/:endpointId` - Execute integration

**Frontend Component:** `IntegrationBuilder` (`frontend/src/components/integrations/IntegrationBuilder.tsx`)

**Example Usage:**
```typescript
// Import from OpenAPI spec
const integration = await fetch('/api/integration-builder/integrations/import-openapi', {
  method: 'POST',
  body: JSON.stringify({
    workspaceId: 'workspace-123',
    openAPISpec: 'https://api.example.com/openapi.json',
    name: 'My Custom API'
  })
});

// Add data transformation
await fetch(`/api/integration-builder/integrations/${integration.id}/transformations`, {
  method: 'POST',
  body: JSON.stringify({
    sourceField: 'created_date',
    targetField: 'createdAt',
    transformation: 'map',
    config: {}
  })
});
```

---

### 3. API Rate Limit Optimization ⚡

**Location:** `backend-nest/src/rate-limit/`

**Features:**
- Intelligent request batching and queuing
- Predictive rate limit management
- Automatic retry with exponential backoff (max 3 attempts)
- Real-time rate limit monitoring per integration
- Dynamic rate limit adjustment
- Bull queue for job processing

**API Endpoints:**
- `POST /api/rate-limit/configure` - Set rate limits
- `POST /api/rate-limit/queue` - Queue request
- `GET /api/rate-limit/monitoring` - Get real-time metrics
- `GET /api/rate-limit/queue/stats` - Get queue statistics
- `POST /api/rate-limit/:integrationId/clear` - Clear rate limit
- `POST /api/rate-limit/:integrationId/adjust` - Adjust rate limit

**Frontend Component:** `RateLimitMonitor` (`frontend/src/components/monitoring/RateLimitMonitor.tsx`)

**Configuration:**
```typescript
// Configure rate limit
await fetch('/api/rate-limit/configure', {
  method: 'POST',
  body: JSON.stringify({
    integrationId: 'salesforce-api',
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    burstLimit: 10
  })
});
```

---

### 4. Offline Dashboard Mode 📱

**Location:** `frontend/public/sw.ts` & `frontend/src/hooks/`

**Features:**
- Progressive Web App (PWA) with full offline functionality
- Local data caching with IndexedDB (via localforage)
- Background sync when connectivity returns
- Conflict resolution strategies
- Service Worker with:
  - Cache-first for static assets
  - Network-first for API calls
  - Stale-while-revalidate for pages

**Hooks:**
- `useOfflineSync()` - Manage sync state and queue requests
- `useOfflineStorage<T>()` - Local data persistence

**Frontend Components:**
- `OfflineIndicator` - Shows connection status and pending sync count

**Service Worker Features:**
- Automatic caching of API responses
- Background sync registration
- Push notification support
- Periodic background sync

**Usage:**
```typescript
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

function MyComponent() {
  const { isOnline, pendingSync, sync, queueRequest } = useOfflineSync();
  const { data, save } = useOfflineStorage('my-dashboard', 'dashboards');

  // Save data locally
  await save(dashboardData);

  // Queue request for background sync
  await queueRequest('/api/dashboards', {
    method: 'POST',
    body: JSON.stringify(dashboardData)
  });
}
```

---

### 5. Voice-Activated Dashboard Control 🎤

**Location:** 
- Backend: `backend-nest/src/voice-control/`
- Frontend: `frontend/src/hooks/useVoiceControl.ts`, `frontend/src/components/voice/VoiceControlPanel.tsx`

**Features:**
- Web Speech API integration
- Natural language command processing
- Intent recognition with regex patterns
- Voice feedback (Text-to-Speech)
- Command history tracking
- Support for:
  - Navigation ("Go to dashboard")
  - Display ("Show me project X status")
  - Creation ("Create alert for budget overruns")
  - Reports ("Generate weekly report")
  - Filtering ("Show projects by priority")

**Supported Commands:**
- "Show me project X status" → Navigate to project
- "Create alert for budget overruns" → Open alert creation
- "Generate weekly report" → Create report
- "Go to analytics" → Navigate to analytics page
- "Show dashboard overview" → Display dashboard

**API Endpoints:**
- `POST /api/voice/command` - Process voice command
- `GET /api/voice/history` - Get command history

**Frontend Component:** `VoiceControlPanel` (`frontend/src/components/voice/VoiceControlPanel.tsx`)

**Usage:**
```typescript
import { VoiceControlPanel } from '@/components/voice/VoiceControlPanel';

<VoiceControlPanel 
  workspaceId={workspaceId}
  onCommand={(result) => {
    // Handle command result
    console.log(result.action, result.data);
  }}
/>
```

---

## Installation

### Backend Dependencies

```bash
cd backend-nest
npm install @nestjs/schedule bull @nestjs/bull localforage
```

### Frontend Dependencies

```bash
cd frontend
npm install localforage
```

### Database Migration

```bash
cd backend-nest
npx prisma migrate deploy
# Or manually run: prisma/migrations/20241208000001_enterprise_features/migration.sql
```

### Environment Variables

Add to `backend-nest/.env`:
```env
# Backup Configuration
BACKUP_ENCRYPTION_KEY=your-32-byte-encryption-key-here
BACKUP_RETENTION_DAYS=30

# Redis for Bull Queue (Rate Limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password
```

---

## Frontend Integration

Add to your main layout or dashboard:

```typescript
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';
import { VoiceControlPanel } from '@/components/voice/VoiceControlPanel';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <OfflineIndicator />
      <VoiceControlPanel workspaceId={workspaceId} />
    </>
  );
}
```

---

## Testing

### Test Voice Commands
1. Open the application
2. Click the microphone button
3. Say: "Show me dashboard overview"
4. System should navigate to dashboard and provide voice feedback

### Test Offline Mode
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try to interact with the dashboard
4. Data should be saved locally
5. Disable offline mode
6. Data should sync automatically

### Test Rate Limiting
1. Configure a rate limit for an integration
2. Queue multiple requests rapidly
3. Monitor the rate limit dashboard
4. Requests should be batched and queued appropriately

### Test Backups
1. Navigate to Backup Manager
2. Click "Create Backup"
3. Verify backup appears in the list
4. Test restore functionality (use with caution!)

---

## Performance Considerations

- **Backups:** Scheduled at 2 AM to minimize impact
- **Rate Limiting:** Uses Redis for fast queue operations
- **Offline Storage:** IndexedDB handles large datasets efficiently
- **Voice Control:** Processes locally, only sends text to server
- **Service Worker:** Caches strategically to minimize storage

---

## Security Notes

- Backups are encrypted with AES-256-GCM
- OAuth2 tokens are stored encrypted
- Rate limit prevents API abuse
- Voice commands are authenticated
- Service Worker only caches non-sensitive data

---

## Browser Compatibility

- **Voice Control:** Chrome, Edge, Safari (requires Web Speech API)
- **Offline Mode:** All modern browsers with Service Worker support
- **PWA:** Chrome, Edge, Safari on iOS 11.3+

---

## Troubleshooting

### Voice Control Not Working
- Ensure microphone permissions are granted
- Check browser compatibility (Chrome/Edge recommended)
- Verify HTTPS connection (required for Web Speech API)

### Offline Mode Not Syncing
- Check Service Worker registration in DevTools
- Verify network connectivity
- Check browser console for errors

### Rate Limiting Issues
- Ensure Redis is running
- Check Bull queue configuration
- Monitor queue stats endpoint

---

## Future Enhancements

- [ ] AI-powered voice command understanding
- [ ] Multi-language support for voice control
- [ ] Advanced conflict resolution strategies
- [ ] Backup encryption key rotation
- [ ] Integration marketplace for sharing custom integrations
- [ ] Real-time collaboration on offline changes
