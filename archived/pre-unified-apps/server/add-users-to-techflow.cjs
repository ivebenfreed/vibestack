/**
 * Add the new test users to TechFlow organization with proper roles
 */

const { Client } = require('pg');

async function addUsersToTechFlow() {
  console.log('🏢 Adding test users to TechFlow organization...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad';
  
  const users = [
    {
      email: 'sarah.admin.test@techflow.com',
      role: 'admin'
    },
    {
      email: 'michael.manager.test@techflow.com',
      role: 'manager'
    },
    {
      email: 'emily.member.test@techflow.com',
      role: 'member'
    }
  ];
  
  try {
    for (const user of users) {
      console.log(`\n👤 Adding ${user.role}: ${user.email}`);
      
      // Get user ID
      const userResult = await client.query(
        'SELECT id FROM "user" WHERE email = $1',
        [user.email]
      );
      
      if (userResult.rows.length === 0) {
        console.log(`❌ User not found: ${user.email}`);
        continue;
      }
      
      const userId = userResult.rows[0].id;
      console.log(`   User ID: ${userId}`);
      
      // Check if already a member
      const memberCheck = await client.query(
        'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
        [userId, TECHFLOW_ORG_ID]
      );
      
      if (memberCheck.rows.length > 0) {
        console.log(`   ℹ️  Already a member, updating role to ${user.role}`);
        
        // Update role
        await client.query(
          'UPDATE organization_members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
          [user.role, userId, TECHFLOW_ORG_ID]
        );
        
        console.log(`   ✅ Role updated to ${user.role}`);
      } else {
        console.log(`   ➕ Adding as new member with role ${user.role}`);
        
        // Add as new member
        const memberId = require('crypto').randomUUID();
        await client.query(
          'INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
          [memberId, TECHFLOW_ORG_ID, userId, user.role]
        );
        
        console.log(`   ✅ Added as ${user.role}`);
      }
    }
    
    // Verify the setup
    console.log('\n📊 Verification: TechFlow organization members:');
    const membersResult = await client.query(`
      SELECT u.email, om.role, u.id 
      FROM organization_members om 
      JOIN "user" u ON u.id = om.user_id 
      WHERE om.organization_id = $1 
      ORDER BY om.role, u.email
    `, [TECHFLOW_ORG_ID]);
    
    membersResult.rows.forEach(member => {
      console.log(`   ${member.role.toUpperCase()}: ${member.email} (${member.id.substring(0, 8)}...)`);
    });
    
    console.log('\n🎉 All test users successfully added to TechFlow organization!');
    return true;
    
  } catch (error) {
    console.error('❌ Error adding users to organization:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the script
addUsersToTechFlow()
  .then(success => {
    if (success) {
      console.log('\n✅ TechFlow organization setup completed');
      process.exit(0);
    } else {
      console.log('\n❌ TechFlow organization setup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Setup error:', error.message);
    process.exit(1);
  });