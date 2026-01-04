/**
 * =============================================================================
 * REAL-TIME PULSE - TEST UTILITIES & MOCKS
 * =============================================================================
 *
 * Comprehensive testing utilities for unit and integration tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create mock user data
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    name: 'Test User',
    workspaceId: 'workspace-123',
    role: 'MEMBER',
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock workspace data
 */
export function createMockWorkspace(
  overrides: Partial<MockWorkspace> = {},
): MockWorkspace {
  return {
    id: 'workspace-123',
    name: 'Test Workspace',
    slug: 'test-workspace',
    primaryColor: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock portal data
 */
export function createMockPortal(
  overrides: Partial<MockPortal> = {},
): MockPortal {
  return {
    id: 'portal-123',
    name: 'Test Portal',
    slug: 'test-portal',
    workspaceId: 'workspace-123',
    isPublic: false,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock widget data
 */
export function createMockWidget(
  overrides: Partial<MockWidget> = {},
): MockWidget {
  return {
    id: 'widget-123',
    title: 'Test Widget',
    type: 'METRIC',
    portalId: 'portal-123',
    position: 0,
    config: {},
    data: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock integration data
 */
export function createMockIntegration(
  overrides: Partial<MockIntegration> = {},
): MockIntegration {
  return {
    id: 'integration-123',
    provider: 'ASANA',
    workspaceId: 'workspace-123',
    accessToken: 'encrypted-token',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// SERVICE MOCKS
// ============================================================================

/**
 * Create mock Prisma service
 */
export function createMockPrismaService(): MockPrismaService {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    portal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    widget: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    integration: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    aIInsight: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    alert: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pushToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((fn: any) => fn()),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
}

/**
 * Create mock Config service
 */
export function createMockConfigService(
  overrides: Record<string, unknown> = {},
): Partial<ConfigService> {
  const config: Record<string, unknown> = {
    'app.port': 3000,
    'app.env': 'test',
    'jwt.secret': 'test-secret',
    'jwt.expiresIn': '1h',
    'redis.host': 'localhost',
    'redis.port': 6379,
    'redis.password': '',
    'redis.db': 0,
    'email.from': 'test@example.com',
    'twilio.accountSid': 'test-sid',
    'twilio.authToken': 'test-token',
    'twilio.phoneNumber': '+1234567890',
    'firebase.serverKey': 'test-key',
    'openai.apiKey': 'test-openai-key',
    'stripe.secretKey': 'test-stripe-key',
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => config[key]),
    getOrThrow: jest.fn((key: string) => {
      if (key in config) return config[key];
      throw new Error(`Config key ${key} not found`);
    }),
  };
}

/**
 * Create mock Cache service
 */
export function createMockCacheService(): MockCacheService {
  const cache = new Map<string, unknown>();

  return {
    get: jest.fn((key: string) => Promise.resolve(cache.get(key) || null)),
    set: jest.fn((key: string, value: unknown) => {
      cache.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      cache.delete(key);
      return Promise.resolve();
    }),
    getOrFetch: jest.fn(
      async (key: string, fetchFn: () => Promise<unknown>) => {
        if (cache.has(key)) return cache.get(key);
        const value = await fetchFn();
        cache.set(key, value);
        return value;
      },
    ),
    invalidatePattern: jest.fn(() => Promise.resolve()),
    getMetrics: jest.fn(() => ({
      hits: 0,
      misses: 0,
      staleHits: 0,
      revalidations: 0,
      invalidations: 0,
      errors: 0,
      avgFetchTime: 0,
      hitRate: 0,
    })),
    clear: () => cache.clear(),
  };
}

/**
 * Create mock Redis service
 */
export function createMockRedisService(): MockRedisService {
  const store = new Map<string, string>();

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    exists: jest.fn((key: string) => Promise.resolve(store.has(key))),
    getJSON: jest.fn((key: string) => {
      const value = store.get(key);
      return Promise.resolve(value ? JSON.parse(value) : null);
    }),
    setJSON: jest.fn((key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
      return Promise.resolve();
    }),
    invalidatePattern: jest.fn(() => Promise.resolve()),
    getClient: jest.fn(() => ({
      keys: jest.fn(() => Promise.resolve([])),
      del: jest.fn(() => Promise.resolve()),
      sadd: jest.fn(() => Promise.resolve()),
      smembers: jest.fn(() => Promise.resolve([])),
      publish: jest.fn(() => Promise.resolve()),
      subscribe: jest.fn(() => Promise.resolve()),
      duplicate: jest.fn(),
    })),
  };
}

/**
 * Create mock Event Emitter
 */
export function createMockEventEmitter(): Partial<EventEmitter2> {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

/**
 * Create mock JWT service
 */
export function createMockJwtService(): Partial<JwtService> {
  return {
    sign: jest.fn(() => 'mock-jwt-token'),
    signAsync: jest.fn(() => Promise.resolve('mock-jwt-token')),
    verify: jest.fn(() => ({
      userId: 'user-123',
      workspaceId: 'workspace-123',
    })) as any,
    verifyAsync: jest.fn(() =>
      Promise.resolve({ userId: 'user-123', workspaceId: 'workspace-123' }),
    ) as any,
    decode: jest.fn(() => ({
      userId: 'user-123',
      workspaceId: 'workspace-123',
    })) as any,
  };
}

/**
 * Create mock Email service
 */
export function createMockEmailService(): MockEmailService {
  return {
    sendEmail: jest.fn(() => Promise.resolve()),
    sendWelcomeEmail: jest.fn(() => Promise.resolve()),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
    sendVerificationEmail: jest.fn(() => Promise.resolve()),
    sendAlertEmail: jest.fn(() => Promise.resolve()),
    sendReportEmail: jest.fn(() => Promise.resolve()),
  };
}

/**
 * Create mock Notification service
 */
export function createMockNotificationService(): MockNotificationService {
  return {
    send: jest.fn(() => Promise.resolve()),
    sendEmail: jest.fn(() => Promise.resolve()),
    sendPush: jest.fn(() => Promise.resolve()),
    sendSMS: jest.fn(() => Promise.resolve()),
    sendSlack: jest.fn(() => Promise.resolve()),
    getUserPushTokens: jest.fn(() => Promise.resolve([])),
    getUserPhone: jest.fn(() => Promise.resolve(null)),
  };
}

// ============================================================================
// TEST MODULE BUILDER
// ============================================================================

/**
 * Build a test module with common providers
 */
export async function buildTestModule(
  options: TestModuleOptions = {},
): Promise<TestingModule> {
  const {
    providers = [],
    imports = [],
    controllers = [],
    mockPrisma = createMockPrismaService(),
    mockConfig = createMockConfigService(),
    mockCache = createMockCacheService(),
    mockEventEmitter = createMockEventEmitter(),
    mockJwt = createMockJwtService(),
  } = options;

  return Test.createTestingModule({
    imports: imports as any[],
    controllers: controllers as any[],
    providers: [
      ...(providers as any[]),
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ConfigService, useValue: mockConfig },
      { provide: 'CacheService', useValue: mockCache },
      { provide: EventEmitter2, useValue: mockEventEmitter },
      { provide: JwtService, useValue: mockJwt },
    ],
  }).compile();
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a function throws an error of a specific type
 */
export async function expectToThrow<T extends Error>(
  fn: () => Promise<unknown>,
  errorType?: new (...args: unknown[]) => T,
  message?: string | RegExp,
): Promise<void> {
  let error: Error | null = null;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  expect(error).not.toBeNull();

  if (errorType) {
    expect(error).toBeInstanceOf(errorType);
  }

  if (message) {
    if (typeof message === 'string') {
      expect(error?.message).toContain(message);
    } else {
      expect(error?.message).toMatch(message);
    }
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Mock date for consistent testing
 */
export function mockDate(date: Date | string): () => void {
  const RealDate = Date;
  const mockDateValue = new Date(date);

  global.Date = class extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(mockDateValue.getTime());
      } else {
        super(...(args as [string | number | Date]));
      }
    }

    static now(): number {
      return mockDateValue.getTime();
    }
  } as DateConstructor;

  return () => {
    global.Date = RealDate;
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  workspaceId: string;
  role: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockPortal {
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
  isPublic: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockWidget {
  id: string;
  title: string;
  type: string;
  portalId: string;
  position: number;
  config: Record<string, unknown>;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface MockIntegration {
  id: string;
  provider: string;
  workspaceId: string;
  accessToken: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockPrismaService {
  user: MockPrismaModel;
  workspace: MockPrismaModel;
  portal: MockPrismaModel;
  widget: MockPrismaModel;
  integration: MockPrismaModel;
  aIInsight: MockPrismaModel;
  alert: MockPrismaModel;
  auditLog: MockPrismaModel;
  pushToken: MockPrismaModel;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
}

interface MockPrismaModel {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete?: jest.Mock;
  count: jest.Mock;
}

interface MockCacheService {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  getOrFetch: jest.Mock;
  invalidatePattern: jest.Mock;
  getMetrics: jest.Mock;
  clear: () => void;
}

interface MockRedisService {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
  getJSON: jest.Mock;
  setJSON: jest.Mock;
  invalidatePattern: jest.Mock;
  getClient: jest.Mock;
}

interface MockEmailService {
  sendEmail: jest.Mock;
  sendWelcomeEmail: jest.Mock;
  sendPasswordResetEmail: jest.Mock;
  sendVerificationEmail: jest.Mock;
  sendAlertEmail: jest.Mock;
  sendReportEmail: jest.Mock;
}

interface MockNotificationService {
  send: jest.Mock;
  sendEmail: jest.Mock;
  sendPush: jest.Mock;
  sendSMS: jest.Mock;
  sendSlack: jest.Mock;
  getUserPushTokens: jest.Mock;
  getUserPhone: jest.Mock;
}

interface TestModuleOptions {
  providers?: unknown[];
  imports?: unknown[];
  controllers?: unknown[];
  mockPrisma?: MockPrismaService;
  mockConfig?: Partial<ConfigService>;
  mockCache?: MockCacheService;
  mockEventEmitter?: Partial<EventEmitter2>;
  mockJwt?: Partial<JwtService>;
}
