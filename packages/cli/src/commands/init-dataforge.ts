import { execSync } from 'node:child_process';
import path from 'node:path';

// Helper function to execute shell commands
function executeCommand(command: string, monorepoRoot: string) {
  console.log(`Executing: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: monorepoRoot });
    console.log(`Completed: ${command}`);
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    throw error; // Re-throw to be caught by the caller
  }
}

export async function initDataforgeCommand() {
  // Determine the monorepo root path.
  // Assuming this file is at packages/cli/src/commands/init-dataforge.ts
  // __dirname will be packages/cli/src/commands
  // ../ -> packages/cli/src
  // ../../ -> packages/cli
  // ../../../ -> packages
  // ../../../../ -> monorepo root
  const monorepoRoot = path.resolve(__dirname, '../../../../');
  console.log(`Monorepo root identified as: ${monorepoRoot}`);

  const commandsToExecute = [
    'pnpm --filter @repo/dataforge run forge:build',
    'pnpm --filter @repo/dataforge run forge:migrate generate InitialSchema',
    'pnpm --filter @repo/dataforge run forge:trigger:apply server',
    'pnpm --filter @repo/dataforge run forge:migrate run',
  ];

  try {
    console.log('Starting Dataforge initialization process...');

    for (const cmd of commandsToExecute) {
      executeCommand(cmd, monorepoRoot);
    }

    console.log('Dataforge initialization process completed successfully.');
  } catch (error) {
    console.error('Dataforge initialization process failed.');
    // The specific error is already logged by executeCommand
    throw error; // Re-throw for the main CLI handler
  }
}