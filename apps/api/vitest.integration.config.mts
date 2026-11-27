import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api-integration',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'api-integration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    globalSetup: ['src/database/testing/global-setup.ts'],
    // Scenarios share one database, so files must not run in parallel.
    fileParallelism: false,
    reporters: ['default'],
  },
}));
