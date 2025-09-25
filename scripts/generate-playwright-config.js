#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../config/chrome-debug.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const playwrightConfig = {
  "browser": {
    "browserName": "chromium",
    "isolated": false,
    "userDataDir": ".playwright/profiles/main",
    "launchOptions": {
      "headless": false,
      "args": [
        `--remote-debugging-port=${config.remoteDebuggingPort}`
      ]
    }
  },
  "outputDir": ".playwright/output",
  "capabilities": ["tabs", "vision", "pdf"]
};

const outputPath = join(__dirname, '../playwright-mcp.config.json');
writeFileSync(outputPath, JSON.stringify(playwrightConfig, null, 2) + '\n');

console.log(`✅ Generated Playwright config with port ${config.remoteDebuggingPort}`);