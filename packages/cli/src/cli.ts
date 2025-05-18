#!/usr/bin/env node
import 'reflect-metadata';
// Load dotenv first before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file in the package root BEFORE other modules are imported
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Debug file paths
console.log('ESM __dirname in cli.ts:', __dirname);
console.log('Resolved .env path:', path.resolve(__dirname, '../.env'));
// Load environment variables from .env file in the package root
const dotenvResult = dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
console.log('dotenv.config() result in cli.ts:', dotenvResult);
console.log('process.env.API_URL after dotenv.config() in cli.ts:', process.env.API_URL);
console.log('process.env.BOOTSTRAP_SECRET after dotenv.config() in cli.ts:', process.env.BOOTSTRAP_SECRET);

// Now import other modules AFTER environment variables are loaded
import { program } from 'commander';
import { seedUsersCommand } from './commands/seed-users.js'; // Note the .js extension for ESM
import { clearUsersCommand } from './commands/clear-users.js'; // Note the .js extension for ESM

program
  .name('@repo/cli')
  .description('CLI for various monorepo setup and utility scripts')
  .version('0.1.0');

program
  .command('seed-users')
  .description('Seeds the database with an initial set of users, including a super admin and batch users.')
  .action(async () => {
    try {
      await seedUsersCommand();
      console.log('Seed users command completed successfully.');
      process.exit(0);
    } catch (error) {
      console.error('Error executing seed users command:', error);
      process.exit(1);
    }
  });

program
  .command('clear-users')
  .description('Clears all users from the database via admin API, except for the super admin.')
  .action(async () => {
    try {
      await clearUsersCommand();
      console.log('Clear users command completed successfully.');
      process.exit(0);
    } catch (error) {
      console.error('Error executing clear users command:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);