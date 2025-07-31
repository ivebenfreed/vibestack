#!/usr/bin/env node

/**
 * Find a free port starting from a base port
 */

const net = require('net');

async function findFreePort(basePort) {
  let port = basePort;
  
  while (true) {
    const isPortFree = await checkPort(port);
    if (isPortFree) {
      return port;
    }
    port++;
    if (port > basePort + 100) {
      throw new Error(`Could not find free port after checking 100 ports from ${basePort}`);
    }
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

async function isPortInUse(port) {
  return !(await checkPort(port));
}

// If called directly, find free ports for all services
if (require.main === module) {
  (async () => {
    const BASE_SERVER_PORT = 8787;
    const BASE_WEB_PORT = 5173;
    const BASE_DB_PORT = 5432;
    const BASE_PROXY_PORT = 4444;
    
    const prNumber = process.env.PR_NUMBER || '0';
    const offset = parseInt(prNumber) * 10;
    
    try {
      const serverPort = await findFreePort(BASE_SERVER_PORT + offset);
      const webPort = await findFreePort(BASE_WEB_PORT + offset);
      const dbPort = await findFreePort(BASE_DB_PORT + offset);
      const proxyPort = await findFreePort(BASE_PROXY_PORT + offset);
      
      console.log(JSON.stringify({
        serverPort,
        webPort,
        dbPort,
        proxyPort
      }));
    } catch (error) {
      console.error('Error finding free ports:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { findFreePort, isPortInUse };