import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../../packages/dweb-auth/src/**/*.test.ts',
      '../../packages/obscur-transport-engine/src/**/*.test.ts',
      '../../packages/obscur-dm-engine/src/**/*.test.ts',
      '../../packages/obscur-workspace-engine/src/**/*.test.ts',
      '../../packages/obscur-auth-engine/src/**/*.test.ts',
      '../../packages/obscur-engine-host/src/**/*.test.ts',
      '../../packages/obscur-conduit-mesh-contracts/src/**/*.test.ts',
      '../../packages/obscur-conduit-mesh/src/**/*.test.ts',
    ],
    pool: 'forks',
    maxWorkers: 1,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    server: {
      deps: {
        // Workspace ESM packages must not be loaded via CJS require() in hoisted mocks.
        inline: ['@dweb/core', '@dweb/core/profile-message-bus', '@dweb/auth', '@obscur/transport-engine', '@obscur/engine-contracts', '@obscur/dm-engine', '@obscur/engine-host', '@obscur/workspace-engine', '@obscur/auth-engine', '@obscur/conduit-mesh-contracts', '@obscur/conduit-mesh'],
      },
    },
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
      'app/features/messaging/utils/persistence.group-migration.test.ts',
      'app/features/invites/utils/__tests__/cross-platform-compatibility.test.ts',
      'app/features/invites/utils/__tests__/qr-generator.test.ts',
      'app/features/invites/utils/__tests__/system-e2e.test.ts',
      'app/features/crypto/__tests__/crypto-service.test.ts',
      'app/components/invites/__tests__/connection-list.test.tsx',
      'app/components/invites/__tests__/connection-import-export.test.tsx',
      'tests/e2e/**',
    ],
  },

  resolve: {
    alias: [
      {
        find: "@/app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter",
        replacement: resolve(
          __dirname,
          "./app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter.vitest.ts",
        ),
      },
      {
        find: "@",
        replacement: resolve(__dirname, "./"),
      },
    ],
  },
});
