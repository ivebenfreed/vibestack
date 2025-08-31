#!/usr/bin/env tsx
/**
 * Comprehensive DataForge API Test Suite
 * Tests all CRUD operations with archetype enforcement
 */

const API_BASE = 'http://localhost:8787/api/dataforge';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

// Read cookie from cookies.txt file (Netscape format)
import { readFileSync } from 'fs';
import { join } from 'path';

// Read from the project root cookies.txt
const cookieFile = readFileSync('../../cookies.txt', 'utf-8');
const cookieLine = cookieFile.split('\n').find(line => 
  line.includes('better-auth.session_token')
);

if (!cookieLine) {
  console.error('❌ No session token found in cookies.txt');
  console.error('Please run: curl -X POST "http://localhost:8787/api/auth/sign-in/email" -H "Content-Type: application/json" -d "{\"email\": \"ceo@widecorp.com\", \"password\": \"WideCorp2024!CEO\"}" -c cookies.txt');
  process.exit(1);
}

const cookieParts = cookieLine.split('\t');
const COOKIE = cookieParts.length >= 7 ? `${cookieParts[5]}=${cookieParts[6]}` : '';

if (!COOKIE) {
  console.error('❌ Failed to parse cookie from cookies.txt');
  process.exit(1);
}

console.log('🔐 Using session cookie from cookies.txt');

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
    results.push({ test: name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ test: name, passed: false, error: String(error) });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function apiCall(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': COOKIE,
      ...options.headers,
    },
  });
  
  const data = await response.json();
  if (!response.ok && !data.error?.includes('already exists')) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function main() {
  console.log('🧪 Testing DataForge API Operations\n');
  
  // Test 1: List archetypes
  await runTest('List all archetypes', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/archetypes`);
    if (result.data.archetypes.length !== 8) {
      throw new Error(`Expected 8 archetypes, got ${result.data.archetypes.length}`);
    }
  });
  
  // Test 2: Get specific archetype
  await runTest('Get project archetype details', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/archetypes/project`);
    if (result.data.name !== 'project') {
      throw new Error(`Expected project archetype, got ${result.data.name}`);
    }
  });
  
  // Test 3: Invalid archetype rejection
  await runTest('Reject invalid archetype', async () => {
    try {
      await apiCall(`/orgs/${ORG_ID}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'InvalidEntity',
          archetype: 'invalid_type',
        }),
      });
      throw new Error('Should have rejected invalid archetype');
    } catch (error: any) {
      if (!error.message.includes('Invalid archetype')) {
        throw error;
      }
    }
  });
  
  // Test 4: Create entity with valid archetype
  const testEntityName = `TestEntity${Date.now()}`;
  await runTest('Create entity with valid archetype', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      body: JSON.stringify({
        entityName: testEntityName,
        archetype: 'record',
        customFields: [
          { name: 'test_field', type: 'text', required: false },
        ],
      }),
    });
    if (!result.success) {
      throw new Error('Failed to create entity');
    }
  });
  
  // Test 5: Create record
  let recordId: string;
  await runTest('Create record in entity', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Record',
        description: 'Test description',
        record_type: 'test',
        status: 'active',
        test_field: 'Test value',
      }),
    });
    if (!result.success) {
      throw new Error('Failed to create record');
    }
    recordId = result.saved.id;
  });
  
  // Test 6: Read records
  await runTest('Read records from entity', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}`);
    if (!result.success || result.data.length === 0) {
      throw new Error('Failed to read records');
    }
  });
  
  // Test 7: Update record
  await runTest('Update record', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({
        test_field: 'Updated value',
        status: 'inactive',
      }),
    });
    if (!result.success) {
      throw new Error('Failed to update record');
    }
  });
  
  // Test 8: Verify update
  await runTest('Verify record update', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}`);
    const record = result.data.find((r: any) => r.id === recordId);
    if (record.test_field !== 'Updated value' || record.status !== 'inactive') {
      throw new Error('Record not properly updated');
    }
  });
  
  // Test 9: Delete record
  await runTest('Delete record', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}/${recordId}`, {
      method: 'DELETE',
    });
    if (!result.success) {
      throw new Error('Failed to delete record');
    }
  });
  
  // Test 10: Verify deletion
  await runTest('Verify record deletion', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/data/${testEntityName}`);
    const record = result.data.find((r: any) => r.id === recordId);
    if (record) {
      throw new Error('Record was not deleted');
    }
  });
  
  // Test 11: Get schema
  await runTest('Get organization schema', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/schema`);
    if (!result.success || !result.schema.entities) {
      throw new Error('Failed to get schema');
    }
  });
  
  // Test 12: List entities
  await runTest('List all entities', async () => {
    const result = await apiCall(`/orgs/${ORG_ID}/entities`);
    if (!result.success || !result.data.entities) {
      throw new Error('Failed to list entities');
    }
  });
  
  // Test 13: Handle duplicate entity creation
  await runTest('Handle duplicate entity creation gracefully', async () => {
    const duplicateEntityName = `TestDuplicate${Date.now()}`;
    
    // First create an entity
    await apiCall(`/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      body: JSON.stringify({
        entityName: duplicateEntityName,
        archetype: 'record',
      }),
    });
    
    try {
      // Try to create the same entity again
      await apiCall(`/orgs/${ORG_ID}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: duplicateEntityName,
          archetype: 'record',
        }),
      });
      throw new Error('Should have rejected duplicate entity');
    } catch (error: any) {
      if (!error.message.includes('Entity already exists')) {
        throw error;
      }
    }
  });
  
  // Test 14: Delete entity
  await runTest('Delete entity', async () => {
    const deleteEntityName = `TestDeleteEntity${Date.now()}`;
    // First create an entity to delete
    await apiCall(`/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      body: JSON.stringify({
        entityName: deleteEntityName,
        archetype: 'record',
      }),
    });
    
    // Now delete it
    const result = await apiCall(`/orgs/${ORG_ID}/entities/${deleteEntityName}`, {
      method: 'DELETE',
    });
    
    if (!result.success) {
      throw new Error('Failed to delete entity');
    }
  });
  
  // Test 15-22: Test all archetypes
  const archetypes = ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'];
  for (const archetype of archetypes) {
    await runTest(`Create entity with ${archetype} archetype`, async () => {
      const result = await apiCall(`/orgs/${ORG_ID}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: `Test${archetype.charAt(0).toUpperCase() + archetype.slice(1)}${Date.now()}`,
          archetype: archetype,
          customFields: [],
        }),
      });
      if (!result.success && !result.error?.includes('already exists')) {
        throw new Error(`Failed to create ${archetype} entity`);
      }
    });
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

main().catch(console.error);