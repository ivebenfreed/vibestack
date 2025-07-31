#!/usr/bin/env node

/**
 * Generate dynamic wrangler configuration with configurable ports
 */

const fs = require('fs');
const path = require('path');

const serverPort = process.env.SERVER_PORT || '8788';
const webPort = process.env.WEB_PORT || '5173';
const prNumber = process.env.PR_NUMBER;

const config = `name = "vibestack-server${prNumber ? `-pr-${prNumber}` : ''}"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

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
ENVIRONMENT = "${prNumber ? `pr-${prNumber}` : 'development'}"
WEB_PORT = "${webPort}"
SERVER_PORT = "${serverPort}"

# Module aliases (correct syntax)
[alias]
"debug" = "./src/shims/debug.ts"
"app-root-path" = "./src/lib/app-root-path-shim.ts"

# Specify ESM format
[build]
command = ""
watch_dir = "src"

# Durable Objects configuration
[[durable_objects.bindings]]
name = "SYNC"
class_name = "SyncDO"

[[durable_objects.bindings]]
name = "REPLICATION"
class_name = "ReplicationDO"

# Durable Objects migrations (for free plan compatibility)
[[migrations]]
tag = "v1"
new_sqlite_classes = ["SyncDO", "ReplicationDO"]

# Cron triggers
[triggers]
crons = ["0 0 * * *"]  # Run once daily at midnight UTC

# KV namespace configuration
[[kv_namespaces]]
binding = "CLIENT_REGISTRY"
id = "preview${prNumber ? `-pr-${prNumber}` : ''}"
preview_id = "preview${prNumber ? `-pr-${prNumber}` : ''}"
`;

const outputPath = path.join(__dirname, '../apps/server/wrangler.generated.toml');
fs.writeFileSync(outputPath, config);

console.log(`   Generated wrangler config at: ${outputPath}`);