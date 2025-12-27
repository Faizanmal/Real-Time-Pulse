/**
 * MSW Browser Setup
 * 
 * Import this in your app's entry point to enable API mocking:
 * 
 * ```tsx
 * // In src/app/layout.tsx or similar
 * if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
 *   require('@/lib/mocks/browser');
 * }
 * ```
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Start the worker
if (typeof window !== 'undefined') {
  worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  }).then(() => {
    console.log('[MSW] Mock Service Worker started');
  }).catch((error) => {
    console.error('[MSW] Failed to start:', error);
  });
}
