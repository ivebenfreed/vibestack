// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import { cloudflare } from "unenv";
var app_config_default = defineConfig({
  ssr: true,
  server: {
    preset: "cloudflare-pages",
    unenv: cloudflare,
    rollupConfig: {
      external: ["__STATIC_CONTENT_MANIFEST", "node:async_hooks"]
    }
  },
  vite: {
    ssr: {
      external: ["__STATIC_CONTENT_MANIFEST"],
      noExternal: ["@solidjs/start", "@solidjs/router", "@solidjs/meta"]
    },
    build: {
      target: "esnext"
    },
    resolve: {
      conditions: ["workerd", "worker", "browser"]
    }
  }
});
export {
  app_config_default as default
};
