import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Én worker: samme mongoose-forbindelse og seed-data deles af alle testfiler.
    // Selve DB-koblingen foregår i app'ens ensureConnected-middleware.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
