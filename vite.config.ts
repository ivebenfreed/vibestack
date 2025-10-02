import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    cloudflare({
      inspectorPort: false,
      persistState: true,
      // PERFORMANCE: Only handle API requests through worker in dev mode
      // Let Vite serve static HTML directly (much faster)
      configPath: process.env.NODE_ENV === 'production' ? './wrangler.toml' : false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.DEV_PORT ? parseInt(process.env.DEV_PORT, 10) : 4000,
    strictPort: true, // Fail if configured port is not available - no port confusion
    watch: {
      ignored: ['**/.wrangler/**', '**/node_modules/**'],
    },
  },
  // PERFORMANCE: Pre-bundle server dependencies to reduce worker transformation time
  optimizeDeps: {
    include: [
      'hono',
      'hono/cors',
      '@hono/zod-openapi',
      'better-auth',
      'kysely',
      'postgres',
    ],
    // Force Vite to pre-bundle on server start
    force: false,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router', '@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
})
