#!/usr/bin/env node

/**
 * Create Business Data for TechFlow Solutions - Simple SQL Version
 */

const { Client } = require('pg');

// TechFlow Solutions organization ID
const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';

// Team members (from membership test results)
const TEAM_MEMBERS = {
  owner: '0198aed6-cc0b-783b-b414-c5fb8a81f227',    // TechFlow Admin
  admin: '0198aedd-1a09-7364-96c6-49c476b359e9',    // Sarah Chen
  manager: '0198aedd-2660-714e-8f17-3b615cbd46a0',  // Michael Rodriguez  
  member: '0198aedd-313b-7abc-a36c-9bd2d88b4ae2'    // Emily Watson
};

function generateUUIDv7() {
  const timestamp = Date.now();
  const randomA = Math.floor(Math.random() * 0x10000);
  const randomB = Math.floor(Math.random() * 0x100000000);
  
  return [
    timestamp.toString(16).padStart(12, '0').slice(0, 8),
    timestamp.toString(16).padStart(12, '0').slice(8, 12),
    '7' + randomA.toString(16).padStart(3, '0'),
    ((randomB >> 30) | 0x8000).toString(16),
    (randomB & 0x3fffffff).toString(16).padStart(8, '0').slice(0, 12)
  ].join('-');
}

async function createBusinessData() {
  console.log('🏢 Creating business data for TechFlow Solutions...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Set organization context
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    console.log('✅ Set organization context');
    
    const results = {
      timestamp: new Date().toISOString(),
      organization_id: TECHFLOW_ORG_ID,
      created_data: {}
    };

    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('projects', 'tasks', 'time_entries', 'comments', 'files')
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    console.log('📋 Available tables:', existingTables);
    
    // Create sample projects if table exists
    if (existingTables.includes('projects')) {
      console.log('📋 Creating projects...');
      
      const projects = [
        {
          id: generateUUIDv7(),
          name: 'E-Commerce Platform MVP',
          description: 'Build modern e-commerce platform with React, Node.js, and PostgreSQL',
          status: 'active',
          priority: 'high',
          budget: 45000,
          assigned_to: TEAM_MEMBERS.manager,
          created_by: TEAM_MEMBERS.owner
        },
        {
          id: generateUUIDv7(),
          name: 'Mobile Banking App',
          description: 'Develop secure mobile banking application with biometric authentication',
          status: 'planning',
          priority: 'critical',
          budget: 75000,
          assigned_to: TEAM_MEMBERS.admin,
          created_by: TEAM_MEMBERS.owner
        },
        {
          id: generateUUIDv7(),
          name: 'Internal Project Management Tool',
          description: 'Custom project management solution to improve team efficiency',
          status: 'active',
          priority: 'medium',
          budget: 25000,
          assigned_to: TEAM_MEMBERS.member,
          created_by: TEAM_MEMBERS.admin
        }
      ];
      
      for (const project of projects) {
        try {
          await client.query(`
            INSERT INTO projects (id, organization_id, name, description, status, priority, budget, assigned_to, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            project.id, TECHFLOW_ORG_ID, project.name, project.description,
            project.status, project.priority, project.budget, project.assigned_to, project.created_by
          ]);
          console.log(`  ✅ Created project: ${project.name}`);
        } catch (error) {
          console.log(`  ⚠️ Could not create project ${project.name}: ${error.message}`);
        }
      }
      results.created_data.projects = projects.length;
    } else {
      console.log('⚠️ Projects table does not exist');
    }
    
    // Create sample tasks if table exists
    if (existingTables.includes('tasks')) {
      console.log('📝 Creating tasks...');
      
      const tasks = [
        {
          id: generateUUIDv7(),
          title: 'Set up development environment and CI/CD pipeline',
          description: 'Configure development environment, Docker containers, and deployment pipeline',
          status: 'completed',
          priority: 'high',
          estimated_hours: 16,
          assigned_to: TEAM_MEMBERS.manager,
          created_by: TEAM_MEMBERS.owner
        },
        {
          id: generateUUIDv7(),
          title: 'Design and implement user authentication system',
          description: 'Build secure authentication with JWT tokens and email verification',
          status: 'in_progress',
          priority: 'high',
          estimated_hours: 24,
          assigned_to: TEAM_MEMBERS.admin,
          created_by: TEAM_MEMBERS.manager
        },
        {
          id: generateUUIDv7(),
          title: 'Implement product catalog and inventory management',
          description: 'Create product listing, categories, inventory tracking, and search',
          status: 'todo',
          priority: 'high',
          estimated_hours: 32,
          assigned_to: TEAM_MEMBERS.member,
          created_by: TEAM_MEMBERS.manager
        },
        {
          id: generateUUIDv7(),
          title: 'Security architecture and compliance review',
          description: 'Design security architecture meeting banking regulations',
          status: 'in_progress',
          priority: 'critical',
          estimated_hours: 40,
          assigned_to: TEAM_MEMBERS.admin,
          created_by: TEAM_MEMBERS.owner
        }
      ];
      
      for (const task of tasks) {
        try {
          await client.query(`
            INSERT INTO tasks (id, organization_id, title, description, status, priority, estimated_hours, assigned_to, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            task.id, TECHFLOW_ORG_ID, task.title, task.description,
            task.status, task.priority, task.estimated_hours, task.assigned_to, task.created_by
          ]);
          console.log(`  ✅ Created task: ${task.title.substring(0, 50)}...`);
        } catch (error) {
          console.log(`  ⚠️ Could not create task: ${error.message}`);
        }
      }
      results.created_data.tasks = tasks.length;
    } else {
      console.log('⚠️ Tasks table does not exist');
    }
    
    // Test data retrieval to verify organization isolation
    console.log('\n🔍 Testing data retrieval with organization context...');
    
    // Test project retrieval
    try {
      const projectsResult = await client.query('SELECT id, name, organization_id FROM projects WHERE organization_id = $1', [TECHFLOW_ORG_ID]);
      console.log(`📋 Found ${projectsResult.rows.length} projects for TechFlow Solutions`);
      results.verification = {
        projects_count: projectsResult.rows.length,
        projects: projectsResult.rows
      };
    } catch (error) {
      console.log('⚠️ Could not retrieve projects:', error.message);
    }
    
    // Test task retrieval
    try {
      const tasksResult = await client.query('SELECT id, title, organization_id FROM tasks WHERE organization_id = $1', [TECHFLOW_ORG_ID]);
      console.log(`📝 Found ${tasksResult.rows.length} tasks for TechFlow Solutions`);
      results.verification.tasks_count = tasksResult.rows.length;
    } catch (error) {
      console.log('⚠️ Could not retrieve tasks:', error.message);
    }
    
    // Save results
    const fs = require('fs');
    const resultsPath = 'orgtest/techflow-business-data-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log('\n✅ Business data creation complete!');
    console.log(`📄 Results saved to: ${resultsPath}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  createBusinessData()
    .then(() => {
      console.log('🎉 Success!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createBusinessData };