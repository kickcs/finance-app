import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { compression } from 'vite-plugin-compression2';
import VueDevTools from 'vite-plugin-vue-devtools';
import { VitePWA } from 'vite-plugin-pwa';
import { fontPreloadPlugin } from './src/app/plugins/fontPreloadPlugin';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    fontPreloadPlugin(),
    tailwindcss(),
    VueDevTools(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/?api\/).*/],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.method === 'GET' && /\/api\/(?!auth\/)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      manifest: {
        name: 'Ouro Finance',
        short_name: 'Ouro',
        description:
          'Управляйте личными финансами: учёт доходов и расходов, мультивалютные счета, долги, цели и напоминания',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f59e0b',
        background_color: '#f8f9fa',
        icons: [
          { src: '/logo-192.webp', sizes: '192x192', type: 'image/webp', purpose: 'any maskable' },
          { src: '/logo-512.webp', sizes: '512x512', type: 'image/webp', purpose: 'any maskable' },
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress' }),
  ],
  server: {
    host: 'localhost',
    port: 5173,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@/widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '@/features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@/entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minification settings
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Vue core - changes rarely
          'vue-core': ['vue', 'vue-router'],
          // TanStack Query - changes rarely
          tanstack: ['@tanstack/vue-query', '@tanstack/vue-virtual'],
          // UI primitives - Reka UI (single vendor chunk for long-term caching)
          'ui-primitives': ['reka-ui'],
          // VueUse utilities
          vueuse: ['@vueuse/core'],
        },
        // Optimize chunk file naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId || '';
          // Page chunks
          if (facadeModuleId.includes('/pages/')) {
            return 'pages/[name]-[hash].js';
          }
          // Widget chunks
          if (facadeModuleId.includes('/widgets/')) {
            return 'widgets/[name]-[hash].js';
          }
          // Entity chunks
          if (facadeModuleId.includes('/entities/')) {
            return 'entities/[name]-[hash].js';
          }
          // Default for vendor and other chunks
          return 'chunks/[name]-[hash].js';
        },
        // Entry file naming
        entryFileNames: '[name]-[hash].js',
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          // CSS files
          if (name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          // Font files
          if (/\.(woff2?|ttf|eot|otf)$/.test(name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          // Image files
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return 'images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['vue', 'vue-router', '@tanstack/vue-query', '@vueuse/core'],
  },
});
