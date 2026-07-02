import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially so integration tests don't share server state
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Give integration tests plenty of time
    testTimeout: 15000,
    hookTimeout: 10000,
    // Print verbose output for CI
    reporter: ['verbose'],
    // Treat files as ESM (matches "type": "module" in package.json)
    environment: 'node',
  },
});
