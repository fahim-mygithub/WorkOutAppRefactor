import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'

export default defineConfig(({ command, mode }) => {
  // Gate the bundle visualizer behind an explicit mode so normal builds are
  // unaffected. Enable via `vite build --mode analyze` (the `analyze` script).
  const analyze = mode === 'analyze'

  return {
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Strip console.* and debugger statements from production builds only.
  // Source keeps console.* calls intact for readability; esbuild drops them
  // at build time, so `vite build` ships a clean bundle while dev is unchanged.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              }
            },
          },
          {
            urlPattern: /^https:\/\/media\.musclewiki\.com\/.*\.mp4$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'exercise-videos-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^\/api\/video\/.*\.mp4$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'proxied-videos-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'Track your workouts and build strength',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    // Only emit the bundle treemap in `--mode analyze`; otherwise it is
    // omitted entirely so normal/CI builds are not slowed or altered.
    analyze &&
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // Proxy MuscleWiki video requests to avoid CORS issues in development
      '/api/video': {
        target: 'https://media.musclewiki.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/video/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
  }
})