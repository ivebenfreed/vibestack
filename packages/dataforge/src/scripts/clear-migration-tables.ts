import serverDataSource from '../datasources/server.js';
import clientDataSource from '../datasources/client.js';
import { DataSource } from 'typeorm';

interface ScriptFlags {
  server: boolean;
  published: boolean;
  liteLocal: boolean;
  all: boolean;
  help: boolean;
}

function parseArgs(): ScriptFlags {
  const args = process.argv.slice(2);
  const flags: ScriptFlags = {
    server: args.includes('--server'),
    published: args.includes('--published'),
    liteLocal: args.includes('--lite-local'),
    all: args.includes('--all'),
    help: args.includes('--help'),
  };

  // If no specific target flags are set, and --all is not set, default to all.
  if (!flags.server && !flags.published && !flags.liteLocal && !flags.all && !flags.help) {
    flags.all = true; // Default to all if no specific flags and not help
  } // Closing brace for the if statement
  return flags;
}

async function clearTable(dataSource: DataSource, tableName: string, friendlyName: string): Promise<void> {
  console.log(`Attempting to clear ${friendlyName} table (${tableName})...`);
  const queryRunner = dataSource.createQueryRunner();

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`TRUNCATE TABLE ${tableName} CASCADE;`);
    await queryRunner.commitTransaction();
    console.log(`Successfully cleared ${friendlyName} table (${tableName}).`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error(`Error clearing ${friendlyName} table (${tableName}):`, error);
    throw error; // Re-throw to be caught by the main error handler
  } finally {
    await queryRunner.release();
  }
}

function printHelpMessage(): void {
  console.log(`
Usage: node dist/scripts/clear-migration-tables.js [options]
       bun run packages/dataforge/src/scripts/clear-migration-tables.ts [options]

Options:
  --server          Clear server's own migration history (public.migrations on PostgreSQL)
  --published       Clear published client migrations list (public.client_migration on PostgreSQL)
  --lite-local      Clear local PGlite instance's migration history (public.migrations on PGlite)
  --all             Clear all above migration tables (default if no other option is specified)
  --help            Show this help message
  `);
}

async function runClearOperations(): Promise<void> {
  const flags = parseArgs();

  if (flags.help) {
    printHelpMessage();
    return;
  }

  let operationAttempted = false;

  if (flags.server || flags.all) {
    await clearTable(serverDataSource, 'public.migrations', "server DB history (public.migrations)");
    operationAttempted = true;
  }

  if (flags.published || flags.all) {
    await clearTable(serverDataSource, 'public.client_migration', "published client migrations (public.client_migration)");
    operationAttempted = true;
  }

  if (flags.liteLocal || flags.all) {
    await clearTable(clientDataSource, 'public.migrations', "local PGlite history (public.migrations)");
    operationAttempted = true;
  }

  if (!operationAttempted) {
    console.log("No valid operations specified. Use --help for options.");
  }
}

(async () => {
  try {
    await runClearOperations();
    console.log('Migration table clearing process finished.');
  } catch (error) {
    // Specific errors are logged in clearTable, this is a final catch-all
    console.error('Error during migration table clearing process. See details above.');
    process.exit(1);
  } finally {
    // Ensure datasources are destroyed if they were initialized
    if (serverDataSource.isInitialized) {
      await serverDataSource.destroy();
      console.log('Server datasource destroyed.');
    }
    if (clientDataSource.isInitialized) {
      await clientDataSource.destroy();
      console.log('Client datasource destroyed.');
    }
  }
})();