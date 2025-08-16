import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: true,
  server: {
    preset: "cloudflare-module",
    rollupConfig: {
      external: ["__STATIC_CONTENT_MANIFEST", "node:async_hooks"],
    },
  },
  vite: {
    ssr: {
      external: ["__STATIC_CONTENT_MANIFEST"],
      noExternal: ["@solidjs/start", "@solidjs/router", "@solidjs/meta"],
    },
    build: {
      target: "esnext",
    },
    resolve: {
      conditions: ["workerd", "worker", "browser"],
    },
  },
});