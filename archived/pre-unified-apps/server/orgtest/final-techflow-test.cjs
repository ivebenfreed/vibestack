#!/usr/bin/env node

/**
 * Final TechFlow Solutions Test
 * 
 * Creates a working test organization with:
 * - Organization with trial subscription
 * - Users with real email domains
 * - Task and project entities using the DataForge system
 * - Complete validation of the workflow
 */

const fs = require('fs');
const path = require('path');

async function apiCall(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('../cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    throw new Error('No session cookies found. Please ensure admin is authenticated.');
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
  } catch (e) {
    jsonResult = result;
  }
  
  if (!response.ok) {
    console.error(`❌ ${method} ${endpoint} failed:`, jsonResult);
    throw new Error(`API call failed: ${response.status}`);
  }
  
  return jsonResult;
}

function saveResult(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${path.basename(filename)}`);
}

async function createTechFlowTest() {
  console.log('🚀 Creating TechFlow Solutions Test Organization\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    test_name: 'TechFlow Solutions Complete Test',
    results: {}
  };
  
  try {
    // 1. Create Organization
    console.log('=== 1. Creating Organization ===');
    const orgData = {
      name: "TechFlow Solutions",
      slug: "techflow-solutions-final",
      description: "Software development agency - comprehensive test organization"
    };
    
    const organization = await apiCall('POST', '/api/organizations', orgData);
    results.results.organization = organization;
    console.log(`✅ Created: ${organization.name}`);
    console.log(`   ID: ${organization.id}`);
    console.log(`   Trial: ${organization.trial_started_at} → ${organization.trial_ends_at}`);
    
    // 2. Create Users with Real Gmail Addresses
    console.log('\n=== 2. Creating Team Members ===');
    const teamMembers = [
      {
        name: "Sarah Chen",
        email: "sarah.chen.techflow.001@gmail.com",
        role: "admin",
        position: "CEO/CTO"
      },
      {
        name: "Michael Rodriguez", 
        email: "michael.rodriguez.techflow.001@gmail.com",
        role: "manager",
        position: "Senior Developer"
      },
      {
        name: "Emily Watson",
        email: "emily.watson.techflow.001@gmail.com",
        role: "member",
        position: "Frontend Developer"
      }
    ];
    
    results.results.users = [];
    const verification_links = [];
    
    for (const member of teamMembers) {
      try {
        console.log(`Creating: ${member.name} (${member.email})`);
        
        const userData = {
          name: member.name,
          email: member.email,
          password: "X9#mK8$nP2@vQ7!wE5"
        };
        
        const user = await apiCall('POST', '/api/auth/sign-up/email', userData);
        
        results.results.users.push({
          user: user.user,
          intended_role: member.role,
          position: member.position,
          verification_needed: !user.user.emailVerified
        });
        
        console.log(`✅ Created: ${member.name} (verification needed)`);
        
      } catch (error) {
        console.error(`❌ Failed to create ${member.name}: ${error.message}`);
      }
    }
    
    // 3. Create Projects using DataForge entities
    console.log('\n=== 3. Creating Projects ===');
    results.results.projects = [];
    
    const projectsData = [
      {
        name: "EcoTracker Mobile App",
        description: "Carbon footprint tracking mobile application",
        status: "in_progress",
        budget: 80000
      },
      {
        name: "Patient Portal Redesign", 
        description: "Healthcare patient portal user interface redesign",
        status: "planning",
        budget: 120000
      }
    ];
    
    for (const projectData of projectsData) {
      try {
        console.log(`Creating project: ${projectData.name}`);
        
        // Use the generic entity API that should exist
        const project = await apiCall('POST', `/api/organizations/${organization.id}/project`, projectData);
        results.results.projects.push(project);
        console.log(`✅ Created project: ${projectData.name}`);
        
      } catch (error) {
        console.error(`❌ Project creation failed: ${error.message}`);
        
        // Try alternative endpoints
        try {
          const altProject = await apiCall('POST', `/api/project`, {
            ...projectData,
            organization_id: organization.id
          });
          results.results.projects.push(altProject);
          console.log(`✅ Created project (alt): ${projectData.name}`);
        } catch (altError) {
          console.error(`❌ Alternative project creation failed: ${altError.message}`);
        }
      }
    }
    
    // 4. Create Tasks
    console.log('\n=== 4. Creating Tasks ===');
    results.results.tasks = [];
    
    const tasksData = [
      {
        title: "Implement Carbon Tracking API",
        description: "Build REST API for carbon footprint calculations",
        status: "todo",
        priority: "high",
        estimated_hours: 16
      },
      {
        title: "Design Mobile User Interface",
        description: "Create responsive mobile UI for tracking screens", 
        status: "in_progress",
        priority: "medium",
        estimated_hours: 12
      },
      {
        title: "Setup CI/CD Pipeline",
        description: "Configure automated testing and deployment",
        status: "todo", 
        priority: "low",
        estimated_hours: 8
      }
    ];
    
    for (const taskData of tasksData) {
      try {
        console.log(`Creating task: ${taskData.title}`);
        
        const task = await apiCall('POST', `/api/organizations/${organization.id}/task`, taskData);
        results.results.tasks.push(task);
        console.log(`✅ Created task: ${taskData.title}`);
        
      } catch (error) {
        console.error(`❌ Task creation failed: ${error.message}`);
        
        // Try alternative endpoint
        try {
          const altTask = await apiCall('POST', `/api/task`, {
            ...taskData,
            organization_id: organization.id
          });
          results.results.tasks.push(altTask);
          console.log(`✅ Created task (alt): ${taskData.title}`);
        } catch (altError) {
          console.error(`❌ Alternative task creation failed: ${altError.message}`);
        }
      }
    }
    
    // 5. Test Data Retrieval
    console.log('\n=== 5. Testing Data Retrieval ===');
    
    try {
      const orgsList = await apiCall('GET', '/api/organizations');
      console.log(`✅ Retrieved ${orgsList.length} organizations`);
      results.results.organizations_count = orgsList.length;
    } catch (error) {
      console.error(`❌ Organization retrieval failed: ${error.message}`);
    }
    
    // 6. Save Complete Results
    console.log('\n=== 6. Saving Results ===');
    
    results.summary = {
      organization_created: !!results.results.organization,
      organization_id: results.results.organization?.id,
      users_created: results.results.users.length,
      projects_created: results.results.projects.length,
      tasks_created: results.results.tasks.length,
      trial_active: !!results.results.organization?.trial_ends_at,
      trial_expires: results.results.organization?.trial_ends_at,
      test_status: 'completed'
    };
    
    saveResult('./test-results-final.json', results);
    saveResult('./organization-final.json', results.results.organization);
    saveResult('./users-final.json', results.results.users);
    saveResult('./projects-final.json', results.results.projects);
    saveResult('./tasks-final.json', results.results.tasks);
    
    // 7. Display Summary
    console.log('\n📊 === TEST SUMMARY ===');
    console.log(`Organization: ${results.results.organization.name}`);
    console.log(`Organization ID: ${results.results.organization.id}`);
    console.log(`Subscription: ${results.results.organization.subscription_tier} (${results.results.organization.subscription_status})`);
    console.log(`Trial Period: ${results.results.organization.trial_started_at} → ${results.results.organization.trial_ends_at}`);
    console.log(`Users Created: ${results.results.users.length}`);
    console.log(`Projects Created: ${results.results.projects.length}`);
    console.log(`Tasks Created: ${results.results.tasks.length}`);
    
    if (results.results.users.length > 0) {
      console.log('\\nTeam Members:');
      results.results.users.forEach(u => {
        console.log(`- ${u.user.name} (${u.user.email}) - ${u.position}`);
      });
    }
    
    console.log('\\n🎯 Test Files Saved:');
    console.log('- test-results-final.json (complete results)');
    console.log('- organization-final.json (organization data)');
    console.log('- users-final.json (user accounts)');
    console.log('- projects-final.json (project entities)');
    console.log('- tasks-final.json (task entities)');
    
    console.log('\\n✅ TechFlow Solutions test completed successfully!');
    
    return results;
    
  } catch (error) {
    console.error('\\n❌ Test failed:', error.message);
    results.error = error.message;
    results.summary = { test_status: 'failed' };
    saveResult('./test-results-final.json', results);
    throw error;
  }
}

// Execute if called directly
if (require.main === module) {
  createTechFlowTest()
    .then(() => {
      console.log('\\n🎉 Test execution completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { createTechFlowTest };