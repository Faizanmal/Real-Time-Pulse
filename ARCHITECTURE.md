# 🏗️ REAL-TIME PULSE - TECHNICAL ARCHITECTURE DOCUMENT

## Version 2.0.0 | Enterprise Edition

---

## 📋 Document Overview

This document provides comprehensive technical architecture documentation for Real-Time Pulse, an enterprise-grade real-time analytics platform.

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Web App   │  │ Mobile App  │  │   Embed     │  │   CLI Tool  │       │
│  │  (Next.js)  │  │   (React    │  │   Widget    │  │   (Node)    │       │
│  │             │  │   Native)   │  │             │  │             │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY LAYER                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Kong / AWS API Gateway                          │  │
│  │  • Rate Limiting  • Authentication  • Load Balancing  • SSL/TLS       │  │
│  │  • Request Routing  • API Versioning  • Analytics  • Caching          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REST API      │    │   GraphQL API   │    │  WebSocket API  │
│   /api/v1/*     │    │   /graphql      │    │   /ws           │
│                 │    │                 │    │                 │
│  • CRUD Ops     │    │  • Queries      │    │  • Real-time    │
│  • Auth         │    │  • Mutations    │    │  • Streaming    │
│  • Uploads      │    │  • Subscriptions│    │  • Events       │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NestJS Application Core                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │  Guards  │ │ Intercep │ │  Pipes   │ │ Filters  │ │Decorators│ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Service Modules                               │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │  │  Auth   │ │ Portal  │ │ Widget  │ │Analytics│ │  Alert  │      │   │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │ │ Module  │      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │  │   AI    │ │ Integr- │ │  Jobs   │ │ Notific │ │ Billing │      │   │
│  │  │ Module  │ │  ation  │ │ Module  │ │ Module  │ │ Module  │      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN LAYER (CQRS)                                │
│  ┌────────────────────────────┐    ┌────────────────────────────────┐      │
│  │      COMMAND SIDE          │    │         QUERY SIDE              │      │
│  │  ┌──────────────────────┐  │    │  ┌──────────────────────────┐  │      │
│  │  │  Command Handlers    │  │    │  │    Query Handlers        │  │      │
│  │  │  • CreatePortal      │  │    │  │    • GetPortal           │  │      │
│  │  │  • UpdateWidget      │  │    │  │    • ListWidgets         │  │      │
│  │  │  • TriggerAlert      │  │    │  │    • GetAnalytics        │  │      │
│  │  └──────────────────────┘  │    │  └──────────────────────────┘  │      │
│  │  ┌──────────────────────┐  │    │  ┌──────────────────────────┐  │      │
│  │  │    Aggregates        │  │    │  │    Read Models           │  │      │
│  │  │  • PortalAggregate   │  │    │  │    • PortalView          │  │      │
│  │  │  • UserAggregate     │  │    │  │    • DashboardView       │  │      │
│  │  └──────────────────────┘  │    │  └──────────────────────────┘  │      │
│  └────────────────────────────┘    └────────────────────────────────┘      │
│                    │                              ▲                          │
│                    ▼                              │                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      EVENT STORE                                      │   │
│  │  • Domain Events  • Event Versioning  • Snapshots  • Projections    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ PostgreSQL  │  │    Redis    │  │ ClickHouse  │  │    S3       │       │
│  │   (OLTP)    │  │   (Cache)   │  │   (OLAP)    │  │  (Storage)  │       │
│  │             │  │             │  │             │  │             │       │
│  │ • Users     │  │ • Sessions  │  │ • Metrics   │  │ • Files     │       │
│  │ • Portals   │  │ • Cache     │  │ • Logs      │  │ • Exports   │       │
│  │ • Widgets   │  │ • Pub/Sub   │  │ • Analytics │  │ • Backups   │       │
│  │ • Alerts    │  │ • Queues    │  │ • Time-     │  │             │       │
│  │ • Events    │  │             │  │   series    │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │Elasticsearch│  │   Kafka     │  │   MinIO     │                        │
│  │  (Search)   │  │  (Events)   │  │ (Local S3)  │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW EXAMPLE                          │
│                  (Create Dashboard Widget)                       │
└─────────────────────────────────────────────────────────────────┘

Client                API Gateway           NestJS              Database
  │                       │                   │                    │
  │  POST /widgets        │                   │                    │
  │──────────────────────▶│                   │                    │
  │                       │  Validate JWT     │                    │
  │                       │  Rate Limit Check │                    │
  │                       │  Route Request    │                    │
  │                       │──────────────────▶│                    │
  │                       │                   │  ValidationPipe    │
  │                       │                   │  AuthGuard         │
  │                       │                   │  PermissionGuard   │
  │                       │                   │                    │
  │                       │                   │  WidgetController  │
  │                       │                   │  WidgetService     │
  │                       │                   │                    │
  │                       │                   │  CreateWidgetCmd   │
  │                       │                   │──────────────────▶│
  │                       │                   │                   ││
  │                       │                   │   Prisma Create   ││
  │                       │                   │◀──────────────────││
  │                       │                   │                    │
  │                       │                   │  WidgetCreated     │
  │                       │                   │     Event          │
  │                       │                   │───────────────────▶│ Event Store
  │                       │                   │                    │
  │                       │  201 Created      │                    │
  │                       │◀──────────────────│                    │
  │  { id: "widget_123" } │                   │                    │
  │◀──────────────────────│                   │                    │
  │                       │                   │                    │

```

---

## 2. Module Architecture

### 2.1 Core Modules

```
backend-nest/src/
├── app.module.ts              # Root module
├── main.ts                    # Application bootstrap
│
├── auth/                      # Authentication & Authorization
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   ├── local.strategy.ts
│   │   └── oauth.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── permissions.guard.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── permissions.decorator.ts
│
├── portals/                   # Portal Management
│   ├── portals.module.ts
│   ├── portals.controller.ts
│   ├── portals.service.ts
│   ├── dto/
│   │   ├── create-portal.dto.ts
│   │   └── update-portal.dto.ts
│   └── entities/
│       └── portal.entity.ts
│
├── widgets/                   # Widget Management
│   ├── widgets.module.ts
│   ├── widgets.controller.ts
│   ├── widgets.service.ts
│   ├── widget-types/
│   │   ├── chart.widget.ts
│   │   ├── metric.widget.ts
│   │   └── table.widget.ts
│   └── dto/
│
├── analytics/                 # Analytics Engine
│   ├── analytics.module.ts
│   ├── analytics.controller.ts
│   ├── analytics.engine.ts
│   ├── aggregations/
│   │   ├── time-series.aggregator.ts
│   │   └── metric.aggregator.ts
│   └── trend-analysis/
│       ├── trend.detector.ts
│       └── anomaly.detector.ts
│
├── alerts/                    # Alert System
│   ├── alerts.module.ts
│   ├── alerts.controller.ts
│   ├── alerts.service.ts
│   ├── evaluators/
│   │   ├── threshold.evaluator.ts
│   │   ├── trend.evaluator.ts
│   │   └── anomaly.evaluator.ts
│   └── channels/
│       ├── email.channel.ts
│       ├── slack.channel.ts
│       └── pagerduty.channel.ts
│
├── ai-insights/               # AI Services
│   ├── ai-insights.module.ts
│   ├── ai.service.ts
│   ├── providers/
│   │   ├── openai.provider.ts
│   │   ├── anthropic.provider.ts
│   │   └── local.provider.ts
│   └── prompts/
│       ├── insight.prompt.ts
│       └── query.prompt.ts
│
├── integrations/              # External Integrations
│   ├── integrations.module.ts
│   ├── connectors/
│   │   ├── database.connector.ts
│   │   ├── api.connector.ts
│   │   └── file.connector.ts
│   └── transformers/
│       └── data.transformer.ts
│
├── notifications/             # Notification System
│   ├── notifications.module.ts
│   ├── notification.service.ts
│   └── channels/
│       ├── email.service.ts
│       ├── push.service.ts
│       └── sms.service.ts
│
├── jobs/                      # Background Jobs
│   ├── jobs.module.ts
│   ├── processors/
│   │   ├── report.processor.ts
│   │   ├── export.processor.ts
│   │   └── cleanup.processor.ts
│   └── schedulers/
│       └── cron.scheduler.ts
│
├── realtime/                  # WebSocket Gateway
│   ├── realtime.module.ts
│   ├── realtime.gateway.ts
│   └── rooms/
│       ├── portal.room.ts
│       └── workspace.room.ts
│
├── common/                    # Shared Utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── observability.service.ts
│   └── security.service.ts
│
└── config/                    # Configuration
    ├── app.config.ts
    ├── database.config.ts
    ├── redis.config.ts
    └── ai.config.ts
```

### 2.2 Frontend Architecture

```
frontend/src/
├── app/                       # Next.js App Router
│   ├── (auth)/               # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   │
│   ├── (dashboard)/          # Main app route group
│   │   ├── layout.tsx        # Dashboard layout
│   │   ├── page.tsx          # Dashboard home
│   │   ├── portals/
│   │   │   ├── page.tsx      # Portal list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx  # Portal view
│   │   │   │   └── edit/
│   │   │   └── new/
│   │   ├── alerts/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── api/                  # API routes
│   │   ├── auth/
│   │   └── webhooks/
│   │
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
│
├── components/
│   ├── ui/                   # Base UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ... (65+ components)
│   │
│   ├── dashboard/            # Dashboard components
│   │   ├── analytics-card.tsx
│   │   ├── RealTimeMetricsPanel.tsx
│   │   ├── AdvancedChartPanel.tsx
│   │   ├── CommandPalette.tsx
│   │   └── WidgetGrid.tsx
│   │
│   ├── charts/               # Chart components
│   │   ├── LineChart.tsx
│   │   ├── BarChart.tsx
│   │   ├── PieChart.tsx
│   │   └── ... (15+ charts)
│   │
│   ├── layout/               # Layout components
│   │   ├── NavigationLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   │
│   └── providers/            # Context providers
│       ├── Providers.tsx
│       ├── QueryProvider.tsx
│       ├── ThemeProvider.tsx
│       └── SocketProvider.tsx
│
├── hooks/                    # Custom hooks
│   ├── useSocket.ts
│   ├── usePortal.ts
│   ├── useWidgets.ts
│   ├── useAuth.ts
│   └── ... (20+ hooks)
│
├── lib/                      # Utilities
│   ├── api.ts               # API client
│   ├── config.ts            # App config
│   ├── hooks.ts             # Utility hooks
│   └── utils.ts             # Helper functions
│
├── store/                    # State management
│   ├── authStore.ts
│   ├── portalStore.ts
│   ├── widgetStore.ts
│   └── uiStore.ts
│
├── types/                    # TypeScript types
│   ├── api.ts
│   ├── portal.ts
│   ├── widget.ts
│   └── user.ts
│
└── constants/                # Constants
    ├── routes.ts
    └── config.ts
```

---

## 3. Data Architecture

### 3.1 Database Schema (Prisma)

```prisma
// Core Entities

model User {
  id              String        @id @default(cuid())
  email           String        @unique
  passwordHash    String?
  name            String?
  avatar          String?
  role            Role          @default(VIEWER)
  status          UserStatus    @default(ACTIVE)
  
  // Relations
  workspaces      WorkspaceMember[]
  portals         Portal[]
  alerts          Alert[]
  sessions        Session[]
  apiKeys         ApiKey[]
  
  // Metadata
  lastLoginAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  @@index([email])
  @@index([status])
}

model Workspace {
  id              String        @id @default(cuid())
  name            String
  slug            String        @unique
  domain          String?
  settings        Json          @default("{}")
  
  // Subscription
  plan            Plan          @default(FREE)
  stripeCustomerId String?
  stripeSubscriptionId String?
  
  // Relations
  members         WorkspaceMember[]
  portals         Portal[]
  dataSources     DataSource[]
  alerts          Alert[]
  integrations    Integration[]
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  @@index([slug])
}

model Portal {
  id              String        @id @default(cuid())
  name            String
  description     String?
  slug            String
  isPublic        Boolean       @default(false)
  shareToken      String?       @unique
  
  // Layout
  layout          Json          @default("{}")
  theme           Json          @default("{}")
  
  // Relations
  workspaceId     String
  workspace       Workspace     @relation(fields: [workspaceId], references: [id])
  ownerId         String
  owner           User          @relation(fields: [ownerId], references: [id])
  widgets         Widget[]
  
  // Analytics
  viewCount       Int           @default(0)
  lastViewedAt    DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  @@unique([workspaceId, slug])
  @@index([workspaceId])
  @@index([ownerId])
}

model Widget {
  id              String        @id @default(cuid())
  type            WidgetType
  title           String
  description     String?
  
  // Configuration
  config          Json          @default("{}")
  dataConfig      Json          @default("{}")
  styling         Json          @default("{}")
  
  // Position
  position        Json          @default("{\"x\":0,\"y\":0,\"w\":4,\"h\":3}")
  
  // Relations
  portalId        String
  portal          Portal        @relation(fields: [portalId], references: [id], onDelete: Cascade)
  dataSourceId    String?
  dataSource      DataSource?   @relation(fields: [dataSourceId], references: [id])
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([portalId])
  @@index([dataSourceId])
}

model DataSource {
  id              String        @id @default(cuid())
  name            String
  type            DataSourceType
  connectionConfig Json         // Encrypted
  status          DataSourceStatus @default(PENDING)
  
  // Sync settings
  syncEnabled     Boolean       @default(false)
  syncInterval    Int?          // minutes
  lastSyncAt      DateTime?
  lastSyncStatus  String?
  
  // Relations
  workspaceId     String
  workspace       Workspace     @relation(fields: [workspaceId], references: [id])
  widgets         Widget[]
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([workspaceId])
}

model Alert {
  id              String        @id @default(cuid())
  name            String
  description     String?
  enabled         Boolean       @default(true)
  
  // Condition
  condition       Json          // { metric, operator, threshold }
  evaluationPeriod Int          @default(5) // minutes
  
  // Channels
  channels        Json          @default("[]") // ["email", "slack"]
  recipients      Json          @default("[]")
  
  // State
  status          AlertStatus   @default(OK)
  lastTriggeredAt DateTime?
  lastCheckedAt   DateTime?
  
  // Relations
  workspaceId     String
  workspace       Workspace     @relation(fields: [workspaceId], references: [id])
  createdById     String
  createdBy       User          @relation(fields: [createdById], references: [id])
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([workspaceId])
  @@index([status])
}

// Event Sourcing
model Event {
  id              String        @id @default(cuid())
  aggregateId     String
  aggregateType   String
  eventType       String
  version         Int
  data            Json
  metadata        Json          @default("{}")
  
  createdAt       DateTime      @default(now())

  @@index([aggregateId])
  @@index([aggregateType, aggregateId])
  @@unique([aggregateId, version])
}

// Enums
enum Role {
  VIEWER
  EDITOR
  ADMIN
  OWNER
}

enum Plan {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum WidgetType {
  LINE_CHART
  BAR_CHART
  AREA_CHART
  PIE_CHART
  METRIC_CARD
  TABLE
  HEATMAP
  GAUGE
  TEXT
  IMAGE
}

enum DataSourceType {
  POSTGRESQL
  MYSQL
  MONGODB
  REST_API
  GRAPHQL
  CSV
  EXCEL
  GOOGLE_SHEETS
}

enum AlertStatus {
  OK
  PENDING
  TRIGGERED
  RESOLVED
}
```

### 3.2 Redis Data Structures

```typescript
// Session Storage
// Key: session:{sessionId}
// Type: Hash
{
  userId: string;
  workspaceId: string;
  role: string;
  expiresAt: string;
  metadata: string; // JSON
}

// Cache Patterns
// Key: cache:{entityType}:{entityId}
// Type: String (JSON)
// TTL: 300s (5 minutes)

// Rate Limiting
// Key: ratelimit:{userId}:{endpoint}
// Type: String (counter)
// TTL: 60s

// Real-time Presence
// Key: presence:{workspaceId}
// Type: Set
// Members: userId[]

// Pub/Sub Channels
// Channel: metrics:{portalId}
// Channel: alerts:{workspaceId}
// Channel: notifications:{userId}

// Job Queues (BullMQ)
// Queue: reports
// Queue: exports
// Queue: notifications
// Queue: data-sync
```

---

## 4. API Design

### 4.1 REST API Conventions

```typescript
// URL Structure
// /api/v1/{resource}
// /api/v1/{resource}/{id}
// /api/v1/{resource}/{id}/{sub-resource}

// HTTP Methods
// GET    - Read (list or single)
// POST   - Create
// PUT    - Full update
// PATCH  - Partial update
// DELETE - Remove

// Query Parameters
// ?page=1&limit=20           - Pagination
// ?sort=createdAt&order=desc - Sorting
// ?filter[status]=active     - Filtering
// ?include=widgets,owner     - Relationships
// ?fields=id,name,createdAt  - Sparse fieldsets

// Response Format
interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  links?: {
    self: string;
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

// Error Response
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
    requestId: string;
  };
}

// Status Codes
// 200 - OK
// 201 - Created
// 204 - No Content
// 400 - Bad Request
// 401 - Unauthorized
// 403 - Forbidden
// 404 - Not Found
// 409 - Conflict
// 422 - Unprocessable Entity
// 429 - Too Many Requests
// 500 - Internal Server Error
```

### 4.2 GraphQL Schema

```graphql
type Query {
  # User
  me: User!
  
  # Workspace
  workspace(id: ID!): Workspace
  workspaces: [Workspace!]!
  
  # Portal
  portal(id: ID!): Portal
  portals(
    workspaceId: ID!
    page: Int
    limit: Int
    filter: PortalFilter
  ): PortalConnection!
  
  # Widget
  widget(id: ID!): Widget
  widgets(portalId: ID!): [Widget!]!
  
  # Analytics
  analytics(
    portalId: ID!
    metrics: [String!]!
    timeRange: TimeRangeInput!
    interval: Interval
  ): AnalyticsResult!
  
  # Alerts
  alerts(workspaceId: ID!, status: AlertStatus): [Alert!]!
}

type Mutation {
  # Auth
  login(email: String!, password: String!): AuthPayload!
  register(input: RegisterInput!): AuthPayload!
  refreshToken(token: String!): AuthPayload!
  
  # Portal
  createPortal(input: CreatePortalInput!): Portal!
  updatePortal(id: ID!, input: UpdatePortalInput!): Portal!
  deletePortal(id: ID!): Boolean!
  
  # Widget
  createWidget(input: CreateWidgetInput!): Widget!
  updateWidget(id: ID!, input: UpdateWidgetInput!): Widget!
  deleteWidget(id: ID!): Boolean!
  updateWidgetPositions(portalId: ID!, positions: [WidgetPositionInput!]!): [Widget!]!
  
  # Alert
  createAlert(input: CreateAlertInput!): Alert!
  updateAlert(id: ID!, input: UpdateAlertInput!): Alert!
  toggleAlert(id: ID!, enabled: Boolean!): Alert!
  deleteAlert(id: ID!): Boolean!
}

type Subscription {
  # Real-time metrics
  metricUpdated(portalId: ID!, widgetIds: [ID!]): MetricUpdate!
  
  # Alerts
  alertTriggered(workspaceId: ID!): Alert!
  
  # Presence
  userPresence(workspaceId: ID!): PresenceUpdate!
}

# Types
type Portal {
  id: ID!
  name: String!
  description: String
  slug: String!
  isPublic: Boolean!
  layout: JSON!
  theme: JSON!
  
  workspace: Workspace!
  owner: User!
  widgets: [Widget!]!
  
  viewCount: Int!
  lastViewedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Widget {
  id: ID!
  type: WidgetType!
  title: String!
  config: JSON!
  position: JSON!
  
  portal: Portal!
  dataSource: DataSource
  
  # Real-time data (resolved from subscription)
  data: JSON
  
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

     Client                    API                    Database
        │                       │                         │
        │  POST /auth/login     │                         │
        │  {email, password}    │                         │
        │──────────────────────▶│                         │
        │                       │  Validate credentials   │
        │                       │────────────────────────▶│
        │                       │◀────────────────────────│
        │                       │                         │
        │                       │  Generate tokens        │
        │                       │  • Access (15m)         │
        │                       │  • Refresh (7d)         │
        │                       │                         │
        │                       │  Store session          │
        │                       │  in Redis               │
        │                       │                         │
        │  {accessToken,        │                         │
        │   refreshToken}       │                         │
        │◀──────────────────────│                         │
        │                       │                         │
        │  Store refresh token  │                         │
        │  in httpOnly cookie   │                         │
        │                       │                         │

┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH FLOW                            │
└─────────────────────────────────────────────────────────────────┘

        │  POST /auth/refresh   │                         │
        │  Cookie: refresh_token│                         │
        │──────────────────────▶│                         │
        │                       │  Validate refresh token │
        │                       │  Check session in Redis │
        │                       │                         │
        │                       │  Generate new tokens    │
        │                       │  Rotate refresh token   │
        │                       │                         │
        │  {accessToken,        │                         │
        │   refreshToken}       │                         │
        │◀──────────────────────│                         │
```

### 5.2 Authorization Model

```typescript
// Permission-based access control
interface Permission {
  resource: string;  // 'portal', 'widget', 'alert', etc.
  action: string;    // 'create', 'read', 'update', 'delete'
  scope?: string;    // 'own', 'workspace', 'all'
}

// Role definitions
const roles = {
  VIEWER: [
    { resource: 'portal', action: 'read', scope: 'workspace' },
    { resource: 'widget', action: 'read', scope: 'workspace' },
    { resource: 'alert', action: 'read', scope: 'workspace' },
  ],
  EDITOR: [
    { resource: 'portal', action: '*', scope: 'own' },
    { resource: 'widget', action: '*', scope: 'workspace' },
    { resource: 'alert', action: '*', scope: 'own' },
  ],
  ADMIN: [
    { resource: '*', action: '*', scope: 'workspace' },
    { resource: 'user', action: 'manage', scope: 'workspace' },
  ],
  OWNER: [
    { resource: '*', action: '*', scope: 'all' },
  ],
};

// Guard implementation
@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );
    
    const user = context.switchToHttp().getRequest().user;
    const resource = this.getResource(context);
    
    return requiredPermissions.every(permission => 
      this.hasPermission(user, permission, resource)
    );
  }
}

// Usage
@Post()
@RequirePermissions({ resource: 'portal', action: 'create' })
async createPortal(@Body() dto: CreatePortalDto) {
  // ...
}
```

---

## 6. Deployment Architecture

### 6.1 Kubernetes Architecture

```yaml
# Production deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
        - name: api
          image: realtimepulse/api:latest
          ports:
            - containerPort: 3001
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3001
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.realtimepulse.io
      secretName: api-tls
  rules:
    - host: api.realtimepulse.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 6.2 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUD INFRASTRUCTURE                     │
│                           (AWS / GCP / Azure)                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CDN (CloudFront / CloudFlare)                                   │
│  • Static assets   • Edge caching   • DDoS protection            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│  Load Balancer (ALB / NLB)                                       │
│  • SSL termination   • Health checks   • Request routing         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    KUBERNETES CLUSTER                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Namespace: production                                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │   API       │  │   API       │  │   API       │        │ │
│  │  │   Pod 1     │  │   Pod 2     │  │   Pod 3     │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  │  ┌─────────────┐  ┌─────────────┐                          │ │
│  │  │  Frontend   │  │  Frontend   │                          │ │
│  │  │   Pod 1     │  │   Pod 2     │                          │ │
│  │  └─────────────┘  └─────────────┘                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │  WebSocket  │  │  Worker     │  │  Scheduler  │        │ │
│  │  │   Pod       │  │   Pod       │  │   Pod       │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                       DATA TIER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ PostgreSQL  │  │    Redis    │  │ ClickHouse  │             │
│  │ (Primary)   │  │  (Cluster)  │  │  (Cluster)  │             │
│  │     │       │  │             │  │             │             │
│  │ (Replica)   │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ Elasticsearch│ │     S3      │                               │
│  │  (3 nodes)  │  │  (Storage)  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Monitoring & Observability

### 7.1 Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

Application Layer
       │
       ├── Metrics ──────────▶ Prometheus ──────▶ Grafana
       │   (custom metrics,                       (dashboards,
       │    HTTP requests,                         alerts)
       │    system metrics)
       │
       ├── Traces ───────────▶ OpenTelemetry ───▶ Jaeger
       │   (distributed                           (trace
       │    tracing)                               visualization)
       │
       ├── Logs ─────────────▶ Fluentd ─────────▶ Elasticsearch
       │   (structured                             │
       │    JSON logs)                             ▼
       │                                        Kibana
       │                                        (log analysis)
       │
       └── Errors ───────────▶ Sentry
           (exceptions,        (error tracking,
            crashes)            alerting)
```

### 7.2 Key Metrics

```typescript
// Application Metrics
const metrics = {
  // HTTP Metrics
  http_request_duration_seconds: Histogram,
  http_requests_total: Counter,
  http_request_size_bytes: Histogram,
  http_response_size_bytes: Histogram,
  
  // WebSocket Metrics
  websocket_connections_active: Gauge,
  websocket_messages_total: Counter,
  websocket_message_duration_seconds: Histogram,
  
  // Business Metrics
  portals_created_total: Counter,
  widgets_created_total: Counter,
  alerts_triggered_total: Counter,
  
  // Database Metrics
  db_query_duration_seconds: Histogram,
  db_connections_active: Gauge,
  db_connections_pool_size: Gauge,
  
  // Cache Metrics
  cache_hits_total: Counter,
  cache_misses_total: Counter,
  cache_size_bytes: Gauge,
  
  // Job Queue Metrics
  job_queue_size: Gauge,
  job_processing_duration_seconds: Histogram,
  job_failures_total: Counter,
};
```

---

## 8. Performance Considerations

### 8.1 Caching Strategy

```typescript
// Multi-layer caching
const cachingLayers = {
  // L1: In-memory cache (per instance)
  memory: {
    ttl: '30s',
    maxSize: '100MB',
    use: 'Hot data, frequently accessed'
  },
  
  // L2: Redis cache (shared)
  redis: {
    ttl: '5m',
    patterns: {
      portal: 'cache:portal:{id}',
      widget: 'cache:widget:{id}',
      user: 'cache:user:{id}',
    },
    use: 'Shared data, moderate TTL'
  },
  
  // L3: CDN cache (edge)
  cdn: {
    ttl: '1h',
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'max-age=86400',
    },
    use: 'Static assets, public data'
  }
};

// Cache invalidation patterns
const invalidation = {
  // Write-through
  writeThrough: async (key, value) => {
    await redis.set(key, value);
    await database.update(value);
  },
  
  // Write-behind (async)
  writeBehind: async (key, value) => {
    await redis.set(key, value);
    queue.add('db-sync', { key, value });
  },
  
  // Event-driven
  eventDriven: () => {
    eventEmitter.on('portal.updated', (portal) => {
      redis.del(`cache:portal:${portal.id}`);
    });
  }
};
```

### 8.2 Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX idx_portals_workspace ON portals(workspace_id);
CREATE INDEX idx_portals_owner ON portals(owner_id);
CREATE INDEX idx_widgets_portal ON widgets(portal_id);
CREATE INDEX idx_alerts_workspace_status ON alerts(workspace_id, status);
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id);

-- Partial indexes
CREATE INDEX idx_active_alerts ON alerts(workspace_id) WHERE status = 'TRIGGERED';

-- Full-text search
CREATE INDEX idx_portals_search ON portals USING gin(to_tsvector('english', name || ' ' || description));

-- Query optimization patterns
-- Use EXPLAIN ANALYZE to verify
EXPLAIN ANALYZE
SELECT p.*, COUNT(w.id) as widget_count
FROM portals p
LEFT JOIN widgets w ON w.portal_id = p.id
WHERE p.workspace_id = $1
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT 20;
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

| Data Type | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| PostgreSQL | Hourly | 30 days | pg_dump + S3 |
| PostgreSQL | Daily | 1 year | Snapshot |
| Redis | Every 15min | 7 days | RDB + S3 |
| S3 files | Real-time | Forever | Cross-region replication |
| Event store | Real-time | Forever | Streaming to backup |

### 9.2 Recovery Procedures

```bash
# Database recovery
pg_restore -d realtimepulse -j 4 backup.dump

# Point-in-time recovery
pg_restore -d realtimepulse --target-time="2025-01-01 12:00:00"

# Event store replay
npm run events:replay --from="2025-01-01" --to="2025-01-02"
```

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|------|------------|
| Portal | A container for widgets forming a dashboard |
| Widget | A visual component displaying data |
| Data Source | External data connection |
| Workspace | Multi-tenant isolation boundary |
| Event Sourcing | Storing state changes as events |
| CQRS | Command Query Responsibility Segregation |

### 10.2 References

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs)
- [OpenTelemetry](https://opentelemetry.io/docs)

---

**Document Version**: 2.0.0  
**Last Updated**: January 2025  
**Maintainer**: Architecture Team
