/**
 * Restore Organization Tables
 * 
 * Recreates the essential organization tables that were accidentally dropped
 */

const { Client } = require('pg');

async function restoreOrganizationTables() {
  console.log('🔧 Restoring organization tables...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Create organization table
    console.log('📋 Creating organization table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "organization" (
        id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        settings JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active'
      );
    `);
    
    // Create organization_members table
    console.log('👥 Creating organization_members table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, user_id)
      );
    `);
    
    // Create indexes
    console.log('🔍 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organization_slug ON "organization"(slug);
      CREATE INDEX IF NOT EXISTS idx_organization_members_org ON "organization_members"(organization_id);
      CREATE INDEX IF NOT EXISTS idx_organization_members_user ON "organization_members"(user_id);
    `);
    
    // Recreate TechFlow organization
    console.log('🏢 Recreating TechFlow organization...');
    const techflowOrgId = '108b0ac2-487f-4951-b295-b1924288daad';
    
    await client.query(`
      INSERT INTO "organization" (id, name, slug, created_at, updated_at) 
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        updated_at = NOW()
    `, [techflowOrgId, 'TechFlow Solutions', 'techflow-solutions']);
    
    // Find admin user and add to organization
    console.log('👤 Adding admin user to TechFlow organization...');
    const adminResult = await client.query(`
      SELECT id FROM "user" WHERE email = 'admin@techflow.solutions'
    `);
    
    if (adminResult.rows.length > 0) {
      const adminUserId = adminResult.rows[0].id;
      await client.query(`
        INSERT INTO "organization_members" (organization_id, user_id, role, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          updated_at = NOW()
      `, [techflowOrgId, adminUserId, 'owner']);
      
      console.log(`✅ Admin user added as owner of TechFlow organization`);
    } else {
      console.log('⚠️  Admin user not found - you may need to recreate it');
    }
    
    // Verify the setup
    console.log('\\n✅ Verification:');
    
    const orgCount = await client.query('SELECT COUNT(*) FROM "organization"');
    const memberCount = await client.query('SELECT COUNT(*) FROM "organization_members"');
    
    console.log(`   Organizations: ${orgCount.rows[0].count}`);
    console.log(`   Organization members: ${memberCount.rows[0].count}`);
    
    // Show organization details
    const orgDetails = await client.query(`
      SELECT o.name, o.slug, COUNT(om.user_id) as member_count
      FROM "organization" o
      LEFT JOIN "organization_members" om ON o.id = om.organization_id
      GROUP BY o.id, o.name, o.slug
    `);
    
    console.log('\\n📊 Organization details:');
    orgDetails.rows.forEach(org => {
      console.log(`   - ${org.name} (${org.slug}): ${org.member_count} members`);
    });
    
    console.log('\\n🎉 Organization tables restored successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error restoring organization tables:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the restoration
restoreOrganizationTables()
  .then(success => {
    if (success) {
      console.log('\\n✅ Organization table restoration completed');
      process.exit(0);
    } else {
      console.log('\\n❌ Organization table restoration failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Restoration error:', error.message);
    process.exit(1);
  });