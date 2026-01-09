/**
 * MSW Server Setup for Frontend Tests
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
