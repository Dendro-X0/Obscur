import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Property-based testing configuration
    testTimeout: 30000, // Increased timeout for property tests
    hookTimeout: 30000,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});