#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get PR number from environment variable or default to 0
const prNumber = process.env.PR_NUMBER || '0';

// Calculate ports based on PR number
const baseServerPort = 8787;
const baseWebPort = 5173;
const serverPort = baseServerPort + parseInt(prNumber) * 10;
const webPort = baseWebPort + parseInt(prNumber) * 10;

// Database ports (fixed for local development)
const dbPort = 5432;
const proxyPort = 4444;

console.log(`🔧 Setting up local development ports for PR #${prNumber}`);
console.log(`   Server Port: ${serverPort}`);
console.log(`   Web Port: ${webPort}`);
console.log(`   Database Port: ${dbPort}`);
console.log(`   Proxy Port: ${proxyPort}`);

// Generate wrangler config for local development
const wranglerConfig = `name = "vibestack"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
send_metrics = false

[durable_objects]
bindings = [
  { name = "REPLICATION", class_name = "ReplicationDO" },
  { name = "STORAGE", class_name = "SyncStorageDO" },
  { name = "CHANNEL", class_name = "ChannelDO" },
]

[[migrations]]
tag = "v1"
new_classes = ["ReplicationDO", "SyncStorageDO", "ChannelDO"]

[[kv_namespaces]]
binding = "CLIENT_CACHE"
id = "01453e5dc2ff4cf8a061a25b95501df0"

[dev]
port = ${serverPort}

[vars]
LOG_LEVEL = "info"
ENABLE_PERFORMANCE_LOGS = "false"
LOG_TIMESTAMP_FORMAT = "iso"
`;

// Write wrangler config
const wranglerPath = path.join(__dirname, '../apps/server/wrangler.generated.local.toml');
fs.writeFileSync(wranglerPath, wranglerConfig);
console.log(`   Generated local wrangler config at: ${wranglerPath}`);

// Generate vite server config for web app
const viteServerConfig = `export default {
  host: 'localhost',
  port: ${webPort},
  strictPort: true
}`;

const viteConfigPath = path.join(__dirname, '../apps/web/vite.server.config.js');
fs.writeFileSync(viteConfigPath, viteServerConfig);
console.log(`   Generated vite server config at: ${viteConfigPath}`);

// Generate web env file
const webEnv = `VITE_API_URL=http://localhost:${serverPort}
`;

const webEnvPath = path.join(__dirname, '../apps/web/.env.development.generated');
fs.writeFileSync(webEnvPath, webEnv);
console.log(`   Generated web env at: ${webEnvPath}`);

// Export ports for use in scripts
process.env.SERVER_PORT = serverPort.toString();
process.env.WEB_PORT = webPort.toString();

console.log('✅ Local port configuration complete');