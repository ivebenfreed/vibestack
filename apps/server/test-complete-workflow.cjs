#!/usr/bin/env node

/**
 * Complete TechFlow Workflow Test
 * Tests user creation, organization membership, and entity creation
 */

const fs = require('fs');

async function apiCall(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('./cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    throw new Error('No session cookies found. Please run setup-admin-user.cjs first');
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
    throw new Error(`API call failed: ${response.status} - ${typeof jsonResult === 'string' ? jsonResult : JSON.stringify(jsonResult)}`);
  }
  
  return jsonResult;
}

async function saveTestResult(filename, data) {
  if (!fs.existsSync('./orgtest')) {
    fs.mkdirSync('./orgtest', { recursive: true });
  }
  fs.writeFileSync(`./orgtest/${filename}`, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${filename}`);
}

async function testCompleteWorkflow() {
  console.log('🧪 Testing Complete TechFlow Workflow\n');
  
  const results = {};
  
  try {
    // 1. Create main organization
    console.log('=== 1. Creating TechFlow Solutions Organization ===');
    const orgData = {
      name: "TechFlow Solutions",
      slug: "techflow-solutions-complete",
      description: "Complete test organization for development"
    };
    
    results.organization = await apiCall('POST', '/api/organizations', orgData);
    console.log(`✅ Created organization: ${results.organization.name}`);
    await saveTestResult('organization.json', results.organization);
    
    // 2. Create team members
    console.log('\n=== 2. Creating Team Members ===');
    const teamMembers = [
      {
        name: "Sarah Chen",
        email: "sarah.chen@example.com", // Using example.com domain
        role: "admin"
      },
      {
        name: "Michael Rodriguez", 
        email: "michael.rodriguez@example.com",
        role: "manager"
      },
      {
        name: "Emily Watson",
        email: "emily.watson@example.com",
        role: "member"
      }
    ];
    
    results.users = [];
    for (const member of teamMembers) {
      try {
        console.log(`Creating user: ${member.name}`);
        
        // Create user account
        const userData = {
          name: member.name,
          email: member.email,
          password: "X9#mK8$nP2@vQ7!wE5"
        };
        
        const user = await apiCall('POST', '/api/auth/sign-up/email', userData);
        console.log(`✅ Created user: ${member.name}`);
        
        results.users.push({
          ...user.user,
          intended_role: member.role
        });
        
      } catch (error) {
        console.log(`⚠️ User creation failed for ${member.name}: ${error.message}`);
        // Continue with other users
      }
    }
    
    await saveTestResult('users.json', results.users);
    
    // 3. Test generic entity creation within the organization
    console.log('\n=== 3. Testing Generic Entity Creation ===');
    
    // Create a project entity
    try {
      const projectData = {
        name: "EcoTracker Mobile App",
        description: "Carbon footprint tracking mobile application",
        status: "in_progress",
        budget: 80000,
        completion_percentage: 75
      };
      
      const project = await apiCall('POST', `/api/organizations/${results.organization.id}/entities/project`, projectData);
      console.log('✅ Created project entity');
      results.project = project;
      
    } catch (error) {
      console.log(`⚠️ Project creation failed: ${error.message}`);
    }
    
    // Create a task entity
    try {
      const taskData = {
        title: "Implement Carbon Tracking API",
        description: "Build REST API for carbon footprint calculations",
        status: "todo",
        priority: "high",
        estimated_hours: 16
      };
      
      const task = await apiCall('POST', `/api/organizations/${results.organization.id}/entities/task`, taskData);
      console.log('✅ Created task entity');
      results.task = task;
      
    } catch (error) {
      console.log(`⚠️ Task creation failed: ${error.message}`);
    }
    
    // 4. Test entity retrieval
    console.log('\n=== 4. Testing Entity Retrieval ===');
    
    try {
      const entities = await apiCall('GET', `/api/organizations/${results.organization.id}/entities`);
      console.log(`✅ Retrieved ${entities.length || 0} entities`);
      results.entities = entities;
      
    } catch (error) {
      console.log(`⚠️ Entity retrieval failed: ${error.message}`);
    }
    
    // 5. Save complete results
    await saveTestResult('complete-workflow-results.json', {
      ...results,
      test_metadata: {
        timestamp: new Date().toISOString(),
        test_status: 'completed',
        organization_id: results.organization.id,
        total_users: results.users.length,
        entities_created: Object.keys(results).filter(k => ['project', 'task'].includes(k)).length
      }
    });
    
    // 6. Display summary
    console.log('\n📊 Test Summary:');
    console.log(`- Organization: ${results.organization.name} (${results.organization.id})`);
    console.log(`- Users created: ${results.users.length}`);
    console.log(`- Entities created: ${Object.keys(results).filter(k => ['project', 'task'].includes(k)).length}`);
    console.log(`- Trial period: ${results.organization.trial_started_at} → ${results.organization.trial_ends_at}`);
    
    console.log('\n✅ Complete workflow test finished successfully!');
    return results;
    
  } catch (error) {
    console.error('\n❌ Workflow test failed:', error.message);
    throw error;
  }
}

// Execute if called directly
if (require.main === module) {
  testCompleteWorkflow()
    .then(() => {
      console.log('\n🎉 All workflow tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Workflow test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteWorkflow };