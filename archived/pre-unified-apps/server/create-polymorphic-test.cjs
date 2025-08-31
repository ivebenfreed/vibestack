/**
 * Create Polymorphic Test Organization
 * 
 * Scenario: Advanced CRM with polymorphic relationships and complex options
 * - Tables: Entities with polymorphic relationships (comments, attachments, etc.)
 * - System Options: Test all sync system options
 * - Custom Options: Test custom sync options and behaviors
 * - Polymorphic: Test relationships that can reference multiple table types
 */

const { Client } = require('pg');

const POLY_ORG_ID = '01920000-2000-7000-8000-000000000002';

async function createPolymorphicTest() {
  console.log('🔗 Creating Polymorphic Test organization...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Create Polymorphic Test organization
    console.log('📋 Creating Polymorphic Test organization...');
    await client.query(`
      INSERT INTO organizations (id, name, slug, created_at, updated_at, settings) 
      VALUES ($1, $2, $3, NOW(), NOW(), $4)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        updated_at = NOW()
    `, [
      POLY_ORG_ID,
      'Polymorphic Test CRM',
      'polymorphic-test',
      JSON.stringify({
        industry: 'SaaS',
        company_size: '51-200',
        timezone: 'America/Los_Angeles',
        sync_options: {
          enable_polymorphic: true,
          enable_custom_filtering: true,
          enable_system_options: true
        }
      })
    ]);
    
    const tablePrefix = `org_${POLY_ORG_ID.replace(/-/g, '_')}_`;
    
    // Core entities that will be referenced polymorphically
    console.log('📦 Creating core entities...');
    
    const coreEntities = [
      {
        name: 'contact',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          company VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'deal',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          title VARCHAR(255) NOT NULL,
          value DECIMAL(12,2),
          stage VARCHAR(100),
          probability INTEGER DEFAULT 50,
          close_date DATE,
          contact_id TEXT,
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'ticket',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          subject VARCHAR(255) NOT NULL,
          description TEXT,
          priority VARCHAR(50) DEFAULT 'medium',
          status VARCHAR(50) DEFAULT 'open',
          contact_id TEXT,
          assigned_to TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      }
    ];
    
    // Polymorphic entities that can reference multiple types
    console.log('🔗 Creating polymorphic entities...');
    
    const polymorphicEntities = [
      {
        name: 'comment',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          commentable_type VARCHAR(100) NOT NULL,
          commentable_id TEXT NOT NULL,
          content TEXT NOT NULL,
          author_id TEXT,
          is_internal BOOLEAN DEFAULT false,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'attachment',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          attachable_type VARCHAR(100) NOT NULL,
          attachable_id TEXT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          file_url VARCHAR(500),
          file_size INTEGER,
          mime_type VARCHAR(100),
          uploaded_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'activity',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          subject_type VARCHAR(100) NOT NULL,
          subject_id TEXT NOT NULL,
          activity_type VARCHAR(100) NOT NULL,
          description TEXT,
          metadata JSONB,
          performed_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'tag',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7),
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'tagging',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          tag_id TEXT NOT NULL,
          taggable_type VARCHAR(100) NOT NULL,
          taggable_id TEXT NOT NULL,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        `
      }
    ];
    
    // System configuration entities
    console.log('⚙️ Creating system configuration entities...');
    
    const systemEntities = [
      {
        name: 'custom_field_definition',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          entity_type VARCHAR(100) NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          field_type VARCHAR(50) NOT NULL,
          field_options JSONB,
          is_required BOOLEAN DEFAULT false,
          display_order INTEGER DEFAULT 0,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'custom_field_value',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          field_definition_id TEXT NOT NULL,
          entity_type VARCHAR(100) NOT NULL,
          entity_id TEXT NOT NULL,
          value_text TEXT,
          value_number DECIMAL(15,4),
          value_date DATE,
          value_boolean BOOLEAN,
          value_json JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      },
      {
        name: 'sync_configuration',
        columns: `
          id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
          organization_id TEXT NOT NULL DEFAULT '${POLY_ORG_ID}',
          entity_type VARCHAR(100) NOT NULL,
          sync_options JSONB NOT NULL,
          is_enabled BOOLEAN DEFAULT true,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        `
      }
    ];
    
    // Create all tables
    const allTables = [...coreEntities, ...polymorphicEntities, ...systemEntities];
    for (const table of allTables) {
      const tableName = `${tablePrefix}${table.name}`;
      console.log(`   Creating table: ${tableName}`);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          ${table.columns}
        );
      `);
    }
    
    console.log(`✅ Created ${allTables.length} tables (${coreEntities.length} core, ${polymorphicEntities.length} polymorphic, ${systemEntities.length} system)`);
    
    // Create test users with different access patterns
    console.log('👥 Creating test users with diverse permissions...');
    
    const testUsers = [
      { email: 'admin@polytest.com', name: 'System Admin', role: 'owner', password: 'PolyAdmin123!' },
      { email: 'sales@polytest.com', name: 'Sales Manager', role: 'admin', password: 'PolySales456!' },
      { email: 'support@polytest.com', name: 'Support Agent', role: 'member', password: 'PolySupport789!' },
      { email: 'readonly@polytest.com', name: 'Read Only User', role: 'viewer', password: 'PolyViewer012!' }
    ];
    
    const userIds = [];
    for (const user of testUsers) {
      try {
        const signupResponse = await fetch('http://localhost:8787/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: user.password,
            name: user.name
          })
        });
        
        if (!signupResponse.ok) {
          const existingUser = await client.query(`SELECT id FROM "user" WHERE email = $1`, [user.email]);
          if (existingUser.rows.length > 0) {
            const userId = existingUser.rows[0].id;
            userIds.push({ ...user, userId });
            console.log(`   ✓ Using existing user: ${user.name} (${user.role})`);
          }
        } else {
          const signupData = await signupResponse.json();
          const userId = signupData.user?.id;
          if (userId) {
            userIds.push({ ...user, userId });
            console.log(`   ✓ Created user: ${user.name} (${user.role})`);
          }
        }
        
        // Add to organization
        const lastUserIndex = userIds.length - 1;
        if (lastUserIndex >= 0) {
          await client.query(`
            INSERT INTO organization_members (organization_id, user_id, role, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (organization_id, user_id) DO UPDATE SET
              role = EXCLUDED.role, updated_at = NOW()
          `, [POLY_ORG_ID, userIds[lastUserIndex].userId, user.role]);
        }
      } catch (error) {
        console.log(`   ❌ Error with user ${user.email}: ${error.message}`);
      }
    }
    
    // Mark users as verified
    await client.query(`UPDATE "user" SET "emailVerified" = true WHERE email LIKE '%@polytest.com'`);
    
    // Create sample data with polymorphic relationships
    console.log('📝 Creating sample data with polymorphic relationships...');
    
    // Core entities
    const contactIds = [];
    const contacts = [
      { first_name: 'John', last_name: 'Smith', email: 'john@techcorp.com', company: 'Tech Corp' },
      { first_name: 'Jane', last_name: 'Doe', email: 'jane@startup.io', company: 'Startup Inc' }
    ];
    
    for (const contact of contacts) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}contact" (first_name, last_name, email, company, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [contact.first_name, contact.last_name, contact.email, contact.company, userIds[0].userId, userIds[1].userId]);
      contactIds.push(result.rows[0].id);
    }
    
    const dealIds = [];
    const deals = [
      { title: 'Enterprise Software Deal', value: 50000, stage: 'proposal', contact_id: contactIds[0] },
      { title: 'Consulting Services', value: 25000, stage: 'negotiation', contact_id: contactIds[1] }
    ];
    
    for (const deal of deals) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}deal" (title, value, stage, contact_id, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [deal.title, deal.value, deal.stage, deal.contact_id, userIds[0].userId, userIds[1].userId]);
      dealIds.push(result.rows[0].id);
    }
    
    const ticketIds = [];
    const tickets = [
      { subject: 'Login Issues', description: 'Customer cannot access portal', priority: 'high', contact_id: contactIds[0] },
      { subject: 'Feature Request', description: 'Need custom reporting', priority: 'medium', contact_id: contactIds[1] }
    ];
    
    for (const ticket of tickets) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}ticket" (subject, description, priority, contact_id, created_by, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [ticket.subject, ticket.description, ticket.priority, ticket.contact_id, userIds[0].userId, userIds[2].userId]);
      ticketIds.push(result.rows[0].id);
    }
    
    // Polymorphic data - comments that reference different entity types
    console.log('💬 Creating polymorphic comments...');
    const polymorphicData = [
      // Comments on contacts
      { type: 'contact', id: contactIds[0], content: 'Great lead, very interested in our enterprise solution' },
      { type: 'contact', id: contactIds[1], content: 'Startup looking for cost-effective options' },
      // Comments on deals
      { type: 'deal', id: dealIds[0], content: 'Need to schedule demo next week' },
      { type: 'deal', id: dealIds[1], content: 'Client wants to discuss timeline' },
      // Comments on tickets
      { type: 'ticket', id: ticketIds[0], content: 'Escalated to development team' },
      { type: 'ticket', id: ticketIds[1], content: 'Added to product roadmap for Q2' }
    ];
    
    for (const comment of polymorphicData) {
      await client.query(`
        INSERT INTO "${tablePrefix}comment" (commentable_type, commentable_id, content, author_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [comment.type, comment.id, comment.content, userIds[0].userId, userIds[0].userId]);
    }
    
    // Polymorphic attachments
    console.log('📎 Creating polymorphic attachments...');
    const attachments = [
      { type: 'deal', id: dealIds[0], filename: 'proposal.pdf', file_size: 1024000 },
      { type: 'ticket', id: ticketIds[0], filename: 'screenshot.png', file_size: 512000 },
      { type: 'contact', id: contactIds[0], filename: 'business_card.jpg', file_size: 256000 }
    ];
    
    for (const attachment of attachments) {
      await client.query(`
        INSERT INTO "${tablePrefix}attachment" (attachable_type, attachable_id, filename, file_size, uploaded_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [attachment.type, attachment.id, attachment.filename, attachment.file_size, userIds[0].userId]);
    }
    
    // Activity tracking (polymorphic)
    console.log('📊 Creating polymorphic activities...');
    const activities = [
      { type: 'contact', id: contactIds[0], activity: 'email_sent', description: 'Sent welcome email' },
      { type: 'deal', id: dealIds[0], activity: 'stage_changed', description: 'Moved to proposal stage' },
      { type: 'ticket', id: ticketIds[0], activity: 'priority_changed', description: 'Priority changed to high' }
    ];
    
    for (const activity of activities) {
      await client.query(`
        INSERT INTO "${tablePrefix}activity" (subject_type, subject_id, activity_type, description, performed_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [activity.type, activity.id, activity.activity, activity.description, userIds[0].userId]);
    }
    
    // Create custom field definitions and values
    console.log('🔧 Creating custom field system...');
    
    const customFields = [
      { entity: 'contact', name: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance'] },
      { entity: 'deal', name: 'Source', type: 'text', options: null },
      { entity: 'ticket', name: 'Resolution Time', type: 'number', options: null }
    ];
    
    const fieldIds = [];
    for (const field of customFields) {
      const result = await client.query(`
        INSERT INTO "${tablePrefix}custom_field_definition" (entity_type, field_name, field_type, field_options, created_by)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [field.entity, field.name, field.type, JSON.stringify(field.options), userIds[0].userId]);
      fieldIds.push({ ...field, id: result.rows[0].id });
    }
    
    // Create custom field values (polymorphic-like)
    for (let i = 0; i < fieldIds.length; i++) {
      const field = fieldIds[i];
      if (field.entity === 'contact') {
        await client.query(`
          INSERT INTO "${tablePrefix}custom_field_value" (field_definition_id, entity_type, entity_id, value_text)
          VALUES ($1, $2, $3, $4)
        `, [field.id, 'contact', contactIds[0], 'Technology']);
      }
    }
    
    // Create sync configurations with system and custom options
    console.log('⚙️ Creating sync configurations...');
    
    const syncConfigs = [
      {
        entity: 'contact',
        options: {
          sync_mode: 'full',
          include_polymorphic: true,
          polymorphic_relations: ['comment', 'attachment', 'activity'],
          custom_filters: { status: ['active'] },
          system_options: { enable_real_time: true, batch_size: 100 }
        }
      },
      {
        entity: 'deal',
        options: {
          sync_mode: 'incremental',
          include_polymorphic: true,
          polymorphic_relations: ['comment', 'attachment'],
          custom_filters: { stage: ['proposal', 'negotiation', 'closed_won'] },
          system_options: { enable_real_time: false, batch_size: 50 }
        }
      },
      {
        entity: 'comment',
        options: {
          sync_mode: 'full',
          polymorphic_parent_required: true,
          custom_filters: { is_internal: [false] },
          system_options: { enable_real_time: true }
        }
      }
    ];
    
    for (const config of syncConfigs) {
      await client.query(`
        INSERT INTO "${tablePrefix}sync_configuration" (entity_type, sync_options, created_by)
        VALUES ($1, $2, $3)
      `, [config.entity, JSON.stringify(config.options), userIds[0].userId]);
    }
    
    // Create container permissions with custom restrictions for polymorphic access
    console.log('🔐 Creating container permissions with polymorphic restrictions...');
    
    // Basic organization permissions
    for (const user of userIds) {
      await client.query(`
        INSERT INTO container_permission (user_id, permission_container_type, permission_container_id, role, granted_at, granted_by_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), $5, 'active', NOW(), NOW())
        ON CONFLICT (user_id, permission_container_type, permission_container_id) DO UPDATE SET
          role = EXCLUDED.role, updated_at = NOW()
      `, [user.userId, 'organization', POLY_ORG_ID, user.role, userIds[0].userId]);
    }
    
    // Custom permissions for specific entities and polymorphic access
    const customPermissions = [
      {
        user: userIds[2], // Support agent
        container_type: 'entity_type',
        container_id: 'ticket',
        role: 'manager',
        restrictions: {
          polymorphic_access: ['comment', 'attachment', 'activity'],
          custom_field_access: ['Resolution Time'],
          system_options: { can_modify_priority: true }
        }
      },
      {
        user: userIds[1], // Sales manager
        container_type: 'entity_type', 
        container_id: 'deal',
        role: 'owner',
        restrictions: {
          polymorphic_access: ['comment', 'attachment', 'activity'],
          custom_field_access: ['Source'],
          system_options: { can_modify_stage: true, can_view_all_deals: true }
        }
      }
    ];
    
    for (const perm of customPermissions) {
      await client.query(`
        INSERT INTO container_permission (user_id, permission_container_type, permission_container_id, role, restrictions, granted_at, granted_by_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'active', NOW(), NOW())
      `, [perm.user.userId, perm.container_type, perm.container_id, perm.role, JSON.stringify(perm.restrictions), userIds[0].userId]);
    }
    
    console.log('✅ Container permissions with polymorphic restrictions created');
    
    // Verification
    console.log('\\n📊 Polymorphic Test Organization Summary:');
    console.log('=========================================');
    
    const tableCount = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name LIKE '${tablePrefix}%'
    `);
    
    const userCount = await client.query(`
      SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1
    `, [POLY_ORG_ID]);
    
    const permissionCount = await client.query(`
      SELECT COUNT(*) as count FROM container_permission WHERE permission_container_id = $1 OR permission_container_id LIKE 'ticket' OR permission_container_id LIKE 'deal'
    `, [POLY_ORG_ID]);
    
    const commentCount = await client.query(`SELECT COUNT(*) as count FROM "${tablePrefix}comment"`);
    const attachmentCount = await client.query(`SELECT COUNT(*) as count FROM "${tablePrefix}attachment"`);
    const activityCount = await client.query(`SELECT COUNT(*) as count FROM "${tablePrefix}activity"`);
    
    console.log(`📦 Tables created: ${tableCount.rows[0].count}`);
    console.log(`👥 Users: ${userCount.rows[0].count}`);
    console.log(`🔐 Permissions: ${permissionCount.rows[0].count}`);
    console.log(`💬 Polymorphic comments: ${commentCount.rows[0].count}`);
    console.log(`📎 Polymorphic attachments: ${attachmentCount.rows[0].count}`);
    console.log(`📊 Polymorphic activities: ${activityCount.rows[0].count}`);
    
    console.log('\\n🎉 Polymorphic test organization created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error creating Polymorphic Test:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the creation
createPolymorphicTest()
  .then(success => {
    if (success) {
      console.log('\\n✅ Polymorphic Test creation completed');
      console.log('\\n📋 Test this scenario with:');
      console.log('   node test-polymorphic-sync.cjs');
      process.exit(0);
    } else {
      console.log('\\n❌ Polymorphic Test creation failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Creation error:', error.message);
    process.exit(1);
  });