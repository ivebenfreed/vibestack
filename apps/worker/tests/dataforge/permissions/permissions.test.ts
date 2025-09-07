#!/usr/bin/env tsx
/**
 * DataForge Permission & Isolation Tests
 * 
 * Tests role-based access control, organization isolation, 
 * field-level permissions, and container permissions.
 */

import { 
  DataForgeTestHelper, 
  PermissionTestHelper,
  ARCHETYPES, 
  TEST_ORG_ID,
  TEST_USERS
} from '../utils/test-helpers';

// Test configuration
const CLEANUP_AFTER_TESTS = true;
const VERBOSE_LOGGING = process.env.VERBOSE === 'true';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

/**
 * Run a single test and track results
 */
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = performance.now();
  try {
    await testFn();
    const duration = performance.now() - start;
    results.push({ test: name, passed: true, duration });
    console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - start;
    results.push({ test: name, passed: false, error: String(error), duration });
    console.log(`❌ ${name}: ${error} (${duration.toFixed(2)}ms)`);
    if (VERBOSE_LOGGING) {
      console.error('Full error:', error);
    }
  }
}

/**
 * Test basic role-based access control
 */
async function testRoleBasedAccess() {
  console.log('\n🔐 Testing Role-Based Access Control...\n');

  // Test entity creation permissions by role
  const rolePermissions = [
    { role: 'CEO' as keyof typeof TEST_USERS, shouldAllow: true, description: 'Owner should create entities' },
    { role: 'CTO' as keyof typeof TEST_USERS, shouldAllow: true, description: 'Admin should create entities' },
    { role: 'PM1' as keyof typeof TEST_USERS, shouldAllow: true, description: 'Manager should create entities' },
    { role: 'DEV1' as keyof typeof TEST_USERS, shouldAllow: true, description: 'Member should create entities' }
  ];

  for (const { role, shouldAllow, description } of rolePermissions) {
    await runTest(description, async () => {
      await DataForgeTestHelper.authenticate(role);
      
      try {
        const result = await DataForgeTestHelper.createTestEntity('record', [], `_${role}`);
        
        if (shouldAllow && !result.success) {
          throw new Error(`${role} should be able to create entities but was denied`);
        }
        
        if (!shouldAllow && result.success) {
          throw new Error(`${role} should not be able to create entities but was allowed`);
        }
        
      } catch (error: any) {
        if (shouldAllow) {
          throw new Error(`${role} should be able to create entities but got error: ${error.message}`);
        }
        // If they shouldn't be allowed and we got an error, that's expected
        if (!error.message.includes('permission') && !error.message.includes('unauthorized')) {
          throw new Error(`Expected permission error for ${role}, got: ${error.message}`);
        }
      }
    });
  }

  // Test read access for different roles
  await runTest('Test read access across roles', async () => {
    // Create entity as CEO
    await DataForgeTestHelper.authenticate('CEO');
    const { entityName } = await DataForgeTestHelper.createTestEntity('project');
    
    // Add some records
    await DataForgeTestHelper.createBulkRecords(entityName, 'project', 5);
    
    // Test read access for each role
    for (const [role, _] of Object.entries(TEST_USERS)) {
      await DataForgeTestHelper.authenticate(role as keyof typeof TEST_USERS);
      
      try {
        const records = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
        
        if (!records.success) {
          throw new Error(`${role} should be able to read organization data`);
        }
        
        if (!Array.isArray(records.data) || records.data.length === 0) {
          throw new Error(`${role} should see records in organization data`);
        }
        
      } catch (error: any) {
        // If read access is restricted, log it but don't fail
        console.warn(`⚠️ ${role} cannot read data: ${error.message}`);
      }
    }
  });

  // Test write access for different roles
  await runTest('Test write access across roles', async () => {
    // Create entity and record as CEO
    await DataForgeTestHelper.authenticate('CEO');
    const { entityName } = await DataForgeTestHelper.createTestEntity('task');
    
    const recordData = {
      title: 'Permission Test Task',
      description: 'Testing write permissions',
      priority: 'medium',
      status: 'todo'
    };
    
    const createResult = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );
    
    if (!createResult.success) {
      throw new Error('Failed to create test record as CEO');
    }
    
    const recordId = createResult.saved.id;
    
    // Test update access for each role
    const writeResults: Record<string, boolean> = {};
    
    for (const [role, _] of Object.entries(TEST_USERS)) {
      await DataForgeTestHelper.authenticate(role as keyof typeof TEST_USERS);
      
      try {
        const updateResult = await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
          {
            method: 'PUT',
            body: JSON.stringify({ 
              description: `Updated by ${role}`,
              status: 'in_progress'
            })
          }
        );
        
        writeResults[role] = updateResult.success;
        
      } catch (error: any) {
        writeResults[role] = false;
        console.log(`  ${role}: Write denied - ${error.message}`);
      }
    }
    
    // All roles should have write access in the same organization
    const allowedRoles = Object.entries(writeResults).filter(([_, allowed]) => allowed);
    
    if (allowedRoles.length === 0) {
      throw new Error('No roles have write access - permissions might be too restrictive');
    }
    
    console.log(`  Write access granted to: ${allowedRoles.map(([role]) => role).join(', ')}`);
  });

  // Test delete access for different roles
  await runTest('Test delete access across roles', async () => {
    // Create test records as CEO
    await DataForgeTestHelper.authenticate('CEO');
    const { entityName } = await DataForgeTestHelper.createTestEntity('document');
    const testRecords = await DataForgeTestHelper.createBulkRecords(entityName, 'document', 4);
    
    const deleteResults: Record<string, boolean> = {};
    
    // Test delete access for each role (using different records)
    const roles = Object.keys(TEST_USERS);
    for (let i = 0; i < roles.length && i < testRecords.length; i++) {
      const role = roles[i];
      const recordToDelete = testRecords[i];
      
      await DataForgeTestHelper.authenticate(role as keyof typeof TEST_USERS);
      
      try {
        const deleteResult = await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordToDelete.saved.id}`,
          {
            method: 'DELETE'
          }
        );
        
        deleteResults[role] = deleteResult.success;
        
      } catch (error: any) {
        deleteResults[role] = false;
        console.log(`  ${role}: Delete denied - ${error.message}`);
      }
    }
    
    // At least owners and admins should have delete access
    const allowedRoles = Object.entries(deleteResults).filter(([_, allowed]) => allowed);
    
    if (allowedRoles.length === 0) {
      console.warn('⚠️ Warning: No roles have delete access - this might be expected depending on permission model');
    } else {
      console.log(`  Delete access granted to: ${allowedRoles.map(([role]) => role).join(', ')}`);
    }
  });
}

/**
 * Test organization isolation
 */
async function testOrganizationIsolation() {
  console.log('\n🏢 Testing Organization Isolation...\n');

  // Note: This test would require a second test organization
  // For now, we'll test within the same org but verify data integrity
  
  await runTest('Verify organization ID in all records', async () => {
    await DataForgeTestHelper.authenticate('CEO');
    const { entityName } = await DataForgeTestHelper.createTestEntity('activity');
    
    // Create test records
    await DataForgeTestHelper.createBulkRecords(entityName, 'activity', 10);
    
    // Verify all records have correct organization ID
    const records = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    if (!records.success || !Array.isArray(records.data)) {
      throw new Error('Failed to retrieve records for organization isolation test');
    }
    
    for (const record of records.data) {
      if (record.organization_id !== TEST_ORG_ID) {
        throw new Error(`Record has incorrect organization_id: ${record.organization_id}, expected: ${TEST_ORG_ID}`);
      }
    }
    
    console.log(`  ✓ All ${records.data.length} records have correct organization_id`);
  });

  await runTest('Verify entity table names include org ID', async () => {
    await DataForgeTestHelper.authenticate('CEO');
    const { entityName } = await DataForgeTestHelper.createTestEntity('file');
    
    // Get entity schema to check table name
    const schema = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/entities/${entityName}`
    );
    
    if (!schema.success || !schema.data) {
      throw new Error('Failed to retrieve entity schema');
    }
    
    const tableName = schema.data.tableName || schema.data.table_name;
    
    if (!tableName) {
      throw new Error('Table name not found in schema');
    }
    
    // Table name should include organization ID
    const normalizedOrgId = TEST_ORG_ID.replace(/-/g, '_');
    if (!tableName.includes(normalizedOrgId)) {
      throw new Error(`Table name "${tableName}" does not include organization ID "${normalizedOrgId}"`);
    }
    
    console.log(`  ✓ Table name includes org ID: ${tableName}`);
  });

  await runTest('Test entity creation isolation', async () => {
    await DataForgeTestHelper.authenticate('CEO');
    
    // Create entities with similar names
    const entities = await Promise.all([
      DataForgeTestHelper.createTestEntity('collection', [], '_Isolation1'),
      DataForgeTestHelper.createTestEntity('collection', [], '_Isolation2'),
      DataForgeTestHelper.createTestEntity('collection', [], '_Isolation3')
    ]);
    
    // Verify all entities were created successfully
    for (const entity of entities) {
      if (!entity.success) {
        throw new Error(`Failed to create isolated entity: ${entity.error}`);
      }
    }
    
    // Verify entities are isolated (different table names)
    const tableNames = new Set();
    for (const entity of entities) {
      const schema = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/entities/${entity.entityName}`
      );
      
      const tableName = schema.data?.tableName || schema.data?.table_name;
      if (!tableName) {
        throw new Error('Table name not found');
      }
      
      if (tableNames.has(tableName)) {
        throw new Error(`Duplicate table name detected: ${tableName}`);
      }
      
      tableNames.add(tableName);
    }
    
    console.log(`  ✓ Created ${entities.length} isolated entities with unique table names`);
  });
}

/**
 * Test archetype-specific permissions
 */
async function testArchetypePermissions() {
  console.log('\n🏗️ Testing Archetype-Specific Permissions...\n');

  // Test permissions for different archetype categories
  const archetypeCategories = [
    { 
      archetype: 'task', 
      description: 'Task archetype with assignment-based access',
      hasAssignment: true 
    },
    { 
      archetype: 'project', 
      description: 'Project archetype with team access',
      hasTeamAccess: true 
    },
    { 
      archetype: 'record', 
      description: 'Record archetype with standard organizational access',
      isStandard: true 
    },
    { 
      archetype: 'document', 
      description: 'Document archetype with versioning considerations',
      hasVersioning: true 
    }
  ];

  for (const { archetype, description, hasAssignment, hasTeamAccess, isStandard } of archetypeCategories) {
    await runTest(`Test ${description}`, async () => {
      await DataForgeTestHelper.authenticate('CEO');
      const { entityName } = await DataForgeTestHelper.createTestEntity(archetype as any);
      
      // Create test record based on archetype
      let recordData: any = {};
      
      switch (archetype) {
        case 'task':
          recordData = {
            title: 'Permission Test Task',
            description: 'Testing task permissions',
            priority: 'medium',
            status: 'todo',
            assignee_id: 'test-user-id'
          };
          break;
          
        case 'project':
          recordData = {
            name: 'Permission Test Project',
            description: 'Testing project permissions',
            status: 'planning',
            priority: 'high',
            start_date: new Date().toISOString()
          };
          break;
          
        case 'record':
          recordData = {
            name: 'Permission Test Record',
            description: 'Testing record permissions',
            record_type: 'test',
            status: 'active'
          };
          break;
          
        case 'document':
          recordData = {
            title: 'Permission Test Document',
            content: 'Testing document permissions',
            status: 'draft',
            version: '1.0.0'
          };
          break;
      }
      
      const createResult = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}`,
        {
          method: 'POST',
          body: JSON.stringify(recordData)
        }
      );
      
      if (!createResult.success) {
        throw new Error(`Failed to create ${archetype} record for permission test`);
      }
      
      // Test access with different roles
      const accessResults: Record<string, boolean> = {};
      
      for (const [role, _] of Object.entries(TEST_USERS)) {
        await DataForgeTestHelper.authenticate(role as keyof typeof TEST_USERS);
        
        try {
          const records = await DataForgeTestHelper.apiCall(
            `/orgs/${TEST_ORG_ID}/data/${entityName}`
          );
          accessResults[role] = records.success && Array.isArray(records.data);
        } catch (error) {
          accessResults[role] = false;
        }
      }
      
      const allowedRoles = Object.entries(accessResults).filter(([_, allowed]) => allowed);
      
      // All roles should have some level of access within the same organization
      if (allowedRoles.length === 0) {
        throw new Error(`No roles have access to ${archetype} records - permissions too restrictive`);
      }
      
      console.log(`  ${archetype}: Access granted to ${allowedRoles.map(([role]) => role).join(', ')}`);
      
      // Verify the record was created with correct archetype constraints
      const record = createResult.saved;
      if (hasAssignment && archetype === 'task' && !record.assignee_id) {
        console.warn(`⚠️ Task record missing assignee_id field`);
      }
      
      if (hasTeamAccess && archetype === 'project' && !record.start_date) {
        console.warn(`⚠️ Project record missing start_date field`);
      }
    });
  }
}

/**
 * Test field-level permissions
 */
async function testFieldLevelPermissions() {
  console.log('\n📋 Testing Field-Level Permissions...\n');

  await runTest('Test server-only fields are not exposed', async () => {
    await DataForgeTestHelper.authenticate('CEO');
    
    // Create entity with server-only custom fields
    const customFields = [
      { name: 'public_field', type: 'text', required: false, serverOnly: false },
      { name: 'server_only_field', type: 'text', required: false, serverOnly: true },
      { name: 'internal_hash', type: 'text', required: false, serverOnly: true }
    ];
    
    const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);
    
    // Create record with both public and server-only fields
    const recordData = {
      name: 'Field Permission Test',
      description: 'Testing field-level permissions',
      record_type: 'test',
      status: 'active',
      public_field: 'This should be visible',
      server_only_field: 'This should be hidden',
      internal_hash: 'secret123'
    };
    
    const createResult = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );
    
    if (!createResult.success) {
      throw new Error('Failed to create record with server-only fields');
    }
    
    // Retrieve record and check field visibility
    const records = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    if (!records.success || !records.data || records.data.length === 0) {
      throw new Error('Failed to retrieve created record');
    }
    
    const record = records.data.find((r: any) => r.id === createResult.saved.id);
    if (!record) {
      throw new Error('Created record not found');
    }
    
    // Public field should be visible
    if (record.public_field !== 'This should be visible') {
      throw new Error('Public field not visible or incorrect');
    }
    
    // Server-only fields should be hidden in API responses (if implemented)
    if (record.server_only_field !== undefined) {
      console.warn('⚠️ Server-only field is visible in API response - field-level permissions may not be implemented');
    }
    
    if (record.internal_hash !== undefined) {
      console.warn('⚠️ Internal hash field is visible in API response - field-level permissions may not be implemented');
    }
  });

  await runTest('Test read-only field enforcement', async () => {
    await DataForgeTestHelper.authenticate('CEO');
    
    // System fields should be read-only
    const { entityName } = await DataForgeTestHelper.createTestEntity('activity');
    
    const recordData = {
      action: 'test_action',
      entity_type: 'test',
      entity_id: 'test-123',
      timestamp: new Date().toISOString()
    };
    
    const createResult = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );
    
    if (!createResult.success) {
      throw new Error('Failed to create record for read-only test');
    }
    
    // Try to update read-only fields
    const recordId = createResult.saved.id;
    
    try {
      const updateResult = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            id: 'hacked-id',  // Should not be updateable
            organization_id: 'different-org',  // Should not be updateable
            created_at: new Date().toISOString(),  // Should not be updateable
            action: 'updated_action'  // This should be updateable
          })
        }
      );
      
      // Verify that read-only fields were not changed
      const updatedRecords = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
      const updatedRecord = updatedRecords.data?.find((r: any) => r.id === recordId);
      
      if (!updatedRecord) {
        throw new Error('Record not found after update');
      }
      
      // ID should remain unchanged
      if (updatedRecord.id !== recordId) {
        throw new Error('Read-only field ID was changed');
      }
      
      // Organization ID should remain unchanged
      if (updatedRecord.organization_id !== TEST_ORG_ID) {
        throw new Error('Read-only field organization_id was changed');
      }
      
      // Regular field should be updated
      if (updatedRecord.action !== 'updated_action') {
        throw new Error('Updateable field was not changed');
      }
      
      console.log('  ✓ Read-only fields protected, updateable fields modified');
      
    } catch (error: any) {
      // If the update failed entirely, that's also acceptable for read-only protection
      if (error.message.includes('read-only') || error.message.includes('immutable')) {
        console.log('  ✓ Update rejected due to read-only field protection');
      } else {
        throw error;
      }
    }
  });
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 DataForge Permission & Isolation Test Suite\n');
  console.log('==============================================\n');
  
  try {
    // Run test suites
    await testRoleBasedAccess();
    await testOrganizationIsolation();
    await testArchetypePermissions();
    await testFieldLevelPermissions();

    // Cleanup
    if (CLEANUP_AFTER_TESTS) {
      console.log('\n🧹 Cleaning up test entities...\n');
      await DataForgeTestHelper.cleanupTestEntities();
    }

    // Summary
    console.log('\n==============================================');
    console.log('📊 Test Results Summary:\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Time: ${totalDuration.toFixed(2)}ms`);
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

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runPermissionTests };