#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if specific env is requested via DB_TARGET
const dbTarget = process.env.DB_TARGET || 'local'; // default to local
const envFile = dbTarget === 'remote' ? '.env.development.remote' : '.env.development.local';

// Load environment
const envPath = path.resolve(__dirname, `../../${envFile}`);
console.log(`Loading environment from: ${envFile}`);
config({ path: envPath });

// Get command line args
const args = process.argv.slice(2);
const isFullUpdate = args.includes('--full');
const skipConfirmation = args.includes('--yes') || args.includes('-y');
const migrationName = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-')) || 'EntityUpdate';

// Detect database type from environment
const databaseUrl = process.env.DATABASE_URL || '';
const dbEnv = process.env.DB_ENV || 'local';
const isLocalDb = dbEnv === 'local' || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

console.log('🔨 Entity Update Workflow');
console.log('========================');
console.log(`📍 Target: ${dbTarget === 'remote' ? 'Remote/Cloud Database' : 'Local Database'}`);

try {
  // Step 1: Run forge:build
  console.log('\n📦 Step 1: Building generated code...');
  execSync('pnpm run forge:build', { stdio: 'inherit' });
  
  if (!isFullUpdate) {
    // Semi-automated mode - just remind about next steps
    console.log('\n✅ Code generation complete!');
    console.log('\n⚠️  IMPORTANT: Now run:');
    console.log(`1. pnpm migration:generate:${isLocalDb ? 'local' : 'server'} -- src/migrations/${isLocalDb ? 'server-local' : 'server'}/YourMigrationName`);
    console.log('2. Review the generated migration file');
    console.log(`3. pnpm migration:run:${isLocalDb ? 'local' : 'server'}`);
    
    if (isLocalDb) {
      console.log('\n📍 Note: Using local database configuration');
    } else {
      console.log('\n☁️  Note: Using cloud database configuration');
    }
  } else {
    // Full automated mode
    console.log('\n🔄 Step 2: Generating migration...');
    const migrationDir = isLocalDb ? 'server-local' : 'server';
    const generateCmd = `pnpm migration:generate:${isLocalDb ? 'local' : 'server'} src/migrations/${migrationDir}/${migrationName}`;
    
    try {
      execSync(generateCmd, { stdio: 'inherit' });
      
      // Find the generated migration file
      const migrationsPath = path.resolve(__dirname, `../migrations/${migrationDir}`);
      const files = fs.readdirSync(migrationsPath);
      const latestMigration = files
        .filter(f => f.endsWith('.ts') && f.includes(migrationName))
        .sort()
        .pop();
      
      if (latestMigration) {
        console.log(`\n📄 Generated migration: ${latestMigration}`);
        
        if (skipConfirmation) {
          console.log('\n🚀 Step 3: Running migration (auto-confirmed)...');
          execSync(`pnpm migration:run:${isLocalDb ? 'local' : 'server'}`, { stdio: 'inherit' });
          console.log('\n✅ Entity update complete!');
          process.exit(0);
        } else {
          console.log('\n⚠️  WARNING: Please review the migration before proceeding!');
          console.log(`   File: src/migrations/${migrationDir}/${latestMigration}`);
          
          // Ask for confirmation
          console.log('\n❓ Run this migration? (y/N): ');
          
          // Simple stdin reader for confirmation
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          readline.question('', (answer: string) => {
            readline.close();
            
            if (answer.toLowerCase() === 'y') {
              console.log('\n🚀 Step 3: Running migration...');
              execSync(`pnpm migration:run:${isLocalDb ? 'local' : 'server'}`, { stdio: 'inherit' });
              console.log('\n✅ Entity update complete!');
            } else {
              console.log('\n⏭️  Skipped migration run. You can run it later with:');
              console.log(`   pnpm migration:run:${isLocalDb ? 'local' : 'server'}`);
            }
            
            process.exit(0);
          });
        }
      } else {
        console.log('\n⚠️  No changes detected or migration generation failed.');
      }
    } catch (error) {
      console.log('\n⚠️  No changes detected in schema.');
    }
  }
} catch (error) {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}