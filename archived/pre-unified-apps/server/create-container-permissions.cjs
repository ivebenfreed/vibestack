/**
 * Create container permissions for TechFlow test users
 * 
 * Sets up the container permission system with different access levels:
 * - Owner: Full access to all organization data
 * - Admin: Access to most data, some restrictions
 * - Manager: Access to project data they manage
 * - Member: Access to assigned tasks and projects
 */

const { Client } = require('pg');

const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad';

// Test users from our setup
const USERS = {
  OWNER: {
    email: 'admin@techflow.solutions',
    userId: '0198aed6-cc0b-783b-b414-c5fb8a81f227',
    role: 'owner'
  },
  ADMIN: {
    email: 'sarah.admin.test@techflow.com',
    userId: '0198af8e-0609-77f0-bd00-ec21a593efa9',
    role: 'admin'
  },
  MANAGER: {
    email: 'michael.manager.test@techflow.com',
    userId: '0198af8e-14b0-7188-81a0-2f557a5bd0d8',
    role: 'manager'
  },
  MEMBER: {
    email: 'emily.member.test@techflow.com',
    userId: '0198af8e-1d41-7600-8570-210ecce15c4f',
    role: 'member'
  }
};

async function createContainerPermissions() {
  console.log('🔐 Creating container permissions for TechFlow users...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // First, ensure the container_permission table exists
    console.log('📋 Checking container_permission table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'container_permission'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('📦 Creating container_permission table...');
      
      // Create the table based on ContainerPermission entity
      await client.query(`
        CREATE TABLE IF NOT EXISTS "container_permission" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          status VARCHAR(50) DEFAULT 'active' NOT NULL,
          archetype VARCHAR(100) DEFAULT 'permission' NOT NULL,
          container_type VARCHAR(50) DEFAULT 'system' NOT NULL,
          container_id VARCHAR(255) DEFAULT 'permissions' NOT NULL,
          user_id UUID NOT NULL REFERENCES "user"(id),
          permission_container_type VARCHAR(50) NOT NULL,
          permission_container_id UUID NOT NULL,
          role VARCHAR(50) DEFAULT 'viewer' NOT NULL,
          granted_at TIMESTAMPTZ DEFAULT NOW(),
          granted_by_id UUID REFERENCES "user"(id),
          expires_at TIMESTAMPTZ,
          restrictions JSONB DEFAULT '{}' NOT NULL,
          CONSTRAINT unique_user_container_permission UNIQUE (user_id, permission_container_type, permission_container_id),
          CONSTRAINT chk_valid_role CHECK (role IN ('admin', 'owner', 'manager', 'member', 'contributor', 'viewer')),
          CONSTRAINT chk_expiry_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at)
        );
      `);
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_container_permission_user ON "container_permission"(user_id);
        CREATE INDEX IF NOT EXISTS idx_container_permission_container ON "container_permission"(permission_container_type, permission_container_id);
        CREATE INDEX IF NOT EXISTS idx_container_permission_role ON "container_permission"(role);
        CREATE INDEX IF NOT EXISTS idx_container_permission_granted_at ON "container_permission"(granted_at);
        CREATE INDEX IF NOT EXISTS idx_container_permission_expires_at ON "container_permission"(expires_at);
        CREATE INDEX IF NOT EXISTS idx_container_permission_granted_by ON "container_permission"(granted_by_id);
        CREATE INDEX IF NOT EXISTS idx_container_permission_restrictions ON "container_permission" USING GIN(restrictions);
        CREATE INDEX IF NOT EXISTS idx_container_permission_active ON "container_permission"(user_id, permission_container_type, permission_container_id) WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW());
      `);
      
      console.log('✅ Container permission table created');
    } else {
      console.log('✅ Container permission table already exists');
    }
    
    // Clear any existing permissions for these users
    console.log('🧹 Clearing existing container permissions...');
    const userIds = Object.values(USERS).map(u => u.userId);
    await client.query(`
      DELETE FROM container_permission 
      WHERE user_id = ANY($1) 
      AND permission_container_type IN ('organization', 'project')
    `, [userIds]);
    
    console.log('✅ Existing permissions cleared');
    
    // Create organization-level permissions for all users
    for (const [roleKey, user] of Object.entries(USERS)) {
      console.log(`\\n👤 Creating organization permissions for ${user.role}: ${user.email}`);
      
      const permissionId = require('crypto').randomUUID();
      
      await client.query(`
        INSERT INTO container_permission (
          id, user_id, permission_container_type, permission_container_id,
          role, granted_at, granted_by_id, expires_at, restrictions,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        permissionId,
        user.userId,
        'organization',
        TECHFLOW_ORG_ID,
        user.role,
        new Date(),
        USERS.OWNER.userId, // Granted by owner
        null, // No expiration
        {}, // No restrictions for now
        'active',
        new Date(),
        new Date()
      ]);
      
      console.log(`   ✅ Organization ${user.role} permission created (${permissionId.substring(0, 8)}...)`);
    }
    
    // Get project IDs from the organization tables
    console.log('\\n🔍 Finding projects for project-level permissions...');
    const projectResult = await client.query(`
      SELECT id, name, assigned_to, created_by 
      FROM org_108b0ac2_487f_4951_b295_b1924288daad_project 
      ORDER BY created_at
    `);
    
    console.log(`Found ${projectResult.rows.length} projects:`);
    projectResult.rows.forEach(project => {
      console.log(`   - ${project.name} (${project.id.substring(0, 8)}...)`);
    });
    
    // Create project-level permissions for specific scenarios
    if (projectResult.rows.length > 0) {
      console.log('\\n🏢 Creating project-level permissions...');
      
      // Example: Give manager specific access to first project
      if (projectResult.rows.length > 0) {
        const firstProject = projectResult.rows[0];
        const permissionId = require('crypto').randomUUID();
        
        await client.query(`
          INSERT INTO container_permission (
            id, user_id, permission_container_type, permission_container_id,
            role, granted_at, granted_by_id, expires_at, restrictions,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          permissionId,
          USERS.MANAGER.userId,
          'project',
          firstProject.id,
          'manager',
          new Date(),
          USERS.OWNER.userId,
          null,
          { canEditBudget: true, canAssignTasks: true },
          'active',
          new Date(),
          new Date()
        ]);
        
        console.log(`   ✅ Manager project permission: ${firstProject.name}`);
      }
      
      // Example: Give member access to second project as contributor
      if (projectResult.rows.length > 1) {
        const secondProject = projectResult.rows[1];
        const permissionId = require('crypto').randomUUID();
        
        await client.query(`
          INSERT INTO container_permission (
            id, user_id, permission_container_type, permission_container_id,
            role, granted_at, granted_by_id, expires_at, restrictions,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          permissionId,
          USERS.MEMBER.userId,
          'project',
          secondProject.id,
          'contributor',
          new Date(),
          USERS.OWNER.userId,
          null,
          { canViewBudget: false, canEditTasks: true },
          'active',
          new Date(),
          new Date()
        ]);
        
        console.log(`   ✅ Member project permission: ${secondProject.name}`);
      }
    }
    
    // Verify the setup
    console.log('\\n📊 Verification: Container permissions summary:');
    const permissionsResult = await client.query(`
      SELECT 
        u.email,
        cp.permission_container_type,
        cp.permission_container_id,
        cp.role,
        cp.restrictions,
        CASE 
          WHEN cp.permission_container_type = 'organization' THEN 'TechFlow Org'
          WHEN cp.permission_container_type = 'project' THEN (
            SELECT name FROM org_108b0ac2_487f_4951_b295_b1924288daad_project 
            WHERE id = cp.permission_container_id::uuid
          )
          ELSE cp.permission_container_id
        END as container_name
      FROM container_permission cp
      JOIN "user" u ON u.id = cp.user_id
      WHERE cp.user_id = ANY($1)
      ORDER BY u.email, cp.permission_container_type, cp.role DESC
    `, [userIds]);
    
    permissionsResult.rows.forEach(perm => {
      const restrictions = Object.keys(perm.restrictions || {}).length > 0 
        ? ` (${Object.keys(perm.restrictions).join(', ')})` 
        : '';
      console.log(`   ${perm.email}: ${perm.role.toUpperCase()} on ${perm.permission_container_type}:${perm.container_name}${restrictions}`);
    });
    
    console.log('\\n🎉 Container permissions successfully created!');
    return true;
    
  } catch (error) {
    console.error('❌ Error creating container permissions:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the script
createContainerPermissions()
  .then(success => {
    if (success) {
      console.log('\\n✅ Container permissions setup completed');
      process.exit(0);
    } else {
      console.log('\\n❌ Container permissions setup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Setup error:', error.message);
    process.exit(1);
  });