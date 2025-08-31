import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create entity_roles table for archetype-specific role assignments
  await db.schema
    .createTable('entity_roles')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuid_generate_v4')))
    .addColumn('entity_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('role', 'varchar(50)', (col) => col.notNull())
    .addColumn('permissions', 'jsonb', (col) => col.defaultTo('{}'))
    .addColumn('granted_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('granted_at', 'timestamptz', (col) => col.defaultTo(db.fn.now()).notNull())
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn.now()).notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn.now()).notNull())
    .execute();

  // Create unique constraint for entity + user combination
  await db.schema
    .createIndex('entity_roles_unique_entity_user')
    .on('entity_roles')
    .unique()
    .columns(['entity_type', 'entity_id', 'user_id'])
    .execute();

  // Create index for efficient lookups by entity
  await db.schema
    .createIndex('entity_roles_entity_lookup')
    .on('entity_roles')
    .columns(['entity_type', 'entity_id'])
    .execute();

  // Create index for efficient lookups by user
  await db.schema
    .createIndex('entity_roles_user_lookup')
    .on('entity_roles')
    .columns(['user_id'])
    .execute();

  // Create index for role-based queries
  await db.schema
    .createIndex('entity_roles_role_lookup')
    .on('entity_roles')
    .columns(['entity_type', 'role'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('entity_roles').execute();
}