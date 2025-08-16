#!/usr/bin/env node

/**
 * Create test data to demonstrate sync payload and organization isolation
 */

const { Client } = require('pg');

const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad'; // Real org ID from logs
const OTHER_ORG_ID = '01234567-89ab-cdef-0123-456789abcdef'; // Test org from logs

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createSyncTestData() {
  console.log('📊 Creating sync test data for organization isolation testing...');
  
  try {
    const client = new Client({
      connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
    });
    
    await client.connect();
    
    console.log('\n--- Creating TechFlow Organization Data ---');
    
    // Create TechFlow projects
    const techflowProjects = [
      {
        id: generateUUID(),
        name: 'TechFlow Website Redesign',
        description: 'Complete redesign of the TechFlow Solutions website',
        status: 'active'
      },
      {
        id: generateUUID(),
        name: 'Client Portal Development',
        description: 'Building a client portal for TechFlow customers',
        status: 'planning'
      },
      {
        id: generateUUID(),
        name: 'Mobile App MVP',
        description: 'TechFlow mobile application minimum viable product',
        status: 'active'
      }
    ];
    
    // Create TechFlow tasks
    const techflowTasks = [
      {
        id: generateUUID(),
        project_id: techflowProjects[0].id,
        title: 'Design new homepage layout',
        description: 'Create wireframes and mockups for the new homepage',
        status: 'in_progress',
        priority: 'high'
      },
      {
        id: generateUUID(),
        project_id: techflowProjects[0].id,
        title: 'Implement responsive navigation',
        description: 'Build mobile-friendly navigation menu',
        status: 'todo',
        priority: 'medium'
      },
      {
        id: generateUUID(),
        project_id: techflowProjects[1].id,
        title: 'Setup authentication system',
        description: 'Implement user login and registration',
        status: 'in_progress',
        priority: 'high'
      }
    ];
    
    // Insert TechFlow data into change_history
    for (const project of techflowProjects) {
      await client.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        generateUUID(),
        '0/2650000',
        TECHFLOW_ORG_ID,
        'projects',
        'insert',
        JSON.stringify({ ...project, organization_id: TECHFLOW_ORG_ID }),
        'test-data-seeder'
      ]);
      
      console.log(`✅ Created TechFlow project: ${project.name}`);
    }
    
    for (const task of techflowTasks) {
      await client.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        generateUUID(),
        '0/2651000',
        TECHFLOW_ORG_ID,
        'tasks',
        'insert',
        JSON.stringify({ ...task, organization_id: TECHFLOW_ORG_ID }),
        'test-data-seeder'
      ]);
      
      console.log(`✅ Created TechFlow task: ${task.title}`);
    }
    
    console.log('\n--- Creating Other Organization Data (for isolation testing) ---');
    
    // Create competitor organization data
    const competitorProjects = [
      {
        id: generateUUID(),
        name: 'Competitor Secret Project',
        description: 'This should NOT appear in TechFlow sync',
        status: 'confidential'
      },
      {
        id: generateUUID(),
        name: 'Rival Product Launch',
        description: 'Competitor product that TechFlow should not see',
        status: 'stealth'
      }
    ];
    
    for (const project of competitorProjects) {
      await client.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        generateUUID(),
        '0/2652000',
        OTHER_ORG_ID,
        'projects',
        'insert',
        JSON.stringify({ ...project, organization_id: OTHER_ORG_ID }),
        'competitor-seeder'
      ]);
      
      console.log(`🔒 Created competitor project: ${project.name} (should be isolated)`);
    }
    
    console.log('\n--- Creating Recent Activity ---');
    
    // Create some recent time entries for TechFlow
    const timeEntries = [
      {
        id: generateUUID(),
        task_id: techflowTasks[0].id,
        user_id: '0198aed6-cc0b-783b-b414-c5fb8a81f227', // Admin user
        hours: 3.5,
        description: 'Working on homepage design mockups',
        date: new Date().toISOString().split('T')[0]
      },
      {
        id: generateUUID(),
        task_id: techflowTasks[2].id,
        user_id: '0198aed6-cc0b-783b-b414-c5fb8a81f227',
        hours: 2.0,
        description: 'Setting up OAuth integration',
        date: new Date().toISOString().split('T')[0]
      }
    ];
    
    for (const entry of timeEntries) {
      await client.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        generateUUID(),
        '0/2653000',
        TECHFLOW_ORG_ID,
        'time_entries',
        'insert',
        JSON.stringify({ ...entry, organization_id: TECHFLOW_ORG_ID }),
        'time-tracker'
      ]);
      
      console.log(`⏱️ Created time entry: ${entry.hours}h - ${entry.description}`);
    }
    
    await client.end();
    
    console.log('\n📊 SYNC TEST DATA SUMMARY:');
    console.log(`✅ TechFlow Organization (${TECHFLOW_ORG_ID}):`);
    console.log(`   - ${techflowProjects.length} projects`);
    console.log(`   - ${techflowTasks.length} tasks`);
    console.log(`   - ${timeEntries.length} time entries`);
    console.log(`🔒 Competitor Organization (${OTHER_ORG_ID}):`);
    console.log(`   - ${competitorProjects.length} projects (should be isolated)`);
    console.log('\n🎯 Ready for sync payload testing!');
    
    return {
      success: true,
      techflow_org_id: TECHFLOW_ORG_ID,
      techflow_records: techflowProjects.length + techflowTasks.length + timeEntries.length,
      competitor_org_id: OTHER_ORG_ID,
      competitor_records: competitorProjects.length
    };
    
  } catch (error) {
    console.error('❌ Error creating sync test data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

if (require.main === module) {
  createSyncTestData()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Sync test data created successfully!');
        console.log('Now run the sync payload test to see organization isolation in action.');
      } else {
        console.log('\n❌ Failed to create sync test data:', result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Sync test data creation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createSyncTestData };