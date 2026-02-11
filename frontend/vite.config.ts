import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
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
          'tanstack': ['@tanstack/vue-query', '@tanstack/vue-virtual'],
          // UI primitives - Reka UI components
          'ui-primitives': ['reka-ui'],
          // VueUse utilities
          'vueuse': ['@vueuse/core'],
        },
        // Optimize chunk file naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId || ''
          // Page chunks
          if (facadeModuleId.includes('/pages/')) {
            return 'pages/[name]-[hash].js'
          }
          // Widget chunks
          if (facadeModuleId.includes('/widgets/')) {
            return 'widgets/[name]-[hash].js'
          }
          // Entity chunks
          if (facadeModuleId.includes('/entities/')) {
            return 'entities/[name]-[hash].js'
          }
          // Default for vendor and other chunks
          return 'chunks/[name]-[hash].js'
        },
        // Entry file naming
        entryFileNames: '[name]-[hash].js',
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          // CSS files
          if (name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]'
          }
          // Font files
          if (/\.(woff2?|ttf|eot|otf)$/.test(name)) {
            return 'fonts/[name]-[hash][extname]'
          }
          // Image files
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return 'images/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      '@tanstack/vue-query',
      '@vueuse/core',
    ],
  },
})
