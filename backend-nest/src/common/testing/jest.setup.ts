/**
 * =============================================================================
 * REAL-TIME PULSE - JEST SETUP
 * =============================================================================
 *
 * Global Jest configuration and setup for all tests.
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test utilities
beforeAll(() => {
  // Set up any global test state
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
});

afterAll(() => {
  // Clean up global state
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  /**
   * Check if a value is a valid UUID
   */
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
      pass,
    };
  },

  /**
   * Check if a date is within a range of another date
   */
  toBeWithinRange(received: Date, expected: Date, rangeMs: number) {
    const diff = Math.abs(received.getTime() - expected.getTime());
    const pass = diff <= rangeMs;

    return {
      message: () =>
        pass
          ? `expected ${received.toISOString()} not to be within ${rangeMs}ms of ${expected.toISOString()}`
          : `expected ${received.toISOString()} to be within ${rangeMs}ms of ${expected.toISOString()}, but diff was ${diff}ms`,
      pass,
    };
  },

  /**
   * Check if an object has specific keys
   */
  toHaveKeys(received: Record<string, unknown>, keys: string[]) {
    const receivedKeys = Object.keys(received);
    const missingKeys = keys.filter((key) => !receivedKeys.includes(key));
    const pass = missingKeys.length === 0;

    return {
      message: () =>
        pass
          ? `expected object not to have keys: ${keys.join(', ')}`
          : `expected object to have keys: ${missingKeys.join(', ')}`,
      pass,
    };
  },
});

// Extend Jest types for custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(expected: Date, rangeMs: number): R;
      toHaveKeys(keys: string[]): R;
    }
  }
}
