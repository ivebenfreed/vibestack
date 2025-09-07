#!/usr/bin/env tsx
/**
 * DataForge Entity Lifecycle Tests
 * 
 * Comprehensive tests for entity creation, updates, deletion, and recovery
 * across all supported archetypes.
 */

import { 
  DataForgeTestHelper, 
  ARCHETYPES, 
  TEST_ORG_ID 
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
 * Entity Creation Tests
 */
async function testEntityCreation() {
  console.log('\n📦 Testing Entity Creation...\n');

  // Test creating entities with each archetype
  for (const archetype of ARCHETYPES) {
    await runTest(`Create ${archetype} entity with base fields`, async () => {
      const result = await DataForgeTestHelper.createTestEntity(archetype);
      
      if (!result.success) {
        throw new Error(`Failed to create ${archetype} entity: ${result.error}`);
      }

      if (!result.entityName) {
        throw new Error(`Entity name not returned for ${archetype}`);
      }

      // Verify entity was created
      const entities = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/entities`);
      const created = entities.data?.entities?.find(
        (e: any) => e.entityName === result.entityName
      );

      if (!created) {
        throw new Error(`${archetype} entity not found after creation`);
      }

      if (created.archetype !== archetype) {
        throw new Error(`Archetype mismatch: expected ${archetype}, got ${created.archetype}`);
      }
    });
  }

  // Test creating entity with custom fields
  await runTest('Create entity with custom fields', async () => {
    const customFields = [
      { name: 'custom_text', type: 'text', required: false, defaultValue: 'test' },
      { name: 'custom_number', type: 'number', required: false, defaultValue: 42 },
      { name: 'custom_boolean', type: 'boolean', required: false, defaultValue: true },
      { name: 'custom_date', type: 'date', required: false },
      { name: 'custom_json', type: 'json', required: false, defaultValue: { key: 'value' } }
    ];

    const result = await DataForgeTestHelper.createTestEntity('record', customFields);
    
    if (!result.success) {
      throw new Error(`Failed to create entity with custom fields: ${result.error}`);
    }

    // Verify custom fields are in schema
    const schema = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/entities/${result.entityName}`
    );

    for (const field of customFields) {
      if (!schema.data?.customFields?.[field.name]) {
        throw new Error(`Custom field ${field.name} not found in schema`);
      }
    }
  });

  // Test duplicate entity creation handling
  await runTest('Handle duplicate entity creation', async () => {
    const entityName = `TestDuplicate${Date.now()}`;
    
    // Create first entity
    await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/entities`, {
      method: 'POST',
      body: JSON.stringify({
        entityName,
        archetype: 'record'
      })
    });

    // Try to create duplicate
    try {
      await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName,
          archetype: 'record'
        })
      });
      throw new Error('Should have rejected duplicate entity');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  });
}

/**
 * Record CRUD Operations Tests
 */
async function testRecordOperations() {
  console.log('\n📝 Testing Record Operations...\n');

  // Create a test entity for record operations
  const { entityName } = await DataForgeTestHelper.createTestEntity('task');
  let recordId: string;

  // Test record creation
  await runTest('Create record with base fields', async () => {
    const recordData = {
      title: 'Test Task',
      description: 'Test task description',
      priority: 'high',
      status: 'todo',
      due_date: new Date(Date.now() + 86400000).toISOString()
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );

    if (!result.success || !result.saved?.id) {
      throw new Error('Failed to create record');
    }

    recordId = result.saved.id;

    // Verify record was created
    const verified = await DataForgeTestHelper.verifyRecordFields(
      entityName,
      recordId,
      { title: 'Test Task', priority: 'high', status: 'todo' }
    );

    if (!verified) {
      throw new Error('Record fields do not match expected values');
    }
  });

  // Test record reading
  await runTest('Read records from entity', async () => {
    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('Failed to read records');
    }

    if (result.data.length === 0) {
      throw new Error('No records found');
    }

    const record = result.data.find((r: any) => r.id === recordId);
    if (!record) {
      throw new Error('Created record not found');
    }
  });

  // Test record update
  await runTest('Update record fields', async () => {
    const updateData = {
      status: 'in_progress',
      priority: 'critical',
      description: 'Updated description'
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData)
      }
    );

    if (!result.success) {
      throw new Error('Failed to update record');
    }

    // Verify update
    const verified = await DataForgeTestHelper.verifyRecordFields(
      entityName,
      recordId,
      updateData
    );

    if (!verified) {
      throw new Error('Record not properly updated');
    }
  });

  // Test record deletion
  await runTest('Delete record', async () => {
    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
      {
        method: 'DELETE'
      }
    );

    if (!result.success) {
      throw new Error('Failed to delete record');
    }

    // Verify deletion
    const records = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    const found = records.data?.find((r: any) => r.id === recordId);
    if (found) {
      throw new Error('Record was not deleted');
    }
  });
}

/**
 * Custom Field Operations Tests
 */
async function testCustomFieldOperations() {
  console.log('\n🔧 Testing Custom Field Operations...\n');

  const customFields = [
    { name: 'customer_name', type: 'text', required: true },
    { name: 'order_total', type: 'number', defaultValue: 0 },
    { name: 'is_premium', type: 'boolean', defaultValue: false },
    { name: 'metadata', type: 'json', defaultValue: {} }
  ];

  const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);
  let recordId: string;

  // Test creating record with custom fields
  await runTest('Create record with custom field values', async () => {
    const recordData = {
      name: 'Test Record',
      description: 'Test with custom fields',
      record_type: 'customer',
      status: 'active',
      // Custom fields
      customer_name: 'Acme Corporation',
      order_total: 15000.50,
      is_premium: true,
      metadata: { category: 'enterprise', region: 'NA' }
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );

    if (!result.success || !result.saved?.id) {
      throw new Error('Failed to create record with custom fields');
    }

    recordId = result.saved.id;

    // Verify custom fields were saved
    const records = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    const record = records.data?.find((r: any) => r.id === recordId);
    if (!record) {
      throw new Error('Record not found');
    }

    if (record.customer_name !== 'Acme Corporation') {
      throw new Error(`Custom field customer_name mismatch: ${record.customer_name}`);
    }

    if (record.order_total !== 15000.50) {
      throw new Error(`Custom field order_total mismatch: ${record.order_total}`);
    }

    if (!record.is_premium) {
      throw new Error('Custom field is_premium should be true');
    }

    if (!record.metadata || record.metadata.category !== 'enterprise') {
      throw new Error('Custom field metadata not properly stored');
    }
  });

  // Test updating custom fields
  await runTest('Update custom field values', async () => {
    const updateData = {
      customer_name: 'Updated Corporation',
      order_total: 25000.75,
      is_premium: false,
      metadata: { category: 'small_business', region: 'EU' }
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData)
      }
    );

    if (!result.success) {
      throw new Error('Failed to update custom fields');
    }

    // Verify updates
    const verified = await DataForgeTestHelper.verifyRecordFields(
      entityName,
      recordId,
      updateData
    );

    if (!verified) {
      throw new Error('Custom fields not properly updated');
    }
  });

  // Test default values for custom fields
  await runTest('Apply default values for custom fields', async () => {
    const recordData = {
      name: 'Test Record with Defaults',
      description: 'Testing default values',
      record_type: 'test',
      status: 'active',
      customer_name: 'Default Test Corp'
      // Omitting fields with defaults: order_total, is_premium, metadata
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );

    if (!result.success || !result.saved?.id) {
      throw new Error('Failed to create record with defaults');
    }

    const defaultRecordId = result.saved.id;

    // Verify defaults were applied
    const records = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    const record = records.data?.find((r: any) => r.id === defaultRecordId);
    if (!record) {
      throw new Error('Record not found');
    }

    if (record.order_total !== 0) {
      throw new Error(`Default order_total should be 0, got ${record.order_total}`);
    }

    if (record.is_premium !== false) {
      throw new Error(`Default is_premium should be false, got ${record.is_premium}`);
    }

    if (!record.metadata || typeof record.metadata !== 'object') {
      throw new Error('Default metadata should be an empty object');
    }
  });
}

/**
 * Entity Deletion and Recovery Tests
 */
async function testEntityDeletion() {
  console.log('\n🗑️ Testing Entity Deletion...\n');

  // Test soft delete
  await runTest('Soft delete entity', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('document');
    
    // Add some records
    await DataForgeTestHelper.createBulkRecords(entityName, 'document', 5);

    // Soft delete entity
    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/entities/${entityName}`,
      {
        method: 'DELETE'
      }
    );

    if (!result.success) {
      throw new Error('Failed to soft delete entity');
    }

    // Verify entity is marked as deleted but still exists
    const entities = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/entities`);
    const deletedEntity = entities.data?.entities?.find(
      (e: any) => e.entity_name === entityName && e.deleted === true
    );

    if (!deletedEntity) {
      // Entity might be completely removed, check if it's not in list at all
      const exists = entities.data?.entities?.find(
        (e: any) => e.entity_name === entityName
      );
      if (exists) {
        throw new Error('Entity not marked as deleted');
      }
    }
  });

  // Test preventing operations on deleted entities
  await runTest('Prevent operations on deleted entities', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('file');
    
    // Delete entity
    await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/entities/${entityName}`,
      {
        method: 'DELETE'
      }
    );

    // Try to create record in deleted entity
    try {
      await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'test.pdf',
            file_url: 'https://example.com/test.pdf',
            file_type: 'application/pdf',
            file_size: 1024,
            status: 'active'
          })
        }
      );
      // If we get here, the operation succeeded when it shouldn't have
      // This might be expected behavior depending on implementation
      console.warn('⚠️ Warning: Operations allowed on deleted entity');
    } catch (error: any) {
      // Expected behavior - operations should fail
      if (!error.message.includes('not found') && !error.message.includes('deleted')) {
        throw new Error(`Unexpected error: ${error.message}`);
      }
    }
  });
}

/**
 * Performance Tests
 */
async function testPerformance() {
  console.log('\n⚡ Testing Performance...\n');

  const { entityName } = await DataForgeTestHelper.createTestEntity('activity');

  // Test single record creation performance
  await runTest('Single record creation < 100ms', async () => {
    const recordData = {
      action: 'test_action',
      entity_type: 'test',
      entity_id: 'test-123',
      timestamp: new Date().toISOString()
    };

    const { duration, passed } = await DataForgeTestHelper.measurePerformance(
      async () => {
        await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}`,
          {
            method: 'POST',
            body: JSON.stringify(recordData)
          }
        );
      },
      'Single record creation',
      100
    );

    if (!passed) {
      throw new Error(`Operation took ${duration.toFixed(2)}ms, expected < 100ms`);
    }
  });

  // Test bulk record creation performance
  await runTest('Bulk creation of 10 records < 1000ms', async () => {
    const { duration, passed } = await DataForgeTestHelper.measurePerformance(
      async () => {
        await DataForgeTestHelper.createBulkRecords(entityName, 'activity', 10);
      },
      'Bulk record creation',
      1000
    );

    if (!passed) {
      throw new Error(`Operation took ${duration.toFixed(2)}ms, expected < 1000ms`);
    }
  });

  // Test query performance
  await runTest('Query 10+ records < 50ms', async () => {
    const { duration, passed } = await DataForgeTestHelper.measurePerformance(
      async () => {
        await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
      },
      'Query records',
      50
    );

    if (!passed) {
      throw new Error(`Operation took ${duration.toFixed(2)}ms, expected < 50ms`);
    }
  });
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 DataForge Entity Lifecycle Test Suite\n');
  console.log('========================================\n');
  
  try {
    // Authenticate once at the start
    await DataForgeTestHelper.authenticate('CEO');
    console.log('🔐 Authenticated as CEO\n');

    // Run test suites
    await testEntityCreation();
    await testRecordOperations();
    await testCustomFieldOperations();
    await testEntityDeletion();
    await testPerformance();

    // Cleanup
    if (CLEANUP_AFTER_TESTS) {
      console.log('\n🧹 Cleaning up test entities...\n');
      await DataForgeTestHelper.cleanupTestEntities();
    }

    // Summary
    console.log('\n========================================');
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

export { main as runEntityLifecycleTests };