import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// vite.config exports a callback (it branches on command/mode for esbuild
// console-drop + the analyze visualizer). Resolve it to a config object before
// merging — mergeConfig cannot merge a function-form config.
const resolvedViteConfig = viteConfig({ command: 'serve', mode: 'test' });

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: ['node_modules/**', 'src/test/**', '**/*.config.*', 'dist/**'],
      },
    },
  }),
);
