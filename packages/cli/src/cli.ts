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
import inquirer from 'inquirer';
import { logoutCommand } from './commands/logout.js';
import { createSuperAdminCommand } from './commands/create-super-admin.js';
import { seedUsersCommand } from './commands/seed-users.js';

program
  .name('@repo/cli')
  .description('CLI for various monorepo setup and utility scripts')
  .version('0.1.0');

program
  .command('create-super-admin')
  .description('Creates a new super admin user and logs them in.')
  .action(async () => {
    try {
      await createSuperAdminCommand();
      process.exit(0);
    } catch (error) {
      // The command itself should do detailed logging.
      // console.error('An error occurred executing create-super-admin:', error); // Optional: generic catcher
      process.exit(1);
    }
  });

program
  .command('seed-users')
  .description('Seeds the database with batch users. Prompts for login if no active session.')
  .action(async () => {
    try {
      await seedUsersCommand();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  });


program
  .command('logout')
  .description('Logs out the super admin by clearing the stored session token.')
  .action(async () => {
    try {
      await logoutCommand();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  });

async function main() {
  // Check if any command is passed as an argument
  // process.argv contains: [node_executable, script_path, ...args]
  // So, if length > 2, arguments are present.
  if (process.argv.length > 2) {
    program.parse(process.argv);
  } else {
    // No arguments, show interactive menu
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create Super Admin (and auto-login)', value: 'create-super-admin' },
          { name: 'Seed Batch Users (prompts for login if needed)', value: 'seed-users' },
          { name: 'Logout Super Admin', value: 'logout' },
          new inquirer.Separator(),
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    try {
      switch (answers.command) {
        case 'create-super-admin':
          await createSuperAdminCommand();
          break;
        case 'seed-users':
          await seedUsersCommand();
          break;
        case 'logout':
          await logoutCommand();
          break;
        case 'exit':
          console.log('Exiting CLI.');
          process.exit(0);
          return; // Explicit return
      }
      process.exit(0); // Success for executed commands
    } catch (error) {
        // Individual commands should log their specific errors.
        // This is a fallback.
        // console.error("An error occurred:", error);
        process.exit(1); // Failure
    }
  }
}

main();