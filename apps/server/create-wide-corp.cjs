/**
 * Create "Wide Corp" Test Organization
 * 
 * Scenario: Software consultancy with diverse service offerings
 * - Tables: 12+ entity types (many tables, few records)
 * - Records: 2-5 records per table (~50 total records)
 * - Users: 8 users with varied permission combinations
 * - Focus: Test table discovery, permission complexity, schema diversity
 */

const { Client } = require('pg');

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

async function createWideCorp() {
  console.log('🏢 Creating Wide Corp test organization...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Create Wide Corp organization
    console.log('📋 Creating Wide Corp organization...');
    await client.query(`
      INSERT INTO organizations (id, name, slug, created_at, updated_at, settings) 
      VALUES ($1, $2, $3, NOW(), NOW(), $4)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        updated_at = NOW()
    `, [
      WIDE_CORP_ORG_ID,
      'Wide Corp Solutions',
      'wide-corp',
      JSON.stringify({
        industry: 'Software Consulting',
        company_size: '11-50',
        timezone: 'America/New_York'
      })
    ]);
    
    // Create 12 diverse entity tables for Wide Corp
    console.log('📦 Creating 12 diverse entity tables...');
    
    const tablePrefix = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_`;
    
    const entityTables = [
      // Core business entities
      {
        name: 'client',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          name VARCHAR(255) NOT NULL,
          industry VARCHAR(100),
          contact_email VARCHAR(255),
          contract_value DECIMAL(10,2),
          status VARCHAR(50) DEFAULT 'active',
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'project',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          client_id TEXT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          project_type VARCHAR(100),
          budget DECIMAL(10,2),
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'planning',
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'contract',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          client_id TEXT,
          project_id TEXT,
          contract_number VARCHAR(100) UNIQUE,
          value DECIMAL(10,2),
          signed_date DATE,
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'draft',
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'invoice',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          client_id TEXT,
          project_id TEXT,
          invoice_number VARCHAR(100) UNIQUE,
          amount DECIMAL(10,2),
          due_date DATE,
          status VARCHAR(50) DEFAULT 'draft',
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'timesheet',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          project_id TEXT,
          user_id TEXT,
          date DATE,
          hours DECIMAL(4,2),
          description TEXT,
          billable BOOLEAN DEFAULT true,
          rate DECIMAL(6,2),
          status VARCHAR(50) DEFAULT 'submitted',
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'expense',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          project_id TEXT,
          user_id TEXT,
          category VARCHAR(100),
          amount DECIMAL(8,2),
          description TEXT,
          receipt_url VARCHAR(255),
          date DATE,
          status VARCHAR(50) DEFAULT 'pending',
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'resource',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100),
          description TEXT,
          availability_status VARCHAR(50) DEFAULT 'available',
          hourly_rate DECIMAL(6,2),
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'skill',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100),
          description TEXT,
          level VARCHAR(50),
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'certification',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          user_id TEXT,
          name VARCHAR(255) NOT NULL,
          issuer VARCHAR(255),
          issue_date DATE,
          expiry_date DATE,
          credential_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'proposal',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          client_id TEXT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          estimated_value DECIMAL(10,2),
          estimated_duration INTEGER,
          status VARCHAR(50) DEFAULT 'draft',
          submitted_date DATE,
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'meeting',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          project_id TEXT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          meeting_date TIMESTAMPTZ,
          duration INTEGER,
          location VARCHAR(255),
          meeting_type VARCHAR(50),
          status VARCHAR(50) DEFAULT 'scheduled',
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'document',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${WIDE_CORP_ORG_ID}',
          project_id TEXT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          file_url VARCHAR(255),
          file_size INTEGER,
          file_type VARCHAR(100),
          version VARCHAR(50) DEFAULT '1.0',
          status VARCHAR(50) DEFAULT 'draft',
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      }
    ];
    
    // Create all tables
    for (const table of entityTables) {
      const tableName = `${tablePrefix}${table.name}`;
      console.log(`   Creating table: ${tableName}`);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          ${table.columns}
        );
      `);
    }
    
    console.log(`✅ Created ${entityTables.length} entity tables`);
    
    // Create 8 test users with varied roles using Better Auth API
    console.log('👥 Creating 8 test users via API...');
    
    const testUsers = [
      { email: 'ceo@widecorp.com', name: 'Alice CEO', role: 'owner', password: 'WideOwner123!' },
      { email: 'cto@widecorp.com', name: 'Bob CTO', role: 'admin', password: 'WideAdmin456!' },
      { email: 'pm1@widecorp.com', name: 'Carol PM', role: 'manager', password: 'WideManager789!' },
      { email: 'pm2@widecorp.com', name: 'David PM', role: 'manager', password: 'WideManager012!' },
      { email: 'dev1@widecorp.com', name: 'Eve Developer', role: 'member', password: 'WideMember345!' },
      { email: 'dev2@widecorp.com', name: 'Frank Developer', role: 'member', password: 'WideMember678!' },
      { email: 'designer@widecorp.com', name: 'Grace Designer', role: 'contributor', password: 'WideContrib901!' },
      { email: 'intern@widecorp.com', name: 'Henry Intern', role: 'viewer', password: 'WideViewer234!' }
    ];
    
    const userIds = [];
    for (const user of testUsers) {
      try {
        // Create user via Better Auth API
        const signupResponse = await fetch('http://localhost:8787/api/auth/sign-up/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password,
            name: user.name
          })
        });
        
        if (!signupResponse.ok) {
          const errorText = await signupResponse.text();
          console.log(`   ⚠️  User ${user.email} may already exist: ${errorText}`);
          
          // Try to get existing user ID
          const existingUser = await client.query(`
            SELECT id FROM "user" WHERE email = $1
          `, [user.email]);
          
          if (existingUser.rows.length > 0) {
            const userId = existingUser.rows[0].id;
            userIds.push({ ...user, userId });
            console.log(`   ✓ Using existing user: ${user.name} (${user.role})`);
          } else {
            console.log(`   ❌ Failed to create/find user: ${user.email}`);
            continue;
          }
        } else {
          const signupData = await signupResponse.json();
          const userId = signupData.user?.id;
          
          if (userId) {
            userIds.push({ ...user, userId });
            console.log(`   ✓ Created user: ${user.name} (${user.role})`);
          } else {
            console.log(`   ❌ API signup succeeded but no user ID returned for: ${user.email}`);
            continue;
          }
        }
        
        // Add to organization
        const lastUserIndex = userIds.length - 1;
        if (lastUserIndex >= 0) {
          await client.query(`
            INSERT INTO organization_members (organization_id, user_id, role, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (organization_id, user_id) DO UPDATE SET
              role = EXCLUDED.role,
              updated_at = NOW()
          `, [WIDE_CORP_ORG_ID, userIds[lastUserIndex].userId, user.role]);
        }
        
      } catch (error) {
        console.log(`   ❌ Error creating user ${user.email}: ${error.message}`);
        continue;
      }
    }
    
    // Create sample data (2-5 records per table)
    console.log('📝 Creating sample data...');
    
    // Sample clients (3 records)
    const clients = [
      { name: 'Tech Startup Inc', industry: 'Technology', contact_email: 'ceo@techstartup.com', contract_value: 50000, created_by: userIds[0].userId, assigned_to: userIds[2].userId },
      { name: 'Healthcare Solutions', industry: 'Healthcare', contact_email: 'admin@healthsol.com', contract_value: 75000, created_by: userIds[1].userId, assigned_to: userIds[3].userId },
      { name: 'Finance Corp', industry: 'Finance', contact_email: 'contact@financecorp.com', contract_value: 100000, created_by: userIds[0].userId, assigned_to: userIds[2].userId }
    ];
    
    const clientIds = [];
    for (const clientData of clients) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}client" (name, industry, contact_email, contract_value, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [clientData.name, clientData.industry, clientData.contact_email, clientData.contract_value, clientData.created_by, clientData.assigned_to]);
      clientIds.push(result.rows[0].id);
    }
    
    // Sample projects (4 records)
    const projects = [
      { name: 'Mobile App Development', client_id: clientIds[0], project_type: 'Mobile Development', budget: 30000, status: 'active', created_by: userIds[2].userId, assigned_to: userIds[4].userId },
      { name: 'Web Platform Redesign', client_id: clientIds[1], project_type: 'Web Development', budget: 45000, status: 'active', created_by: userIds[3].userId, assigned_to: userIds[5].userId },
      { name: 'API Integration', client_id: clientIds[2], project_type: 'Backend Development', budget: 25000, status: 'planning', created_by: userIds[2].userId, assigned_to: userIds[4].userId },
      { name: 'UI/UX Consulting', client_id: clientIds[0], project_type: 'Design', budget: 15000, status: 'complete', created_by: userIds[3].userId, assigned_to: userIds[6].userId }
    ];
    
    const projectIds = [];
    for (const project of projects) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}project" (name, client_id, project_type, budget, status, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [project.name, project.client_id, project.project_type, project.budget, project.status, project.created_by, project.assigned_to]);
      projectIds.push(result.rows[0].id);
    }
    
    // Add sample data for other tables (2-3 records each)
    // Timesheets (5 records)
    for (let i = 0; i < 5; i++) {
      await client.query(`
        INSERT INTO "${tablePrefix}timesheet" (project_id, user_id, date, hours, description, billable, rate, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        projectIds[i % projectIds.length],
        userIds[4 + (i % 4)].userId,
        new Date(2025, 0, 15 + i),
        8.0 - (i * 0.5),
        `Development work day ${i + 1}`,
        true,
        125.00,
        userIds[4 + (i % 4)].userId
      ]);
    }
    
    // Skills (4 records)
    const skills = ['React Development', 'Node.js', 'UI/UX Design', 'Project Management'];
    for (let i = 0; i < skills.length; i++) {
      await client.query(`
        INSERT INTO "${tablePrefix}skill" (name, category, description, level, created_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [skills[i], 'Technical', `${skills[i]} expertise`, 'Senior', userIds[i % userIds.length].userId]);
    }
    
    // Resources (3 records)
    const resources = [
      { name: 'Senior Developer', type: 'Human Resource', hourly_rate: 150.00 },
      { name: 'Design Studio', type: 'Facility', hourly_rate: 75.00 },
      { name: 'Development Server', type: 'Equipment', hourly_rate: 25.00 }
    ];
    
    for (const resource of resources) {
      await client.query(`
        INSERT INTO "${tablePrefix}resource" (name, type, hourly_rate, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5)
      `, [resource.name, resource.type, resource.hourly_rate, userIds[1].userId, userIds[2].userId]);
    }
    
    console.log('✅ Sample data created');
    
    // Create container permissions for diverse access patterns
    console.log('🔐 Creating container permissions...');
    
    // Organization-level permissions for all users
    for (const user of userIds) {
      await client.query(`
        INSERT INTO container_permission (user_id, permission_container_type, permission_container_id, role, granted_at, granted_by_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), $5, 'active', NOW(), NOW())
        ON CONFLICT (user_id, permission_container_type, permission_container_id) DO UPDATE SET
          role = EXCLUDED.role,
          updated_at = NOW()
      `, [user.userId, 'organization', WIDE_CORP_ORG_ID, user.role, userIds[0].userId]);
    }
    
    // Project-specific permissions (some users get specific project access)
    await client.query(`
      INSERT INTO container_permission (user_id, permission_container_type, permission_container_id, role, granted_at, granted_by_id, restrictions, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'active', NOW(), NOW())
    `, [
      userIds[6].userId, // Designer
      'project',
      projectIds[3], // UI/UX project
      'manager',
      userIds[0].userId,
      JSON.stringify({ canEditBudget: true, canManageTeam: true })
    ]);
    
    console.log('✅ Container permissions created');
    
    // Verification
    console.log('\\n📊 Wide Corp Organization Summary:');
    console.log('=====================================');
    
    const tableCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name LIKE '${tablePrefix}%'
    `);
    
    const userCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM organization_members 
      WHERE organization_id = $1
    `, [WIDE_CORP_ORG_ID]);
    
    const permissionCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM container_permission 
      WHERE permission_container_id = $1
    `, [WIDE_CORP_ORG_ID]);
    
    console.log(`📦 Tables created: ${tableCount.rows[0].count}`);
    console.log(`👥 Users: ${userCount.rows[0].count}`);
    console.log(`🔐 Permissions: ${permissionCount.rows[0].count}`);
    
    // Show sample record counts
    console.log('\\n📈 Sample data counts:');
    for (const table of ['client', 'project', 'timesheet', 'skill', 'resource']) {
      const count = await client.query(`SELECT COUNT(*) as count FROM "${tablePrefix}${table}"`);
      console.log(`   ${table}: ${count.rows[0].count} records`);
    }
    
    console.log('\\n🎉 Wide Corp test organization created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error creating Wide Corp:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the creation
createWideCorp()
  .then(success => {
    if (success) {
      console.log('\\n✅ Wide Corp creation completed');
      console.log('\\n📋 Test this scenario with:');
      console.log('   node test-wide-corp-sync.cjs');
      process.exit(0);
    } else {
      console.log('\\n❌ Wide Corp creation failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Creation error:', error.message);
    process.exit(1);
  });