#!/usr/bin/env node

/**
 * Entity API Testing
 * Tests available entity creation APIs including generic-kysely and archetype APIs
 */

const fs = require('fs');

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
  
  console.log(`🔗 ${method} ${endpoint}`);
  if (data) console.log('📤', JSON.stringify(data, null, 2));
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  console.log(`📥 ${response.status} ${response.statusText}`);
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
    if (response.ok) {
      console.log('📊 Success:', JSON.stringify(jsonResult, null, 2));
    } else {
      console.log('❌ Error:', JSON.stringify(jsonResult, null, 2));
    }
  } catch (e) {
    console.log('📄 Raw response:', result);
    jsonResult = result;
  }
  
  return {
    status: response.status,
    ok: response.ok,
    data: jsonResult
  };
}

async function testEntityAPIs() {
  console.log('🏗️ Testing Available Entity APIs\n');
  
  // Load organization data
  let organization;
  try {
    organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    console.log(`📋 Using organization: ${organization.name} (${organization.id})`);
  } catch (error) {
    console.error('❌ Could not load organization data. Run final-techflow-test.cjs first.');
    process.exit(1);
  }
  
  const entityTestResults = {
    timestamp: new Date().toISOString(),
    organization_id: organization.id,
    api_tests: [],
    successful_entities: [],
    failed_entities: []
  };
  
  // Test 1: Generic Kysely API endpoints
  console.log('\n=== Testing Generic Kysely API ===');
  
  const kyselyEntities = [
    {
      name: 'task',
      data: {
        title: "Implement Carbon Tracking API",
        description: "Build REST API for carbon footprint calculations",
        status: "todo",
        priority: "high",
        estimated_hours: 16
      }
    },
    {
      name: 'project',
      data: {
        name: "EcoTracker Mobile App",
        description: "Carbon footprint tracking mobile application",
        status: "in_progress",
        budget: 80000
      }
    },
    {
      name: 'user',
      data: {
        name: "Test Team Member",
        email: "testmember@techflow.solutions",
        role: "developer"
      }
    },
    {
      name: 'comment',
      data: {
        content: "This is a test comment for the project",
        author: "Test User"
      }
    }
  ];
  
  for (const entity of kyselyEntities) {
    console.log(`\n--- Testing Generic Kysely: ${entity.name} ---`);
    
    const testResult = {
      api_type: 'generic-kysely',
      entity_name: entity.name,
      tests: {}
    };
    
    // Test entity creation
    const createResponse = await apiCall('POST', `/api/generic-kysely/${entity.name}`, entity.data);
    testResult.tests.create = createResponse;
    
    if (createResponse.ok) {
      console.log(`✅ Created ${entity.name} successfully`);
      entityTestResults.successful_entities.push({...entity, api: 'generic-kysely', id: createResponse.data?.id});
      
      // Test entity retrieval if we got an ID
      if (createResponse.data?.id) {
        const getResponse = await apiCall('GET', `/api/generic-kysely/${entity.name}/${createResponse.data.id}`);
        testResult.tests.get = getResponse;
        
        if (getResponse.ok) {
          console.log(`✅ Retrieved ${entity.name} successfully`);
        } else {
          console.log(`⚠️ Failed to retrieve ${entity.name}`);
        }
      }
      
    } else {
      console.log(`❌ Failed to create ${entity.name}`);
      entityTestResults.failed_entities.push({...entity, api: 'generic-kysely', error: createResponse.data});
    }
    
    entityTestResults.api_tests.push(testResult);
  }
  
  // Test 2: Universal Archetype API
  console.log('\n=== Testing Universal Archetype API ===');
  
  const archetypeEntities = [
    {
      entityName: 'ProjectEntity',
      definition: {
        archetype: 'project',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'longtext' },
          { name: 'status', type: 'status_option', defaultValue: 'active' },
          { name: 'budget', type: 'decimal' },
          { name: 'start_date', type: 'date' },
          { name: 'completion_percentage', type: 'integer' }
        ],
        syncable: true
      }
    },
    {
      entityName: 'TaskEntity',
      definition: {
        archetype: 'task',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'longtext' },
          { name: 'status', type: 'status_option', defaultValue: 'todo' },
          { name: 'priority', type: 'priority_option', defaultValue: 'medium' },
          { name: 'estimated_hours', type: 'integer' },
          { name: 'assigned_to', type: 'user_reference' }
        ],
        syncable: true
      }
    }
  ];
  
  for (const entity of archetypeEntities) {
    console.log(`\n--- Testing Universal Archetype: ${entity.entityName} ---`);
    
    const testResult = {
      api_type: 'universal-archetype',
      entity_name: entity.entityName,
      tests: {}
    };
    
    // Test archetype entity definition
    const archetypeResponse = await apiCall('POST', `/api/archetype/orgs/${organization.id}/entities`, entity);
    testResult.tests.create_definition = archetypeResponse;
    
    if (archetypeResponse.ok) {
      console.log(`✅ Created ${entity.entityName} archetype successfully`);
      entityTestResults.successful_entities.push({...entity, api: 'universal-archetype'});
    } else {
      console.log(`❌ Failed to create ${entity.entityName} archetype`);
      entityTestResults.failed_entities.push({...entity, api: 'universal-archetype', error: archetypeResponse.data});
    }
    
    entityTestResults.api_tests.push(testResult);
  }
  
  // Test 3: DataForge API
  console.log('\n=== Testing DataForge API ===');
  
  const dataforgeTests = [
    { endpoint: '/api/dataforge/health', method: 'GET', description: 'DataForge health check' },
    { endpoint: '/api/dataforge/entities', method: 'GET', description: 'List DataForge entities' },
    { endpoint: '/api/dataforge/schemas', method: 'GET', description: 'List DataForge schemas' }
  ];
  
  for (const test of dataforgeTests) {
    console.log(`\nTesting DataForge: ${test.description}`);
    
    const response = await apiCall(test.method, test.endpoint);
    
    const testResult = {
      api_type: 'dataforge',
      test_name: test.description,
      endpoint: test.endpoint,
      method: test.method,
      response: response
    };
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Success`);
    } else {
      console.log(`❌ ${test.description}: Failed`);
    }
    
    entityTestResults.api_tests.push(testResult);
  }
  
  // Test 4: Organization-scoped entity operations
  console.log('\n=== Testing Organization-Scoped Operations ===');
  
  // Test accessing created entities through organization context
  const orgScopedTests = [
    { endpoint: `/api/organizations/${organization.id}`, method: 'GET', description: 'Get organization details' },
    { endpoint: `/api/organizations/${organization.id}/members`, method: 'GET', description: 'Get organization members' }
  ];
  
  for (const test of orgScopedTests) {
    console.log(`\nTesting: ${test.description}`);
    
    const response = await apiCall(test.method, test.endpoint);
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Success`);
    } else {
      console.log(`❌ ${test.description}: Failed`);
    }
  }
  
  // Save results
  fs.writeFileSync('./entity-api-test-results.json', JSON.stringify(entityTestResults, null, 2));
  console.log('\n✅ Saved: entity-api-test-results.json');
  
  // Summary
  console.log('\n📊 === ENTITY API TEST SUMMARY ===');
  console.log(`Organization: ${organization.name}`);
  console.log(`Total API Tests: ${entityTestResults.api_tests.length}`);
  console.log(`✅ Successful Entities: ${entityTestResults.successful_entities.length}`);
  console.log(`❌ Failed Entities: ${entityTestResults.failed_entities.length}`);
  
  if (entityTestResults.successful_entities.length > 0) {
    console.log('\n✅ Successfully Created:');
    entityTestResults.successful_entities.forEach(entity => {
      console.log(`  - ${entity.entityName || entity.name} (${entity.api})`);
    });
  }
  
  if (entityTestResults.failed_entities.length > 0) {
    console.log('\n❌ Failed to Create:');
    entityTestResults.failed_entities.forEach(entity => {
      console.log(`  - ${entity.entityName || entity.name} (${entity.api})`);
    });
  }
  
  console.log(`\n🔧 Available APIs Tested:`);
  console.log('  - Generic Kysely API (/api/generic-kysely)');
  console.log('  - Universal Archetype API (/api/archetype)');
  console.log('  - DataForge API (/api/dataforge)');
  console.log('  - Organization Management API (/api/organizations)');
  
  return entityTestResults;
}

// Execute if called directly
if (require.main === module) {
  testEntityAPIs()
    .then(() => {
      console.log('\n🎉 Entity API testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Entity API testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testEntityAPIs };