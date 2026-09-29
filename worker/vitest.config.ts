import { defineConfig } from 'vitest/config';

// Own config so vitest doesn't walk up to the app's (jsdom + app setup file).
export default defineConfig({
  test: { environment: 'node' },
});
