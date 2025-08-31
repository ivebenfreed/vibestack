import { Kysely, PostgresDialect } from 'kysely';
import pkg from 'pg';
const { Pool } = pkg;

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: "postgres://postgres:postgres@localhost:5432/vibestack_dev",
    }),
  }),
});

console.log('Running entity_roles table migration...');

// Create entity_roles table
await db.schema
  .createTable('entity_roles')
  .ifNotExists()
  .addColumn('id', 'uuid', (col) => col.primaryKey())
  .addColumn('entity_type', 'varchar(50)', (col) => col.notNull())
  .addColumn('entity_id', 'uuid', (col) => col.notNull())
  .addColumn('user_id', 'uuid', (col) => col.notNull())
  .addColumn('role', 'varchar(50)', (col) => col.notNull())
  .addColumn('permissions', 'jsonb', (col) => col.defaultTo('{}'))
  .addColumn('granted_by', 'uuid')
  .addColumn('granted_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')).notNull())
  .addColumn('expires_at', 'timestamptz')
  .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')).notNull())
  .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')).notNull())
  .execute();

// Create indexes
await db.schema
  .createIndex('entity_roles_unique_entity_user')
  .ifNotExists()
  .on('entity_roles')
  .unique()
  .columns(['entity_type', 'entity_id', 'user_id'])
  .execute();

await db.schema
  .createIndex('entity_roles_entity_lookup')
  .ifNotExists()
  .on('entity_roles')
  .columns(['entity_type', 'entity_id'])
  .execute();

await db.schema
  .createIndex('entity_roles_user_lookup')
  .ifNotExists()
  .on('entity_roles')
  .columns(['user_id'])
  .execute();

await db.schema
  .createIndex('entity_roles_role_lookup')
  .ifNotExists()
  .on('entity_roles')
  .columns(['entity_type', 'role'])
  .execute();

console.log('✅ Entity roles table migration completed successfully');
await db.destroy();