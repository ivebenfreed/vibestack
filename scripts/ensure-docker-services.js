#!/usr/bin/env node

/**
 * Ensure Docker services are running for local development
 * Auto-starts docker-compose services if they're not already running
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const { BranchDbConfigurator } = require('./auto-configure-branch-db.js');

async function checkDockerRunning() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('❌ Docker is not running. Please start Docker Desktop and try again.');
    process.exit(1);
  }
}

async function checkServicesRunning() {
  try {
    // Check if main postgres container is running
    const result = execSync('docker ps --filter "name=vibestack-main-postgres" --format "{{.Status}}"', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    return result.trim().startsWith('Up');
  } catch (error) {
    return false;
  }
}

async function startServices() {
  console.log('🐳 Starting PostgreSQL using main-postgres setup...');
  
  try {
    execSync('./main-postgres/start.sh', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    console.log('✅ PostgreSQL started successfully');
    
  } catch (error) {
    console.error('❌ Failed to start PostgreSQL:', error.message);
    process.exit(1);
  }
}

async function ensureServices() {
  console.log('🔍 Checking if Docker services are needed for local development...');
  
  await checkDockerRunning();
  
  // Use auto-configurator for branch-aware database setup
  const configurator = new BranchDbConfigurator();
  const config = configurator.getDbConfig();
  
  console.log(`🎯 Detected ${config.mode} mode: ${config.branch || 'main'}`);
  
  if (config.mode === 'branch') {
    // For branch mode, use the auto-configurator
    await configurator.ensureDbExists();
  } else {
    // For main mode, use existing logic
    const servicesRunning = await checkServicesRunning();
    
    if (servicesRunning) {
      console.log('✅ Docker services are already running');
      return;
    }
    
    await startServices();
  }
}

// Run the check
if (require.main === module) {
  ensureServices().catch(error => {
    console.error('❌ Error ensuring Docker services:', error);
    process.exit(1);
  });
}

module.exports = { ensureServices };