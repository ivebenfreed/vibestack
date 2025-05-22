import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// Helper to get __dirname in ESM
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const target = args[0];

if (!target || !['server', 'client', 'both'].includes(target)) {
  console.error(
    'Error: Invalid or missing target argument. Usage: node manage-trigger-migration.ts [server|client|both]',
  );
  process.exit(1);
}

const timestamp = Date.now();
const baseName = 'AddClientIdTriggers'; // This is the base name for the class and part of the file name.
const migrationClassName = `${baseName}${timestamp}`; // e.g., AddClientIdTriggers1678886400000
const migrationFileName = `${timestamp}-${baseName}.ts`; // e.g., 1678886400000-AddClientIdTriggers.ts

if (target === 'server' || target === 'both') {
  console.log('Processing server-side trigger migration...');
  const templatePath = path.resolve(
    __dirname,
    '../triggers/client-id-trigger.template.ts',
  );
  const serverMigrationsDir = path.resolve(__dirname, '../migrations/server');
  const newMigrationPath = path.join(serverMigrationsDir, migrationFileName);

  try {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    let modifiedContent = templateContent.replace(
      /AddDomainTableClientIdTriggers0/g,
      migrationClassName,
    );
    modifiedContent = modifiedContent.replace(
      /'AddDomainTableClientIdTriggers0'/g,
      `'${migrationClassName}'`,
    );
    fs.writeFileSync(newMigrationPath, modifiedContent);
    console.log(
      `Successfully created server trigger migration: ${newMigrationPath}`,
    );

    try {
      console.log('Attempting to run server migrations...');
      execSync('pnpm run migration:run:server', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../../'), // packages/dataforge
      });
      console.log('Server migrations ran successfully.');
    } catch (error) {
      console.error('Error running server migrations:', error);
    }
  } catch (error) {
    console.error('Error creating server trigger migration:', error);
  }
}

if (target === 'client') {
  console.log(
    'Client-side trigger management is specified but not yet implemented. No action taken for client.',
  );
}

if (target === 'both') {
  console.log(
    "Client-side trigger management (as part of 'both') is specified but not yet implemented. No client-specific action taken."
  );
}