import { defineConfig } from 'vitest/config';

// Own config so vitest doesn't walk up to the app's (jsdom + app setup file).
// Unit tests only: evals/ calls the real API and runs via `npm run eval`.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
