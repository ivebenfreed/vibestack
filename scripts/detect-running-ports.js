#!/usr/bin/env node

/**
 * Detect which development server ports are actually running
 * Used by Playwright to connect to the correct servers regardless of branch
 */

const { execSync } = require('child_process');
const net = require('net');

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(false));
      server.close();
    });
    server.on('error', () => resolve(true));
  });
}

async function detectRunningPorts() {
  // Define possible port ranges
  const possibleWebPorts = [
    5173, // main/staging
    5883, // issue-71
    5173 + 10, 5173 + 20, 5173 + 30, 5173 + 40, 5173 + 50,
    5173 + 60, 5173 + 70, 5173 + 80, 5173 + 90, 5173 + 100
  ];
  
  const possibleServerPorts = [
    8787, // main/staging  
    9497, // issue-71
    8787 + 10, 8787 + 20, 8787 + 30, 8787 + 40, 8787 + 50,
    8787 + 60, 8787 + 70, 8787 + 80, 8787 + 90, 8787 + 100
  ];
  
  // Check which ports are in use
  const runningWebPort = await findFirstRunningPort(possibleWebPorts);
  const runningServerPort = await findFirstRunningPort(possibleServerPorts);
  
  // Also check for environment variables from current context
  const envWebPort = process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : null;
  const envServerPort = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : null;
  
  // Prefer environment variables if they're set and the ports are in use
  let webPort = runningWebPort;
  let serverPort = runningServerPort;
  
  if (envWebPort && await checkPortInUse(envWebPort)) {
    webPort = envWebPort;
  }
  if (envServerPort && await checkPortInUse(envServerPort)) {
    serverPort = envServerPort;
  }
  
  return {
    webPort: webPort || 5173, // fallback to default
    serverPort: serverPort || 8787,
    method: webPort === runningWebPort ? 'detected' : 'environment'
  };
}

async function findFirstRunningPort(ports) {
  for (const port of ports) {
    if (await checkPortInUse(port)) {
      return port;
    }
  }
  return null;
}

// If run directly, output the results
if (require.main === module) {
  detectRunningPorts().then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error detecting ports:', err);
    process.exit(1);
  });
}

module.exports = { detectRunningPorts };