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
  // Served from a GitHub Pages PROJECT site at /WorkOutAppRefactor/. All asset
  // URLs, the router basename, and the runtime exercises.json fetch derive from
  // this (via import.meta.env.BASE_URL). A root deploy (custom domain / Firebase
  // Hosting) would set this back to '/'.
  base: '/WorkOutAppRefactor/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Strip console.* and debugger statements from production builds only.
  // Source keeps console.* calls intact for readability; esbuild drops them
  // at build time, so `vite build` ships a clean bundle while dev is unchanged.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor code into dedicated chunks so the
        // main app chunk shrinks and vendors stay cached across app deploys.
        // Firebase (firestore/auth/app) is by far the largest dependency, so it
        // gets its own chunk; the rest are grouped by ownership.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/]firebase[\\/]/.test(id) ||
              /[\\/]node_modules[\\/]@firebase[\\/]/.test(id)) {
            return 'vendor-firebase'
          }
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) {
            return 'vendor-radix'
          }
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
            return 'vendor-motion'
          }
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        // NOTE: `json` is intentionally excluded from globPatterns. The 2 MB
        // public/exercises.json must NOT be precached upfront (it dominated the
        // precache manifest). manifest.webmanifest is emitted by the plugin as
        // a separate precache entry regardless of globPatterns, so dropping
        // `json` here does not affect the web manifest. exercises.json is
        // instead fetched on demand and cached via the runtimeCaching rule below.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/WorkOutAppRefactor/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // exercises.json (~2 MB) is fetched lazily on first Directory/Build/
            // Profile use rather than precached. StaleWhileRevalidate serves the
            // cached copy instantly after the first load and refreshes in the
            // background, so updated builds are picked up without blocking.
            urlPattern: /\/exercises\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exercises-data-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
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
            // Exercise videos load directly from the MuscleWiki CDN in both dev
            // and prod (the old /api/video dev proxy was removed — Cloudflare
            // 403-blocks Node's TLS fingerprint; a real browser loads fine).
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
            src: '/WorkOutAppRefactor/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/WorkOutAppRefactor/icon-512.png',
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
    // No /api/video proxy: exercise videos load directly from the MuscleWiki
    // CDN. The former dev proxy routed through Node's HTTPS stack, whose TLS
    // fingerprint Cloudflare 403-blocks regardless of headers; the browser
    // loads the same URLs directly without issue (and prod never used a proxy).
  }
  }
})