#!/usr/bin/env node
import 'reflect-metadata';
// Environment loading is now handled by the environment utility
import { program } from 'commander';
import inquirer from 'inquirer';
import { 
  loadEnvironment, 
  getCurrentEnvironment, 
  getAvailableEnvironments, 
  type Environment,
  VALID_ENVIRONMENTS 
} from './utils/environment.js';
import { logoutCommand } from './commands/logout.js';
import { createSuperAdminCommand } from './commands/create-super-admin.js';
import { seedUsersCommand } from './commands/seed-users.js';
import { initDataforgeCommand } from './commands/init-dataforge.js';

program
  .name('@repo/cli')
  .description('CLI for various monorepo setup and utility scripts')
  .version('0.1.0')
  .option('-e, --env <environment>', `Environment to use (${VALID_ENVIRONMENTS.join(', ')})`, getCurrentEnvironment());

program
  .command('create-super-admin')
  .description('Creates a new super admin user and logs them in.')
  .action(async () => {
    try {
      const options = program.opts();
      loadEnvironment(options.env);
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
      const options = program.opts();
      loadEnvironment(options.env);
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
      const options = program.opts();
      loadEnvironment(options.env);
      await logoutCommand();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('init-dataforge')
  .description('Initializes Dataforge: builds, generates "InitialSchema" migrations and triggers, and runs all migrations.')
  .action(async () => {
    try {
      const options = program.opts();
      loadEnvironment(options.env);
      console.log('Executing init-dataforge command...');
      await initDataforgeCommand();
      console.log('init-dataforge command completed successfully.');
      process.exit(0);
    } catch (error) {
      console.error('Error executing init-dataforge command. See details above.');
      process.exit(1);
    }
  });

const VIBESTACK_LOGO = `
██    ██ ██ ██████ ██████ ███████ ████████  █████   ██████ ██   ██
██    ██ ██ ██   █ ██     ██         ██    ██   ██ ██      ██  ██ 
██    ██ ██ ██████ █████  ███████    ██    ███████ ██      █████  
██    ██ ██ ██   █ ██          ██    ██    ██   ██ ██      ██  ██ 
 ██████  ██ ██████ ██████ ███████    ██    ██   ██  ██████ ██   ██`;

async function main() {
  // Handle interactive mode separately from command mode
  const args = process.argv.slice(2);
  const hasSpecificCommand = args.some(arg => 
    ['create-super-admin', 'seed-users', 'logout', 'init-dataforge', 'help'].includes(arg)
  );
  
  if (hasSpecificCommand) {
    // A specific command was provided, let commander handle it
    program.parse(process.argv);
    return;
  }
  
  // Clear console and show logo for interactive mode
  console.clear();
  console.log(VIBESTACK_LOGO);
  console.log('\nWelcome to VibeStack CLI\n');
  
  // Interactive mode - manually parse --env option
  const availableEnvs = getAvailableEnvironments();
  const currentEnv = getCurrentEnvironment();
  let selectedEnv = currentEnv;
  
  const envIndex = args.findIndex(arg => arg === '--env' || arg === '-e');
  if (envIndex !== -1 && envIndex + 1 < args.length) {
    selectedEnv = args[envIndex + 1];
    
    // Validate the specified environment exists
    if (!availableEnvs.includes(selectedEnv)) {
      console.error(`❌ Environment '${selectedEnv}' not found. Available: ${availableEnvs.join(', ')}`);
      process.exit(1);
    }
  } else if (availableEnvs.length > 1) {
    // Only prompt for environment if not specified via CLI and multiple are available
    const envAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: availableEnvs.map(env => ({
          name: `${env}${env === currentEnv ? ' (current)' : ''}`,
          value: env
        })),
        default: currentEnv
      }
    ]);
    selectedEnv = envAnswer.environment;
  }
  
  // Load the selected environment
  try {
    loadEnvironment(selectedEnv);
    console.log(`\n✅ Loaded ${selectedEnv} environment`);
    console.log(`API URL: ${process.env.API_URL}\n`);
  } catch (error) {
    console.error(`❌ Failed to load ${selectedEnv} environment:`, error);
    process.exit(1);
  }
  
  // Command selection
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'What would you like to do?',
      choices: [
        { name: 'Create Super Admin (and auto-login)', value: 'create-super-admin' },
        { name: 'Seed Batch Users (prompts for login if needed)', value: 'seed-users' },
        { name: 'Initialize Dataforge (uses "InitialSchema")', value: 'init-dataforge' },
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
      case 'init-dataforge':
        try {
          console.log('Executing init-dataforge command via interactive menu...');
          await initDataforgeCommand();
          console.log('init-dataforge command completed successfully via interactive menu.');
        } catch (error) {
          console.error('Error executing init-dataforge command from interactive menu. See details above.');
          throw error; // Re-throw to be caught by the main try/catch
        }
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

main();