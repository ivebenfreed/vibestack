import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Drop existing organization tables to recreate with proper schema
  await db.schema.dropTable('member').ifExists().execute()
  await db.schema.dropTable('invitation').ifExists().execute()
  await db.schema.dropTable('organization').ifExists().execute()

  // Create organization table with Better Auth expected schema (camelCase)
  await db.schema
    .createTable('organization')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.unique().notNull())
    .addColumn('logo', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo('{}'))
    .execute()

  // Create member table with Better Auth expected schema (camelCase)
  await db.schema
    .createTable('member')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('organizationId', 'text', (col) => col.references('organization.id').onDelete('cascade').notNull())
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create invitation table with Better Auth expected schema (camelCase)
  await db.schema
    .createTable('invitation')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('organizationId', 'text', (col) => col.references('organization.id').onDelete('cascade').notNull())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('status', 'text', (col) => col.defaultTo('pending'))
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('inviterId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Add composite unique constraint on member for organizationId + userId
  await db.schema
    .createIndex('member_organization_user_unique')
    .on('member')
    .columns(['organizationId', 'userId'])
    .unique()
    .execute()

  // Add index on invitation for faster lookups
  await db.schema
    .createIndex('invitation_email_organization_idx')
    .on('invitation')
    .columns(['email', 'organizationId'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('invitation').ifExists().execute()
  await db.schema.dropTable('member').ifExists().execute()
  await db.schema.dropTable('organization').ifExists().execute()
}