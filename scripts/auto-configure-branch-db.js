#!/usr/bin/env node

/**
 * Auto-configure database for worktree branches
 * Automatically detects branch context and sets up isolated database
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BranchDbConfigurator {
  constructor() {
    this.currentBranch = this.getCurrentBranch();
    this.isWorktree = this.isInWorktree();
    this.prNumber = this.extractPrNumber();
    this.baseDir = process.cwd();
  }

  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.warn('⚠️  Could not detect git branch');
      return null;
    }
  }

  isInWorktree() {
    try {
      // Get the git root directory (works from any subdirectory)
      const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
      const worktreeList = execSync('git worktree list', { encoding: 'utf8' });
      
      // Check if we're in a worktree (not the main repo)
      const lines = worktreeList.split('\n').filter(line => line.trim());
      const mainRepo = lines[0].split(/\s+/)[0]; // First line is main repo
      
      // Check if the git root is a worktree (not the main repo)
      return gitRoot !== mainRepo && worktreeList.includes(gitRoot);
    } catch (error) {
      return false;
    }
  }

  extractPrNumber() {
    if (!this.currentBranch) return null;
    
    // Extract from branch names like: issue-123, feature-456, pr-789
    const match = this.currentBranch.match(/(?:issue-|feature-|pr-)(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  getDbConfig() {
    if (!this.isWorktree || !this.prNumber) {
      // Main branch configuration
      return {
        mode: 'main',
        postgresPort: 5432,
        neonProxyPort: 4444,
        dbName: 'vibestack_dev',
        compose: 'docker-compose.yml'
      };
    }

    // Branch-specific configuration
    const offset = this.prNumber * 10;
    return {
      mode: 'branch',
      branch: this.currentBranch,
      prNumber: this.prNumber,
      postgresPort: 5432 + offset,
      neonProxyPort: 4444 + offset,
      dbName: `vibestack_dev_${this.currentBranch.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      compose: `docker-compose.pr-${this.prNumber}.yml`
    };
  }

  async ensureDbExists() {
    const config = this.getDbConfig();
    
    console.log(`🔧 Auto-configuring database for ${config.mode} mode`);
    console.log(`   Branch: ${this.currentBranch || 'main'}`);
    console.log(`   PostgreSQL: localhost:${config.postgresPort}`);
    console.log(`   Neon Proxy: localhost:${config.neonProxyPort}`);
    
    if (config.mode === 'branch') {
      await this.setupBranchDatabase(config);
    } else {
      await this.ensureMainDatabase(config);
    }

    await this.updateWranglerConfig(config);
    console.log('✅ Database configuration complete');
  }

  async setupBranchDatabase(config) {
    // 1. Ensure main database is running first (to clone from)
    await this.ensureMainDatabaseForCloning();
    
    // 2. Generate branch-specific docker-compose
    await this.generateBranchDockerCompose(config);
    
    // 3. Start branch-specific containers
    await this.startBranchContainers(config);
    
    // 4. Wait for database readiness
    await this.waitForDatabase(config);
    
    // 5. Clone database from main
    await this.cloneDatabaseFromMain(config);
  }

  async generateBranchDockerCompose(config) {
    console.log('📝 Generating branch-specific docker-compose...');
    
    // Get git root directory to find docker-compose.yml
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const baseCompose = fs.readFileSync(path.join(gitRoot, 'docker-compose.yml'), 'utf8');
    
    // Replace ports and container names
    const branchCompose = baseCompose
      .replace(/5432:5432/g, `${config.postgresPort}:5432`)
      .replace(/4444:4444/g, `${config.neonProxyPort}:4444`)
      .replace(/vibestack-postgres/g, `vibestack-postgres-${config.prNumber}`)
      .replace(/vibestack-neon-proxy/g, `vibestack-neon-proxy-${config.prNumber}`)
      .replace(/vibestack_dev/g, config.dbName);
    
    const composePath = path.join(gitRoot, config.compose);
    fs.writeFileSync(composePath, branchCompose);
    console.log(`   ✅ Generated ${composePath}`);
  }

  async startBranchContainers(config) {
    console.log('🐳 Starting branch-specific containers...');
    
    try {
      // Check if containers are already running
      const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      const postgresName = `vibestack-postgres-${config.prNumber}`;
      const proxyName = `vibestack-neon-proxy-${config.prNumber}`;
      
      if (runningContainers.includes(postgresName) && runningContainers.includes(proxyName)) {
        console.log('   ✅ Containers already running');
        return;
      }

      const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
      const composePath = path.join(gitRoot, config.compose);
      execSync(`docker compose -f ${composePath} up -d`, { stdio: 'inherit' });
      console.log('   ✅ Containers started');
    } catch (error) {
      throw new Error(`Failed to start containers: ${error.message}`);
    }
  }

  async ensureMainDatabase(config) {
    console.log('🐳 Ensuring main database is running...');
    
    try {
      const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      
      if (runningContainers.includes('vibestack-postgres') && runningContainers.includes('vibestack-neon-proxy')) {
        console.log('   ✅ Main containers already running');
        return;
      }

      execSync('docker-compose up -d', { stdio: 'inherit' });
      console.log('   ✅ Main containers started');
      
      await this.waitForDatabase(config);
    } catch (error) {
      throw new Error(`Failed to start main database: ${error.message}`);
    }
  }

  async waitForDatabase(config) {
    console.log('⏳ Waiting for database readiness...');
    
    const maxRetries = 30;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        execSync(`pg_isready -h localhost -p ${config.postgresPort}`, { stdio: 'pipe' });
        console.log('   ✅ Database ready');
        return;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error('Database failed to become ready');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async ensureMainDatabaseForCloning() {
    console.log('🔧 Ensuring main database is available for cloning...');
    
    try {
      const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      
      if (!runningContainers.includes('vibestack-postgres') || !runningContainers.includes('vibestack-neon-proxy')) {
        console.log('   ⚡ Starting main database containers...');
        const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
        execSync(`docker compose -f ${path.join(gitRoot, 'docker-compose.yml')} up -d`, { stdio: 'inherit' });
        
        // Wait for main database to be ready
        await this.waitForDatabase({ postgresPort: 5432 });
      } else {
        console.log('   ✅ Main database containers already running');
      }
    } catch (error) {
      console.warn('   ⚠️  Could not ensure main database:', error.message);
    }
  }

  async cloneDatabaseFromMain(config) {
    console.log('🔄 Checking if database needs cloning...');
    
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
      
      // Check if database already exists
      const checkDbCommand = `docker exec vibestack-postgres-${config.prNumber} psql -U postgres -lqt | cut -d \\| -f 1 | grep -qw ${config.dbName}`;
      let dbExists = false;
      try {
        execSync(checkDbCommand, { stdio: 'pipe' });
        dbExists = true;
      } catch (e) {
        dbExists = false;
      }
      
      if (dbExists) {
        // Check if database has tables with actual data
        try {
          // Check if users table exists and has data (users table should always have data in a cloned db)
          const checkDataCommand = `docker exec vibestack-postgres-${config.prNumber} psql -U postgres -d ${config.dbName} -c "SELECT COUNT(*) FROM users;" -t 2>/dev/null`;
          const userCount = parseInt(execSync(checkDataCommand, { encoding: 'utf8', stdio: 'pipe' }).trim());
          
          if (userCount > 0) {
            console.log(`   ✅ Database already exists with data (${userCount} users), skipping clone`);
            return;
          }
        } catch (e) {
          // Table doesn't exist or query failed, proceed with cloning
          console.log('   📊 Database exists but appears empty, will clone from main');
        }
      }
      
      console.log('   📦 Cloning database from main...');
      
      // Create the database if it doesn't exist
      execSync(`docker exec vibestack-postgres-${config.prNumber} psql -U postgres -c "CREATE DATABASE ${config.dbName}" || true`, {
        stdio: 'pipe'
      });
      
      // Use pg_dump to export from main and pipe to branch database
      const dumpCommand = `docker exec vibestack-postgres pg_dump -U postgres vibestack_dev`;
      const restoreCommand = `docker exec -i vibestack-postgres-${config.prNumber} psql -U postgres ${config.dbName}`;
      
      execSync(`${dumpCommand} | ${restoreCommand}`, {
        stdio: 'inherit',
        shell: true
      });
      
      console.log('   ✅ Database cloned successfully');
    } catch (error) {
      console.error('   ❌ Failed to clone database:', error.message);
      throw error;
    }
  }

  async updateWranglerConfig(config) {
    console.log('⚙️  Updating wrangler configuration...');
    
    const configPath = config.mode === 'branch' 
      ? 'apps/server/wrangler.generated.local.toml'
      : 'apps/server/wrangler.generated.local.toml';
    
    if (!fs.existsSync(configPath)) {
      console.log('   ⚠️  Wrangler config not found, skipping update');
      return;
    }

    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Update database URLs
    const neonUrl = `http://db.localtest.me:${config.neonProxyPort}/sql`;
    const directUrl = `postgres://postgres:postgres@localhost:${config.postgresPort}/${config.dbName}`;
    
    configContent = configContent
      .replace(/DATABASE_URL = "http:\/\/db\.localtest\.me:\d+\/sql"/, `DATABASE_URL = "${neonUrl}"`)
      .replace(/DIRECT_DATABASE_URL = "postgres:\/\/postgres:postgres@localhost:\d+\/\w+"/, `DIRECT_DATABASE_URL = "${directUrl}"`);
    
    fs.writeFileSync(configPath, configContent);
    console.log('   ✅ Wrangler config updated');
  }

  async cleanup() {
    const config = this.getDbConfig();
    
    if (config.mode === 'branch') {
      console.log(`🧹 Cleaning up branch database for ${config.branch}...`);
      
      try {
        execSync(`docker-compose -f ${config.compose} down`, { stdio: 'inherit' });
        if (fs.existsSync(config.compose)) {
          fs.unlinkSync(config.compose);
        }
        console.log('   ✅ Branch database cleaned up');
      } catch (error) {
        console.warn('   ⚠️  Cleanup failed:', error.message);
      }
    }
  }
}

// CLI Interface
async function main() {
  const [,, command] = process.argv;
  const configurator = new BranchDbConfigurator();
  
  try {
    switch (command) {
      case 'setup':
      case undefined:
        await configurator.ensureDbExists();
        break;
      case 'cleanup':
        await configurator.cleanup();
        break;
      case 'status':
        console.log('📊 Current configuration:');
        console.log(JSON.stringify(configurator.getDbConfig(), null, 2));
        break;
      default:
        console.log('Usage: node auto-configure-branch-db.js [setup|cleanup|status]');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { BranchDbConfigurator };