import { Kysely, sql } from 'kysely'

/**
 * Personal Organizations Migration
 * 
 * Creates personal organizations for all existing users and migrates personal data.
 * This eliminates the dual ownership model (owner_user_id vs org-scoped) in favor 
 * of a unified organizational approach where every user has their own personal org.
 */
export async function up(db: Kysely<any>): Promise<void> {
  console.log('Creating personal organizations migration...')
  
  // Step 1: Add organization type field to distinguish personal vs business orgs
  await db.schema
    .alterTable('organization')
    .addColumn('type', 'text', (col) => col.defaultTo('business'))
    .addColumn('owner_user_id', 'text', (col) => col.references('user.id').onDelete('cascade'))
    .addColumn('auto_created', 'boolean', (col) => col.defaultTo(false))
    .execute()

  console.log('Added organization type and ownership fields')

  // Step 2: Create personal organizations for all existing users
  await sql`
    INSERT INTO organization (id, name, slug, type, owner_user_id, auto_created, "createdAt", "updatedAt")
    SELECT 
      generate_uuidv7() as id,
      COALESCE(u.name, 'User') || '''s Personal Workspace' as name,
      'personal-' || u.id as slug,
      'personal' as type,
      u.id as owner_user_id,
      true as auto_created,
      NOW() as "createdAt",
      NOW() as "updatedAt"
    FROM "user" u
    WHERE NOT EXISTS (
      SELECT 1 FROM organization o 
      WHERE o.type = 'personal' AND o.owner_user_id = u.id
    )
  `.execute(db)

  console.log('Created personal organizations for all users')

  // Step 3: Create membership records (user as owner of their personal org)
  await sql`
    INSERT INTO member (id, "organizationId", "userId", role, "createdAt", "updatedAt")
    SELECT 
      generate_uuidv7() as id,
      o.id as "organizationId",
      o.owner_user_id as "userId",
      'owner' as role,
      NOW() as "createdAt",
      NOW() as "updatedAt"
    FROM organization o 
    WHERE o.type = 'personal' 
    AND NOT EXISTS (
      SELECT 1 FROM member m 
      WHERE m."organizationId" = o.id AND m."userId" = o.owner_user_id
    )
  `.execute(db)

  console.log('Created owner memberships for personal organizations')

  // Step 4: Migrate personal worlds to personal organizations
  console.log('Migrating personal worlds...')
  
  // First, ensure all personal organizations exist
  const personalOrgs = await db
    .selectFrom('organization')
    .select(['id', 'owner_user_id'])
    .where('type', '=', 'personal')
    .execute()

  const orgByUserId = new Map(personalOrgs.map(org => [org.owner_user_id!, org.id]))

  // Migrate worlds that have owner_user_id to personal organizations
  const personalWorlds = await db
    .selectFrom('worlds')
    .select(['id', 'owner_user_id'])
    .where('owner_user_id', 'is not', null)
    .execute()

  for (const world of personalWorlds) {
    const personalOrgId = orgByUserId.get(world.owner_user_id!)
    if (personalOrgId) {
      await db
        .updateTable('worlds')
        .set({ 
          organization_id: personalOrgId,
          // Remove the universe_id concept as it becomes redundant
          universe_id: null 
        })
        .where('id', '=', world.id)
        .execute()
    }
  }

  console.log(`Migrated ${personalWorlds.length} personal worlds`)

  // Step 5: Migrate other personal entities (projects, tasks, etc.)
  // Check which tables have owner_user_id fields
  const tablesWithOwnerUserId = [
    'projects', 'tasks', 'documents', 'files', 'collections', 
    'discussions', 'activities', 'records'
  ]

  for (const tableName of tablesWithOwnerUserId) {
    try {
      // Check if table exists and has owner_user_id column
      const tableExists = await sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = ${tableName}
      `.execute(db)
      
      if (Number(tableExists.rows[0].count) === 0) {
        console.log(`Table ${tableName} does not exist, skipping`)
        continue
      }

      const columnExists = await sql`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = ${tableName} AND column_name = 'owner_user_id'
      `.execute(db)

      if (Number(columnExists.rows[0].count) === 0) {
        console.log(`Table ${tableName} does not have owner_user_id column, skipping`)
        continue
      }

      // Migrate personal entities in this table
      const result = await sql`
        UPDATE ${sql.table(tableName)}
        SET organization_id = o.id
        FROM organization o
        WHERE o.type = 'personal' 
        AND o.owner_user_id = ${sql.table(tableName)}.owner_user_id
        AND ${sql.table(tableName)}.owner_user_id IS NOT NULL
      `.execute(db)

      console.log(`Migrated ${result.numChangedRows || 0} records from ${tableName}`)
    } catch (error) {
      console.log(`Error migrating ${tableName}:`, error.message)
      // Continue with other tables
    }
  }

  // Step 6: Remove owner_user_id columns from all tables (after migration)
  console.log('Removing owner_user_id columns...')
  
  for (const tableName of ['worlds', ...tablesWithOwnerUserId]) {
    try {
      const columnExists = await sql`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = ${tableName} AND column_name = 'owner_user_id'
      `.execute(db)

      if (Number(columnExists.rows[0].count) > 0) {
        await sql`ALTER TABLE ${sql.table(tableName)} DROP COLUMN IF EXISTS owner_user_id`.execute(db)
        console.log(`Removed owner_user_id from ${tableName}`)
      }
    } catch (error) {
      console.log(`Error removing owner_user_id from ${tableName}:`, error.message)
    }
  }

  // Step 7: Remove universe_id column from worlds (redundant with personal orgs)
  try {
    await db.schema
      .alterTable('worlds')
      .dropColumn('universe_id')
      .execute()
    console.log('Removed universe_id from worlds table')
  } catch (error) {
    console.log('Error removing universe_id:', error.message)
  }

  // Step 8: Update organization table indexes
  await db.schema
    .createIndex('organization_type_idx')
    .on('organization')
    .column('type')
    .execute()

  await db.schema
    .createIndex('organization_owner_idx')
    .on('organization')
    .column('owner_user_id')
    .where('owner_user_id', 'is not', null)
    .execute()

  console.log('Personal organizations migration completed successfully!')
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('Rolling back personal organizations migration...')
  
  // This is a destructive rollback - we'll restore the owner_user_id pattern
  // but this should only be used in development/testing
  
  // Step 1: Add back owner_user_id columns to relevant tables
  const tablesNeedingOwnerUserId = ['worlds', 'projects', 'tasks', 'documents', 'files']
  
  for (const tableName of tablesNeedingOwnerUserId) {
    try {
      await sql`ALTER TABLE ${sql.table(tableName)} ADD COLUMN IF NOT EXISTS owner_user_id text`.execute(db)
      console.log(`Added owner_user_id back to ${tableName}`)
    } catch (error) {
      console.log(`Error adding owner_user_id to ${tableName}:`, error.message)
    }
  }

  // Step 2: Restore owner_user_id values from personal org ownership
  await sql`
    UPDATE worlds 
    SET owner_user_id = o.owner_user_id
    FROM organization o
    WHERE o.id = worlds.organization_id 
    AND o.type = 'personal'
  `.execute(db)

  // Step 3: Delete personal organizations and their memberships
  await db
    .deleteFrom('member')
    .where('organizationId', 'in', (eb) =>
      eb.selectFrom('organization')
        .select('id')
        .where('type', '=', 'personal')
    )
    .execute()

  await db
    .deleteFrom('organization')
    .where('type', '=', 'personal')
    .execute()

  // Step 4: Remove added columns from organization table
  await db.schema
    .alterTable('organization')
    .dropColumn('type')
    .dropColumn('owner_user_id')
    .dropColumn('auto_created')
    .execute()

  // Step 5: Add back universe_id to worlds
  await db.schema
    .alterTable('worlds')
    .addColumn('universe_id', 'text')
    .execute()

  console.log('Personal organizations rollback completed')
}