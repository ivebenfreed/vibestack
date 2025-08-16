#!/usr/bin/env node

/**
 * Create Realistic Business Data for TechFlow Solutions
 * 
 * This script creates comprehensive business data to test organization isolation:
 * - Projects with realistic software development content
 * - Tasks with dependencies and assignments
 * - Time entries for project tracking
 * - Comments and discussions
 * - File attachments and documentation
 */

const { neonConfig } = require('@neondatabase/serverless');

// Configure local Neon proxy
neonConfig.fetchEndpoint = (host) => {
  if (host === 'db.localtest.me') {
    return 'http://db.localtest.me:4444/sql';
  }
  return `https://${host}/sql`;
};

const { Kysely } = require('kysely');
const { NeonHTTPDialect } = require('@repo/kysely-neon-http');

const db = new Kysely({
  dialect: new NeonHTTPDialect({
    connectionString: process.env.DATABASE_URL || 'postgres://db.localtest.me:4444/vibestack_dev'
  })
});

// TechFlow Solutions organization ID (from previous tests)
const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';

// Team members with their IDs (from membership test results)
const TEAM_MEMBERS = {
  owner: '0198aed6-cc0b-783b-b414-c5fb8a81f227',    // TechFlow Admin
  admin: '0198aedd-1a09-7364-96c6-49c476b359e9',    // Sarah Chen
  manager: '0198aedd-2660-714e-8f17-3b615cbd46a0',  // Michael Rodriguez  
  member: '0198aedd-313b-7abc-a36c-9bd2d88b4ae2'    // Emily Watson
};

function generateUUIDv7() {
  // Simple UUIDv7 generator for testing
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
  console.log('🏢 Creating realistic business data for TechFlow Solutions...');
  
  try {
    // Set organization context for RLS
    await db.executeQuery(sql`SELECT set_current_organization_id(${TECHFLOW_ORG_ID}::UUID)`.compile(db));
    
    const results = {
      timestamp: new Date().toISOString(),
      organization_id: TECHFLOW_ORG_ID,
      business_data: {}
    };

    // 1. Create Projects
    console.log('📋 Creating software development projects...');
    
    const projects = [
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        name: 'E-Commerce Platform MVP',
        description: 'Build a modern e-commerce platform with React, Node.js, and PostgreSQL for a retail client',
        status: 'active',
        priority: 'high',
        budget: 45000,
        start_date: '2025-08-01',
        end_date: '2025-10-15',
        assigned_to: TEAM_MEMBERS.manager,
        created_by: TEAM_MEMBERS.owner,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        name: 'Mobile Banking App',
        description: 'Develop secure mobile banking application with biometric authentication and real-time transactions',
        status: 'planning',
        priority: 'critical',
        budget: 75000,
        start_date: '2025-09-01',
        end_date: '2025-12-31',
        assigned_to: TEAM_MEMBERS.admin,
        created_by: TEAM_MEMBERS.owner,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        name: 'Internal Project Management Tool',
        description: 'Custom project management solution to replace existing tools and improve team efficiency',
        status: 'active',
        priority: 'medium',
        budget: 25000,
        start_date: '2025-07-15',
        end_date: '2025-09-30',
        assigned_to: TEAM_MEMBERS.member,
        created_by: TEAM_MEMBERS.admin,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Check if projects table exists and create projects
    try {
      for (const project of projects) {
        await db.insertInto('projects').values(project).execute();
        console.log(`  ✅ Created project: ${project.name}`);
      }
      results.business_data.projects = projects.length;
    } catch (error) {
      console.log(`  ⚠️ Projects table may not exist:`, error.message);
      results.business_data.projects_error = error.message;
    }

    // 2. Create Tasks
    console.log('📝 Creating development tasks...');
    
    const tasks = [
      // E-Commerce Platform tasks
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[0].id,
        title: 'Set up development environment and CI/CD pipeline',
        description: 'Configure development environment, Docker containers, and automated deployment pipeline',
        status: 'completed',
        priority: 'high',
        estimated_hours: 16,
        actual_hours: 14,
        assigned_to: TEAM_MEMBERS.manager,
        created_by: TEAM_MEMBERS.owner,
        due_date: '2025-08-05',
        completed_at: '2025-08-04T15:30:00Z',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[0].id,
        title: 'Design and implement user authentication system',
        description: 'Build secure authentication with JWT tokens, password reset, and email verification',
        status: 'in_progress',
        priority: 'high',
        estimated_hours: 24,
        actual_hours: 18,
        assigned_to: TEAM_MEMBERS.admin,
        created_by: TEAM_MEMBERS.manager,
        due_date: '2025-08-20',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[0].id,
        title: 'Implement product catalog and inventory management',
        description: 'Create product listing, categories, inventory tracking, and search functionality',
        status: 'todo',
        priority: 'high',
        estimated_hours: 32,
        assigned_to: TEAM_MEMBERS.member,
        created_by: TEAM_MEMBERS.manager,
        due_date: '2025-09-01',
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Mobile Banking App tasks
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[1].id,
        title: 'Security architecture and compliance review',
        description: 'Design security architecture meeting banking regulations and compliance requirements',
        status: 'in_progress',
        priority: 'critical',
        estimated_hours: 40,
        actual_hours: 25,
        assigned_to: TEAM_MEMBERS.admin,
        created_by: TEAM_MEMBERS.owner,
        due_date: '2025-09-15',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[1].id,
        title: 'Biometric authentication integration',
        description: 'Implement fingerprint and face recognition for secure app access',
        status: 'todo',
        priority: 'high',
        estimated_hours: 28,
        assigned_to: TEAM_MEMBERS.member,
        created_by: TEAM_MEMBERS.admin,
        due_date: '2025-10-01',
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Internal PM Tool tasks
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        project_id: projects[2].id,
        title: 'Task management and workflow system',
        description: 'Build task creation, assignment, status tracking, and workflow automation',
        status: 'in_progress',
        priority: 'medium',
        estimated_hours: 20,
        actual_hours: 12,
        assigned_to: TEAM_MEMBERS.member,
        created_by: TEAM_MEMBERS.admin,
        due_date: '2025-08-25',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    try {
      for (const task of tasks) {
        await db.insertInto('tasks').values(task).execute();
        console.log(`  ✅ Created task: ${task.title.substring(0, 50)}...`);
      }
      results.business_data.tasks = tasks.length;
    } catch (error) {
      console.log(`  ⚠️ Tasks table may not exist:`, error.message);
      results.business_data.tasks_error = error.message;
    }

    // 3. Create Time Entries
    console.log('⏰ Creating time tracking entries...');
    
    const timeEntries = [
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[0].id,
        user_id: TEAM_MEMBERS.manager,
        description: 'Set up Docker development environment and database migrations',
        hours: 6.5,
        date: '2025-08-02',
        billable: true,
        hourly_rate: 95.00,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[0].id,
        user_id: TEAM_MEMBERS.manager,
        description: 'Configure CI/CD pipeline with automated testing and deployment',
        hours: 7.5,
        date: '2025-08-03',
        billable: true,
        hourly_rate: 95.00,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[1].id,
        user_id: TEAM_MEMBERS.admin,
        description: 'Research authentication best practices and JWT implementation',
        hours: 4.0,
        date: '2025-08-10',
        billable: true,
        hourly_rate: 105.00,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[1].id,
        user_id: TEAM_MEMBERS.admin,
        description: 'Implement user registration and login endpoints',
        hours: 8.0,
        date: '2025-08-12',
        billable: true,
        hourly_rate: 105.00,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[3].id,
        user_id: TEAM_MEMBERS.admin,
        description: 'Banking security compliance research and documentation',
        hours: 6.0,
        date: '2025-08-14',
        billable: true,
        hourly_rate: 105.00,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    try {
      for (const entry of timeEntries) {
        await db.insertInto('time_entries').values(entry).execute();
        console.log(`  ✅ Created time entry: ${entry.hours}h - ${entry.description.substring(0, 40)}...`);
      }
      results.business_data.time_entries = timeEntries.length;
    } catch (error) {
      console.log(`  ⚠️ Time entries table may not exist:`, error.message);
      results.business_data.time_entries_error = error.message;
    }

    // 4. Create Comments
    console.log('💬 Creating task comments and discussions...');
    
    const comments = [
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[1].id,
        user_id: TEAM_MEMBERS.manager,
        content: 'Great progress on the authentication system! The JWT implementation looks solid. Make sure to include rate limiting for login attempts.',
        parent_comment_id: null,
        created_at: new Date('2025-08-13T10:30:00Z'),
        updated_at: new Date('2025-08-13T10:30:00Z')
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[1].id,
        user_id: TEAM_MEMBERS.admin,
        content: 'Thanks! I\'ve implemented bcrypt for password hashing and added rate limiting middleware. Also planning to add 2FA support in the next iteration.',
        parent_comment_id: null,
        created_at: new Date('2025-08-13T14:15:00Z'),
        updated_at: new Date('2025-08-13T14:15:00Z')
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[3].id,
        user_id: TEAM_MEMBERS.owner,
        content: 'For the banking app security review, we need to ensure PCI DSS compliance. I\'ll schedule a meeting with the compliance team.',
        parent_comment_id: null,
        created_at: new Date('2025-08-14T09:00:00Z'),
        updated_at: new Date('2025-08-14T09:00:00Z')
      },
      {
        id: generateUUIDv7(),
        organization_id: TECHFLOW_ORG_ID,
        task_id: tasks[5].id,
        user_id: TEAM_MEMBERS.member,
        content: 'The task management workflow is coming along nicely. I\'ve implemented drag-and-drop for status changes and added bulk operations.',
        parent_comment_id: null,
        created_at: new Date('2025-08-15T16:45:00Z'),
        updated_at: new Date('2025-08-15T16:45:00Z')
      }
    ];

    try {
      for (const comment of comments) {
        await db.insertInto('comments').values(comment).execute();
        console.log(`  ✅ Created comment: ${comment.content.substring(0, 50)}...`);
      }
      results.business_data.comments = comments.length;
    } catch (error) {
      console.log(`  ⚠️ Comments table may not exist:`, error.message);
      results.business_data.comments_error = error.message;
    }

    // 5. Summary and statistics
    console.log('\n📊 Business Data Creation Summary:');
    console.log(`Organization: TechFlow Solutions (${TECHFLOW_ORG_ID})`);
    console.log(`Projects: ${results.business_data.projects || 'N/A'}`);
    console.log(`Tasks: ${results.business_data.tasks || 'N/A'}`);
    console.log(`Time Entries: ${results.business_data.time_entries || 'N/A'}`);
    console.log(`Comments: ${results.business_data.comments || 'N/A'}`);
    
    // Calculate business metrics
    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const totalLoggedHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalBillableAmount = timeEntries.reduce((sum, e) => sum + (e.hours * e.hourly_rate), 0);
    
    results.business_metrics = {
      total_project_budget: totalBudget,
      total_estimated_hours: totalEstimatedHours,
      total_logged_hours: totalLoggedHours,
      total_billable_amount: totalBillableAmount,
      average_hourly_rate: totalBillableAmount / totalLoggedHours
    };
    
    console.log('\n💰 Business Metrics:');
    console.log(`Total Project Budget: $${totalBudget.toLocaleString()}`);
    console.log(`Total Estimated Hours: ${totalEstimatedHours}h`);
    console.log(`Total Logged Hours: ${totalLoggedHours}h`);
    console.log(`Total Billable Amount: $${totalBillableAmount.toLocaleString()}`);
    console.log(`Average Hourly Rate: $${(totalBillableAmount / totalLoggedHours).toFixed(2)}/h`);

    // Save results to file
    const resultsPath = `/home/ben-freed/dev/vibestack/apps/server/orgtest/techflow-business-data-results.json`;
    require('fs').writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Business data creation complete! Results saved to: ${resultsPath}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error creating business data:', error);
    throw error;
  }
}

// Helper to import sql template function
const { sql } = require('kysely');

if (require.main === module) {
  createBusinessData()
    .then(() => {
      console.log('🎉 TechFlow Solutions business data creation successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Business data creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createBusinessData };