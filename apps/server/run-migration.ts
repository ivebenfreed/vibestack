/**
 * Migration Runner
 * Runs Kysely migrations manually
 */

import { getKysely } from './src/lib/kysely';
import { up as createBetterAuthTables } from './src/migrations/server/20250813_create_better_auth_tables';
import { up as createCompleteSchema } from './src/migrations/server/20250813_complete_better_auth_schema';

async function runMigrations() {
  // Get environment variables
  const env = {
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev',
    ENVIRONMENT: process.env.ENVIRONMENT || 'development'
  };

  console.log('🔧 Getting Kysely instance...');
  const db = getKysely(env as any);

  try {
    console.log('🔧 Running Better Auth tables migration...');
    await createBetterAuthTables(db);
    console.log('✅ Better Auth tables migration completed');

    console.log('🔧 Running complete schema migration...');
    await createCompleteSchema(db);
    console.log('✅ Complete schema migration completed');

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations().catch(console.error);