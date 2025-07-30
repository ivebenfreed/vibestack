import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

// Try to load dynamic server configuration if it exists
let dynamicServerConfig = {};
try {
  const configPath = path.resolve(__dirname, './vite.server.config.js');
  if (fs.existsSync(configPath)) {
    const { dynamicServerConfig: config } = await import(configPath);
    dynamicServerConfig = config;
    console.log('Using dynamic server configuration');
  }
} catch (e) {
  // Ignore - use defaults
}

// https://vite.dev/config/
export default defineConfig({
  // Use relative paths for proper module resolution in Workers
  // See: https://github.com/vitejs/vite/discussions/15547
  base: './',
  plugins: [
    // Conditionally include VitePWA only in production
    ...(process.env.NODE_ENV === 'production' ? [
      VitePWA({
        registerType: 'autoUpdate', // Automatically update the service worker when new content is available
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'], // Cache these static assets
        manifest: { // Basic PWA manifest generation
          name: 'VibeStack',
          short_name: 'VibeStack',
          description: 'Local First, Sync Enabled Business Tool Platform',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // Cache JS, CSS, HTML, and image assets
          // Fix for direct route navigation - allow all navigation routes
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^\/(?!(api|assets|_|\.)).*/], // Allow app routes, exclude API and assets
          // Fix redirect handling for direct URL navigation
          navigateFallbackDenylist: [/^\/api\//, /^\/assets\//, /^\/_/, /\.[^\/]+$/], // Exclude API routes and static files
          // Improved runtime caching for navigation
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                networkTimeoutSeconds: 3,
                cacheName: 'navigation-cache',
                cacheableResponse: {
                  statuses: [0, 200]
                },
                fetchOptions: {
                  redirect: 'follow',
                  credentials: 'include'
                }
              }
            },
            {
              urlPattern: /^https:\/\/dev\.codevibesmatter\.com\/(?!api).*/,
              handler: 'NetworkFirst',
              options: {
                networkTimeoutSeconds: 3,
                cacheName: 'runtime-navigation',
                cacheableResponse: {
                  statuses: [0, 200]
                },
                fetchOptions: {
                  redirect: 'follow',
                  credentials: 'include'
                }
              }
            }
          ]
        }
      })
    ] : []),
    // Enable Cloudflare Workers deployment (only for builds, not dev)
    ...(process.env.NODE_ENV === 'production' ? [cloudflare()] : []),
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['reflect-metadata', 'class-transformer', 'class-validator', 'typeorm', 'typeorm/browser'],
    exclude: ['@electric-sql/pglite']
  },
  esbuild: {
    supported: {
      'decorators': true
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      // Ensure TypeORM is bundled in the worker instead of being external
      external: [],
      output: {
        format: 'es'
      }
    }
  },
  resolve: {
    alias: {
      // Ensure TypeORM uses its browser bundle
      typeorm: 'typeorm/browser',
      // Keep sync-types alias pointing to dist (as it might be pre-built)
      '@repo/sync-types': path.resolve(__dirname, '../../packages/sync-types/dist/index.js'),
      '@': path.resolve(__dirname, './src'),

      // fix loading all icon chunks in dev mode
      // https://github.com/tabler/tabler-icons/issues/1233
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
  // Build configuration for Cloudflare Workers
  build: {
    rollupOptions: {
      // Don't externalize typeorm - it needs to be bundled for Workers
      // external: ["typeorm"] // REMOVED - this was causing the module resolution error
    }
  },
  server: {
    // https: {
    //   key: './server-key.pem', // Path to the private key file generated by mkcert
    //   cert: './server.pem'    // Path to the certificate file generated by mkcert
    // },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    // Merge default config with dynamic config
    ...(dynamicServerConfig.port ? { port: dynamicServerConfig.port } : {}),
    proxy: dynamicServerConfig.proxy || {
      // Default proxy configuration
      '/api': {
        target: 'http://127.0.0.1:8787', // Target is HTTP, matching frontend protocol
        secure: false, // Allow self-signed certificates from the backend (wrangler dev)
        changeOrigin: true, // Needed when switching between HTTP and HTTPS
        // Don't rewrite the path - server expects /api prefix
        // rewrite: (path) => path.replace(/^\/api/, ''), 
        ws: true, // Enable WebSocket proxy
        configure: (proxy, options) => {
          // Ensure cookies are forwarded for WebSocket connections
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            // Forward cookies from the original request to the WebSocket connection
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
        }
      }
    }
  }
})
