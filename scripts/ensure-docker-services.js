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
    const result = execSync('docker compose ps --format json', { 
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (!result.trim()) {
      return false;
    }
    
    const services = result.trim().split('\n').map(line => JSON.parse(line));
    const requiredServices = ['vibestack-postgres', 'vibestack-neon-proxy'];
    
    const runningServices = services.filter(service => 
      service.State === 'running' && requiredServices.includes(service.Name)
    );
    
    return runningServices.length === requiredServices.length;
  } catch (error) {
    return false;
  }
}

async function startServices() {
  console.log('🐳 Starting Docker services (PostgreSQL + Neon proxy)...');
  
  try {
    execSync('docker compose up -d', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    console.log('✅ Docker services started successfully');
    
    // Wait a moment for services to be fully ready
    console.log('⏳ Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error.message);
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