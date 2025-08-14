import { Kysely, sql } from 'kysely'

/**
 * Create PostgreSQL backup tables for Durable Object data
 * This ensures entity schema persistence even when DOs reset
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Table to backup OrgSchemaDO entity configurations
  await db.schema
    .createTable('dataforge_entity_configs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('organization_id', 'uuid', (col) => col.references('organization.id').onDelete('cascade').notNull())
    .addColumn('entity_name', 'text', (col) => col.notNull())
    .addColumn('definition', 'jsonb', (col) => col.notNull())
    .addColumn('table_name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Table to backup OrgSchemaDO full schema state
  await db.schema
    .createTable('dataforge_org_schemas')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('organization_id', 'uuid', (col) => col.references('organization.id').onDelete('cascade').notNull().unique())
    .addColumn('schema_data', 'jsonb', (col) => col.notNull())
    .addColumn('version', 'text', (col) => col.defaultTo('1.0.0'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Table to backup SuperAdminDO platform data
  await db.schema
    .createTable('dataforge_platform_config')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('config_key', 'text', (col) => col.notNull().unique())
    .addColumn('config_value', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create indexes for efficient lookups
  await db.schema
    .createIndex('dataforge_entity_configs_org_entity_idx')
    .on('dataforge_entity_configs')
    .columns(['organization_id', 'entity_name'])
    .unique()
    .execute()

  await db.schema
    .createIndex('dataforge_entity_configs_table_name_idx')
    .on('dataforge_entity_configs')
    .column('table_name')
    .execute()

  await db.schema
    .createIndex('dataforge_org_schemas_org_idx')
    .on('dataforge_org_schemas')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('dataforge_platform_config_key_idx')
    .on('dataforge_platform_config')
    .column('config_key')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('dataforge_platform_config').ifExists().execute()
  await db.schema.dropTable('dataforge_org_schemas').ifExists().execute()
  await db.schema.dropTable('dataforge_entity_configs').ifExists().execute()
}