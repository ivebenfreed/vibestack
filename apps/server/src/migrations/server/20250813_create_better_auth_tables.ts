import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create Better Auth user table with camelCase columns (Better Auth default)
  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('name', 'text')
    .addColumn('email', 'text', (col) => col.unique().notNull())
    .addColumn('emailVerified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('image', 'text')
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create Better Auth session table
  await db.schema
    .createTable('session')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('token', 'text', (col) => col.unique().notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create Better Auth account table (for OAuth and password storage)
  await db.schema
    .createTable('account')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('accountId', 'text')
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamptz')
    .addColumn('refreshTokenExpiresAt', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('idToken', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create Better Auth verification table (for email verification, password reset, etc.)
  await db.schema
    .createTable('verification')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Add composite unique constraint on account for providerId + accountId
  await db.schema
    .createIndex('account_provider_account_unique')
    .on('account')
    .columns(['providerId', 'accountId'])
    .unique()
    .execute()

  // Add index on verification for faster lookups
  await db.schema
    .createIndex('verification_identifier_value_idx')
    .on('verification')
    .columns(['identifier', 'value'])
    .execute()

  // Add index on session for faster user lookups
  await db.schema
    .createIndex('session_userId_idx')
    .on('session')
    .column('userId')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order to handle foreign key constraints
  await db.schema.dropTable('verification').ifExists().execute()
  await db.schema.dropTable('account').ifExists().execute()
  await db.schema.dropTable('session').ifExists().execute()
  await db.schema.dropTable('user').ifExists().execute()
}