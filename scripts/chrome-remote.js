#!/usr/bin/env node

import { WebSocket } from 'ws';
import { spawn } from 'child_process';

const CDP_PORT = 37279;
const CDP_HOST = 'localhost';

class ChromeDevToolsTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.currentTargetId = null;
    this.reconnectInterval = null;
  }

  async connect() {
    try {
      // Get list of available targets
      const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
      const targets = await response.json();

      // Find all page targets, prefer Google or localhost
      const pageTargets = targets.filter(target => target.type === 'page');
      if (pageTargets.length === 0) {
        throw new Error('No page targets found');
      }

      // Prefer Google, localhost, or the first available target
      const pageTarget = pageTargets.find(t => t.url.includes('google.com')) ||
                         pageTargets.find(t => t.url.includes('localhost')) ||
                         pageTargets[0];

      this.currentTargetId = pageTarget.id;

      console.log(`📱 Connecting to browser target: ${pageTarget.title}`);
      console.log(`🔗 URL: ${pageTarget.url}`);
      console.log(`🆔 Target ID: ${pageTarget.id}`);

      // Connect via WebSocket
      this.ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          console.log('✅ Connected to Chrome DevTools Protocol');
          this.setupConsoleListening();
          this.startTargetMonitoring();
          resolve();
        });

        this.ws.on('error', reject);

        this.ws.on('close', () => {
          console.log('🔌 WebSocket connection closed');
          this.reconnect();
        });
      });
    } catch (error) {
      console.error('❌ Failed to connect to CDP:', error.message);
      throw error;
    }
  }

  async setupConsoleListening() {
    // Enable Runtime domain
    await this.sendCommand('Runtime.enable');

    // Enable Console domain
    await this.sendCommand('Console.enable');

    // Listen for console messages
    this.ws.on('message', (data) => {
      const message = JSON.parse(data);

      if (message.method === 'Runtime.consoleAPICalled') {
        this.handleConsoleMessage(message.params);
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.handleException(message.params);
      }
    });

    console.log('🎯 Console logging enabled - watching for browser messages...');
    console.log('📝 Format: [TIMESTAMP] [LEVEL] MESSAGE');
    console.log('─'.repeat(60));
  }

  handleConsoleMessage(params) {
    const { type, args, timestamp } = params;
    const time = new Date(timestamp).toISOString();
    const level = type.toUpperCase().padEnd(5);

    // Extract message from args
    const messages = args.map(arg => {
      if (arg.type === 'string') {
        return arg.value;
      } else if (arg.type === 'object') {
        return JSON.stringify(arg.preview || arg.description || '[Object]');
      } else {
        return String(arg.value || arg.description || '[Unknown]');
      }
    });

    const message = messages.join(' ');

    // Color code by level
    const colors = {
      LOG: '\x1b[37m',     // white
      INFO: '\x1b[36m',    // cyan
      WARN: '\x1b[33m',    // yellow
      ERROR: '\x1b[31m',   // red
      DEBUG: '\x1b[35m'    // magenta
    };

    const color = colors[type.toUpperCase()] || '\x1b[37m';
    const reset = '\x1b[0m';

    console.log(`${color}[${time}] [${level}] ${message}${reset}`);
  }

  handleException(params) {
    const { exceptionDetails } = params;
    const time = new Date().toISOString();

    console.log(`\x1b[31m[${time}] [ERROR] Exception: ${exceptionDetails.text}\x1b[0m`);
    if (exceptionDetails.stackTrace) {
      console.log(`\x1b[90m${JSON.stringify(exceptionDetails.stackTrace, null, 2)}\x1b[0m`);
    }
  }

  sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const message = { id, method, params };

      const handler = (data) => {
        const response = JSON.parse(data);
        if (response.id === id) {
          this.ws.off('message', handler);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async waitForConnection() {
    console.log('⏳ Waiting for Chrome to be available on port 9222...');

    const maxAttempts = 30;
    const delay = 1000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`);
        if (response.ok) {
          console.log('🚀 Chrome DevTools Protocol is ready');
          return;
        }
      } catch (error) {
        // Chrome not ready yet
      }

      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error(`Chrome not available after ${maxAttempts} seconds`);
  }

  startTargetMonitoring() {
    // Monitor for new/changed targets every 3 seconds
    this.reconnectInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
        const targets = await response.json();

        // Check if there's a new Google or localhost target that's different from current
        const pageTargets = targets.filter(target => target.type === 'page');
        const preferredTarget = pageTargets.find(t => t.url.includes('google.com')) ||
                               pageTargets.find(t => t.url.includes('localhost'));

        if (preferredTarget && preferredTarget.id !== this.currentTargetId) {
          console.log(`🔄 Switching to new target: ${preferredTarget.title}`);
          this.disconnect();
          setTimeout(() => this.connect(), 1000);
        }
      } catch (error) {
        // Ignore monitoring errors
      }
    }, 3000);
  }

  async reconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    console.log('🔄 Attempting to reconnect...');
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('❌ Reconnection failed:', error.message);
        setTimeout(() => this.reconnect(), 5000);
      }
    }, 2000);
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    if (this.ws) {
      this.ws.close();
      console.log('\n👋 Disconnected from Chrome DevTools');
    }
  }
}

async function main() {
  const tester = new ChromeDevToolsTester();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️  Shutting down...');
    tester.disconnect();
    process.exit(0);
  });

  try {
    await tester.waitForConnection();
    await tester.connect();

    // Keep the process running
    console.log('\nPress Ctrl+C to stop monitoring');

    // Keep alive
    setInterval(() => {}, 1000);

  } catch (error) {
    console.error('💥 Failed to start tester:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}