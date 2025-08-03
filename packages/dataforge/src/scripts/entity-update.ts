#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load default development environment
config({ path: path.resolve(__dirname, '../../.env.development') });

// Get command line args
const args = process.argv.slice(2);
const isFullUpdate = args.includes('--full');
const skipConfirmation = args.includes('--yes') || args.includes('-y');
const migrationName = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-')) || 'EntityUpdate';

console.log('🔨 Entity Update Workflow');
console.log('========================');
console.log('📍 Target: Both Local and Remote Databases');

try {
  // Step 1: Run forge:build
  console.log('\n📦 Step 1: Building generated code...');
  execSync('pnpm run forge:build', { stdio: 'inherit' });
  
  if (!isFullUpdate) {
    // Semi-automated mode - just remind about next steps
    console.log('\n✅ Code generation complete!');
    console.log('\n⚠️  IMPORTANT: Now run:');
    console.log(`1. pnpm migration:generate:server src/migrations/server/YourMigrationName`);
    console.log('2. Review the generated migration file');
    console.log('3. Run migrations on both databases:');
    console.log('   pnpm migration:run:local    # Local database');
    console.log('   pnpm migration:run:server   # Remote database');
    console.log('\n💡 Tip: In development, always run migrations on both databases to keep them in sync!');
  } else {
    // Full automated mode
    console.log('\n🔄 Step 2: Generating migration...');
    
    // In development, always generate for both local and server
    const migrationDir = 'server';
    const generateCmd = `pnpm migration:generate:server src/migrations/${migrationDir}/${migrationName}`;
    
    try {
      execSync(generateCmd, { stdio: 'inherit' });
      
      // Find the generated migration file
      const migrationsPath = path.resolve(__dirname, `../migrations/${migrationDir}`);
      const files = fs.readdirSync(migrationsPath);
      const latestMigration = files
        .filter(f => f.endsWith('.ts') && f.includes(migrationName))
        .sort()
        .pop() || null;
      
      if (latestMigration) {
        console.log(`\n📄 Generated migration: ${latestMigration}`);
        
        if (skipConfirmation) {
          console.log('\n🚀 Step 3: Running migrations on both databases (auto-confirmed)...');
          
          // Run on both local and remote in development
          console.log('\n📍 Running on local database...');
          execSync('pnpm migration:run:local', { stdio: 'inherit' });
          
          console.log('\n☁️  Running on remote database...');
          execSync('pnpm migration:run:server', { stdio: 'inherit' });
          
          console.log('\n✅ Entity update complete on both databases!');
          process.exit(0);
        } else {
          console.log('\n⚠️  WARNING: Please review the migration before proceeding!');
          console.log(`   File: src/migrations/${migrationDir}/${latestMigration}`);
          
          // Ask for confirmation
          console.log('\n❓ Run this migration on both local and remote databases? (y/N): ');
          
          // Simple stdin reader for confirmation
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          readline.question('', (answer: string) => {
            readline.close();
            
            if (answer.toLowerCase() === 'y') {
              console.log('\n🚀 Step 3: Running migrations on both databases...');
              
              // Run on both local and remote in development
              console.log('\n📍 Running on local database...');
              execSync('pnpm migration:run:local', { stdio: 'inherit' });
              
              console.log('\n☁️  Running on remote database...');
              execSync('pnpm migration:run:server', { stdio: 'inherit' });
              
              console.log('\n✅ Entity update complete on both databases!');
            } else {
              console.log('\n⏭️  Skipped migration run. You can run them later with:');
              console.log('   pnpm migration:run:local    # For local database');
              console.log('   pnpm migration:run:server   # For remote database');
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