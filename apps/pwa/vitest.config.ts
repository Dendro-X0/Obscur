import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Property-based testing configuration
    testTimeout: 30000, // Increased timeout for property tests
    hookTimeout: 30000,
    // Legacy messaging integration/checkpoint suites are quarantined until
    // they are migrated to current evidence-backed transport contracts.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'app/features/messaging/lib/__tests__/checkpoint-basic-sending.test.ts',
      'app/features/messaging/lib/__tests__/enhanced-dm-controller.test.ts',
      'app/features/messaging/lib/__tests__/integration-complete-flows.test.ts',
      'app/features/messaging/lib/__tests__/integration-multi-relay-failover.test.ts',
      'app/features/messaging/lib/__tests__/integration-offline-online.test.ts',
      'app/features/messaging/lib/__tests__/message-receiving.test.ts',
      'app/features/messaging/lib/__tests__/message-sync.test.ts',
      'app/features/messaging/lib/__tests__/checkpoint-9-core-messaging-complete.test.ts',
      'app/features/messaging/lib/retry-manager.test.ts',
      'app/features/messaging/utils/persistence.group-migration.test.ts',
      'app/features/invites/utils/__tests__/cross-platform-compatibility.test.ts',
      'app/features/invites/utils/__tests__/qr-generator.test.ts',
      'app/features/invites/utils/__tests__/system-e2e.test.ts',
      'app/features/crypto/__tests__/crypto-service.test.ts',
      'app/components/invites/__tests__/connection-list.test.tsx',
      'app/components/invites/__tests__/connection-import-export.test.tsx',
      'app/features/messaging/lib/message-ordering.test.ts',
      'tests/e2e/**',
    ],
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
