// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Determine site URL based on environment
const getSiteUrl = () => {
  // Use PUBLIC_SITE_URL if set (from GitHub Actions)
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL;
  }
  
  // Check Cloudflare environment variables
  if (process.env.CF_PAGES_BRANCH === 'main' || process.env.ENVIRONMENT === 'production') {
    return 'https://getelevra.com';
  }
  if (process.env.CF_PAGES_BRANCH === 'staging' || process.env.ENVIRONMENT === 'staging') {
    return 'https://dev.getelevra.com';
  }
  
  // Check if we're in a Cloudflare Pages preview deployment
  if (process.env.CF_PAGES_URL) {
    return process.env.CF_PAGES_URL;
  }
  
  // Local development
  return 'http://localhost:4321';
};

// https://astro.build/config
export default defineConfig({
  site: getSiteUrl(),
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    imageService: 'passthrough',
    functionPerRoute: false,
  }),
  integrations: [react(), sitemap()],
  vite: {
    ssr: {
      external: ['node:crypto', 'node:path', 'node:fs/promises', 'node:url'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      exclude: ['@astrojs/react'],
      force: true,
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: import.meta.env.PROD ? {
        "react-dom/server": "react-dom/server.edge",
      } : undefined,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(import.meta.env.MODE),
    },
  },
});