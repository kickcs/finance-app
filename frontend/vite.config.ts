import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { compression } from 'vite-plugin-compression2';
import VueDevTools from 'vite-plugin-vue-devtools';
import { VitePWA } from 'vite-plugin-pwa';
import {
  appShellManifestTransform,
  appShellPrecachePlugin,
} from './src/app/plugins/appShellPrecachePlugin';
import { fontPreloadPlugin } from './src/app/plugins/fontPreloadPlugin';
import { inlineLoaderIconPlugin } from './src/app/plugins/inlineLoaderIconPlugin';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    fontPreloadPlugin(),
    inlineLoaderIconPlugin(),
    appShellPrecachePlugin(),
    tailwindcss(),
    VueDevTools(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: true },
      // Иконки манифеста (logo-512.png — 416 КБ) в precache не нужны: их берёт
      // система при установке, а runtime-правило app-icons кэширует по факту
      includeManifestIcons: false,
      workbox: {
        importScripts: ['/push-sw.js'],
        // Глобы задают лишь пул кандидатов — окончательный отбор оболочки делает
        // manifestTransforms по реальному графу импортов входного чанка
        manifestTransforms: [appShellManifestTransform],
        // Precache = только оболочка приложения (то, без чего не покажется первый
        // экран). Раньше сюда попадал весь dist — 169 записей, включая чанки всех
        // страниц и logo-512.png: воркер начинал качать это сразу после load и
        // отнимал канал у самой загрузки. Остальное подтягивается runtime-кэшом.
        globPatterns: [
          'index.html',
          'index-*.js',
          // Все каталоги, куда chunkFileNames может положить чанк: отбор всё
          // равно делает manifestTransform по графу импортов входного чанка, а
          // узкий пул молча выбросил бы из оболочки чанк, уехавший, например,
          // в entities/ — офлайн-старт бы сломался без единого предупреждения
          '{chunks,pages,widgets,entities}/*.js',
          'css/*.css',
          'fonts/*.woff2',
          'favicon.svg',
          'logo-192.webp',
        ],
        // HEIC-конвертер (~3 МБ wasm-чанк) грузится лениво только при встрече
        // HEIC-файла — в precache каждого пользователя ему не место
        globIgnores: ['**/heic-to-*.js'],
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
          {
            // Всё, что осталось за пределами оболочки: чанки страниц и общие
            // чанки с их CSS. Имена хешированы и раздаются как immutable,
            // поэтому CacheFirst безопасен — после первого захода страница
            // открывается офлайн и без обращения к сети.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/(pages|widgets|entities|chunks|css)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'route-chunks',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Иконки и сплэши: нужны установленному PWA, но не первой отрисовке
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/(splash\/|logo-)/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-icons',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
    // Только gzip: nginx раздаёт эти файлы через gzip_static, а brotli-модуля
    // нет ни в nginx:alpine, ни на хостовом nginx — .br лежали бы мёртвым грузом
    compression({ algorithms: ['gzip'] }),
  ],
  server: {
    host: 'localhost',
    port: 5173,
  },
  resolve: {
    alias: {
      // Файлы Inter для src/app/styles/fonts.css: подключаем только нужные
      // сабсеты, минуя index.css пакета, который объявляет все семь
      '@fontfiles': fileURLToPath(
        new URL('./node_modules/@fontsource-variable/inter/files', import.meta.url),
      ),
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
    // Target modern browsers for smaller bundles
    target: 'es2020',
    rolldownOptions: {
      output: {
        // Вручную группируем только то, что нужно каждой странице без исключения.
        //
        // reka-ui, @vueuse/core и @tanstack/vue-virtual раньше тоже были склеены
        // в два больших чанка (~380 КБ) — из-за этого примитивы, нужные одной
        // ленивой странице, ехали в бандле первой отрисовки. Без ручного правила
        // сборщик сам выносит общие модули в разделяемые чанки и грузит их
        // только вместе со страницей, которой они понадобились.
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router/')) {
            return 'vue-core';
          }
          if (id.includes('node_modules/@tanstack/vue-query/')) {
            return 'vue-query';
          }
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
