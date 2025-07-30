#!/usr/bin/env node

/**
 * Generate dynamic wrangler configuration for local mode
 */

const fs = require('fs');
const path = require('path');

const serverPort = process.env.SERVER_PORT || '8787';

// Generate a wrangler configuration for local mode
const wranglerConfig = `name = "vibestack-server"
compatibility_date = "2023-12-01"
compatibility_flags = ["nodejs_compat"]

# Local environment configuration
[env.local]

# Enable observability logging for all environments
[observability.logs]
enabled = true

# Development server configuration
[dev]
ip = "127.0.0.1"
port = ${serverPort}
local_protocol = "http"
upstream_protocol = "http"
host = "127.0.0.1"

# Environment variables
[vars]
ENVIRONMENT = "local"
WEB_PORT = "${process.env.WEB_PORT || '5173'}"
SERVER_PORT = "${serverPort}"

# Module aliases (correct syntax)
[alias]
"debug" = "./src/shims/debug.ts"
"app-root-path" = "./src/lib/app-root-path-shim.ts"

# Specify ESM format
[build]
format = "modules"
rules = [
    { type = "ESModule", globs = ["**/*.js", "**/*.ts"] }
]

# KV Namespace for client cache
[kv_namespaces]
CLIENT_CACHE = { binding = "CLIENT_CACHE", id = "01453e5dc2ff4cf8a061a25b95501df0" }

# Durable Objects
[durable_objects]
bindings = [
    { name = "SYNC", class_name = "SyncDO" },
    { name = "REPLICATION", class_name = "ReplicationDO" }
]

# Enable unlimited Workers for testing
[limits]
cpu_ms = 10_000
`;

const outputPath = path.join(__dirname, '../apps/server/wrangler.generated.local.toml');
fs.writeFileSync(outputPath, wranglerConfig);

console.log(`   Generated wrangler local config at: ${outputPath}`);