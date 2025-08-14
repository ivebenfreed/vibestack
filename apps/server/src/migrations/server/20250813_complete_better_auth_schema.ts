import { Kysely, sql } from 'kysely'

/**
 * Complete Better Auth schema migration
 * Includes all tables needed for Better Auth with organization plugin:
 * - user, session, account, verification (core auth)
 * - organization, member, invitation (organization plugin)
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create user table
  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.unique().notNull())
    .addColumn('emailVerified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('image', 'text')
    .addColumn('role', 'text', (col) => col.defaultTo('user'))
    .addColumn('banned', 'boolean', (col) => col.defaultTo(false))
    .addColumn('banReason', 'text')
    .addColumn('banExpires', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create session table
  await db.schema
    .createTable('session')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('token', 'text', (col) => col.unique().notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('activeOrganizationId', 'text') // Will add FK after organization table
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create account table (for OAuth providers)
  await db.schema
    .createTable('account')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('idToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamptz')
    .addColumn('refreshTokenExpiresAt', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create verification table (for email OTP, magic links, etc.)
  await db.schema
    .createTable('verification')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create organization table
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

  // Create member table (user-organization relationships)
  await db.schema
    .createTable('member')
    .addColumn('id', 'text', (col) => col.primaryKey().defaultTo(sql`generate_uuidv7()`))
    .addColumn('organizationId', 'text', (col) => col.references('organization.id').onDelete('cascade').notNull())
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute()

  // Create invitation table
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

  // Add foreign key constraint from session to organization (after organization table exists)
  await db.schema
    .alterTable('session')
    .addForeignKeyConstraint('session_activeOrganizationId_fkey', ['activeOrganizationId'], 'organization', ['id'])
    .onDelete('set null')
    .execute()

  // Create indexes for better performance
  
  // User table indexes
  await db.schema
    .createIndex('user_email_idx')
    .on('user')
    .column('email')
    .execute()

  // Session table indexes
  await db.schema
    .createIndex('session_userId_idx')
    .on('session')
    .column('userId')
    .execute()

  await db.schema
    .createIndex('session_token_idx')
    .on('session')
    .column('token')
    .execute()

  // Account table indexes
  await db.schema
    .createIndex('account_userId_idx')
    .on('account')
    .column('userId')
    .execute()

  await db.schema
    .createIndex('account_provider_idx')
    .on('account')
    .columns(['providerId', 'accountId'])
    .execute()

  // Verification table indexes
  await db.schema
    .createIndex('verification_identifier_idx')
    .on('verification')
    .column('identifier')
    .execute()

  // Organization table indexes
  await db.schema
    .createIndex('organization_slug_idx')
    .on('organization')
    .column('slug')
    .execute()

  // Member table indexes
  await db.schema
    .createIndex('member_organizationId_idx')
    .on('member')
    .column('organizationId')
    .execute()

  await db.schema
    .createIndex('member_userId_idx')
    .on('member')
    .column('userId')
    .execute()

  // Unique constraint for member (one membership per user per org)
  await db.schema
    .createIndex('member_organization_user_unique')
    .on('member')
    .columns(['organizationId', 'userId'])
    .unique()
    .execute()

  // Invitation table indexes
  await db.schema
    .createIndex('invitation_organizationId_idx')
    .on('invitation')
    .column('organizationId')
    .execute()

  await db.schema
    .createIndex('invitation_email_organization_idx')
    .on('invitation')
    .columns(['email', 'organizationId'])
    .execute()

  await db.schema
    .createIndex('invitation_inviterId_idx')
    .on('invitation')
    .column('inviterId')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order due to foreign key constraints
  await db.schema.dropTable('invitation').ifExists().execute()
  await db.schema.dropTable('member').ifExists().execute()
  await db.schema.dropTable('organization').ifExists().execute()
  await db.schema.dropTable('verification').ifExists().execute()
  await db.schema.dropTable('account').ifExists().execute()
  await db.schema.dropTable('session').ifExists().execute()
  await db.schema.dropTable('user').ifExists().execute()
}