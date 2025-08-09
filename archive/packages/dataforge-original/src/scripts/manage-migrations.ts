import { config } from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment handling
const currentEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
config({ path: path.resolve(__dirname, `../../.env.${currentEnv}`) });

// Load general .env file (environment-specific variables will take precedence)
config({ path: path.resolve(__dirname, `../../.env`), override: false });

const log = (message: string) => console.log(`[manage-migrations] ${message}`);
const logError = (message: string) => console.error(`[manage-migrations] ERROR: ${message}`);

const executeCommand = (command: string, errorMessage: string) => {
  try {
    log(`Executing: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: path.resolve(__dirname, '../../') }); // Run from package root
    log(`Successfully executed: ${command}`);
    return true;
  } catch (error) {
    logError(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
    // TypeORM's "No changes in database schema were found" is not a critical error for generation
    if (command.includes('migration:generate') && error instanceof Error && error.message.includes('No changes in database schema were found')) {
      log("TypeORM found no changes for schema generation, this is acceptable.");
      return true; // Treat as success for generation if it's just no changes
    }
    return false;
  }
};

const main = () => {
  const args = process.argv.slice(2);
  const action = args[0];
  const migrationName = args[1];

  log(`NODE_ENV: ${currentEnv}`);
  log(`Action: ${action}, Migration Name: ${migrationName || 'N/A'}`);

  let success = true;

  if (action === 'generate') {
    if (!migrationName) {
      logError('Migration name is required for the "generate" action.');
      process.exit(1);
    }

    // TypeORM CLI will add its own timestamp to the filename and use it in the class name.
    // We provide the directory and the base name for the migration.
    const serverMigrationPathArg = `src/migrations/server/${migrationName}`;
    const clientMigrationPathArg = `src/migrations/client/${migrationName}`;

    log(`Requesting server migration generation with base name: ${migrationName} in src/migrations/server`);
    if (!executeCommand(`pnpm run migration:generate:server ${serverMigrationPathArg}`, 'Failed to generate server migration')) {
      success = false;
    }

    log(`Requesting client migration generation with base name: ${migrationName} in src/migrations/client`);
    if (!executeCommand(`pnpm run migration:generate:client ${clientMigrationPathArg}`, 'Failed to generate client migration')) {
      success = false;
    }
  } else if (action === 'run') {
    if (!executeCommand('pnpm run migration:run:server', 'Failed to run server migrations')) {
      success = false;
    }
    if (success && !executeCommand('pnpm run migration:run:client', 'Failed to run client migrations')) {
      success = false;
    }
    if (success && !executeCommand('pnpm run migration:upload-client', 'Failed to upload client migrations')) {
      success = false;
    }
  } else {
    logError(`Invalid action: ${action}. Available actions are "generate <name>" and "run".`);
    process.exit(1);
  }

  if (success) {
    log('All operations completed successfully.');
    process.exit(0);
  } else {
    logError('One or more operations failed.');
    process.exit(1);
  }
};

main();