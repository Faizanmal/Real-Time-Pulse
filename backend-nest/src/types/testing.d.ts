declare module 'common/testing/test-utils' {
  export function createMockPrismaService(): any;
  export function createMockJwtService(): any;
  export function createMockConfigService(overrides?: Record<string, unknown>): any;
  export function createMockRedisService(): any;
  export function createTestUser(overrides?: any): any;
  export function createTestWorkspace(overrides?: any): any;
  // Fallback re-export
  export * from '../common/testing/test-utils';
}
