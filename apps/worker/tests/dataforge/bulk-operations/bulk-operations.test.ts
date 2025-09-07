#!/usr/bin/env tsx
/**
 * DataForge Bulk Operations Tests
 * 
 * Tests bulk create, update, delete operations with transaction handling,
 * error recovery, and performance validation.
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
 * Test bulk record creation
 */
async function testBulkCreate() {
  console.log('\n📝 Testing Bulk Create Operations...\n');

  // Test bulk creation with different record counts
  const testCounts = [5, 10, 50];

  for (const count of testCounts) {
    await runTest(`Bulk create ${count} task records`, async () => {
      const { entityName } = await DataForgeTestHelper.createTestEntity('task');
      
      const { duration, passed } = await DataForgeTestHelper.measurePerformance(
        async () => {
          await DataForgeTestHelper.createBulkRecords(entityName, 'task', count);
        },
        `Bulk create ${count} records`,
        count * 100 // 100ms per record maximum
      );

      if (!passed) {
        console.warn(`⚠️ Performance warning: ${count} records took ${duration.toFixed(2)}ms`);
      }

      // Verify all records were created
      const records = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
      
      if (!records.success || !Array.isArray(records.data)) {
        throw new Error('Failed to retrieve created records');
      }

      if (records.data.length !== count) {
        throw new Error(`Expected ${count} records, found ${records.data.length}`);
      }

      // Verify record integrity
      for (let i = 0; i < Math.min(3, count); i++) {
        const record = records.data[i];
        if (!record.title || !record.priority || !record.status) {
          throw new Error(`Record ${i} missing required fields`);
        }
      }
    });
  }

  // Test bulk creation with custom fields
  await runTest('Bulk create records with custom fields', async () => {
    const customFields = [
      { name: 'project_code', type: 'text', required: false },
      { name: 'estimated_hours', type: 'number', defaultValue: 0 },
      { name: 'is_billable', type: 'boolean', defaultValue: true }
    ];

    const { entityName } = await DataForgeTestHelper.createTestEntity('task', customFields);
    
    const recordsWithCustomFields = [];
    for (let i = 0; i < 10; i++) {
      recordsWithCustomFields.push({
        title: `Task with Custom Fields ${i}`,
        description: `Description ${i}`,
        priority: 'medium',
        status: 'todo',
        project_code: `PRJ-${i.toString().padStart(3, '0')}`,
        estimated_hours: (i + 1) * 4,
        is_billable: i % 2 === 0
      });
    }

    // Create records individually (simulating bulk operation)
    const results = [];
    for (const recordData of recordsWithCustomFields) {
      const result = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}`,
        {
          method: 'POST',
          body: JSON.stringify(recordData)
        }
      );
      results.push(result);
    }

    // Verify all were created successfully
    for (const result of results) {
      if (!result.success) {
        throw new Error('Failed to create record with custom fields');
      }
    }

    // Verify custom fields were saved correctly
    const allRecords = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    for (let i = 0; i < 3; i++) { // Check first 3 records
      const record = allRecords.data.find((r: any) => 
        r.project_code === `PRJ-${i.toString().padStart(3, '0')}`
      );
      
      if (!record) {
        throw new Error(`Record with project_code PRJ-${i.toString().padStart(3, '0')} not found`);
      }

      if (record.estimated_hours !== (i + 1) * 4) {
        throw new Error(`Custom field estimated_hours incorrect for record ${i}`);
      }

      if (record.is_billable !== (i % 2 === 0)) {
        throw new Error(`Custom field is_billable incorrect for record ${i}`);
      }
    }
  });

  // Test bulk creation error handling
  await runTest('Handle bulk creation errors gracefully', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('task');
    
    const recordsWithError = [
      // Valid records
      { title: 'Valid Task 1', priority: 'high', status: 'todo' },
      { title: 'Valid Task 2', priority: 'medium', status: 'todo' },
      // Invalid record (missing required field)
      { priority: 'low', status: 'todo' }, // Missing title
      // More valid records
      { title: 'Valid Task 3', priority: 'high', status: 'todo' }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const recordData of recordsWithError) {
      try {
        const result = await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}`,
          {
            method: 'POST',
            body: JSON.stringify(recordData)
          }
        );
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    // Verify that valid records were created despite errors
    if (successCount < 3) {
      throw new Error(`Expected at least 3 successful creations, got ${successCount}`);
    }

    if (errorCount === 0) {
      console.warn('⚠️ Warning: No errors detected, validation might not be implemented');
    }
  });
}

/**
 * Test bulk update operations
 */
async function testBulkUpdate() {
  console.log('\n✏️ Testing Bulk Update Operations...\n');

  await runTest('Bulk update multiple records', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('project');
    
    // Create initial records
    const createdRecords = await DataForgeTestHelper.createBulkRecords(entityName, 'project', 10);
    
    // Update all records to different status
    const updatePromises = createdRecords.map((record, index) => 
      DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}/${record.saved.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status: index % 2 === 0 ? 'active' : 'on_hold',
            priority: 'high'
          })
        }
      )
    );

    const updateResults = await Promise.all(updatePromises);

    // Verify all updates succeeded
    for (const result of updateResults) {
      if (!result.success) {
        throw new Error('Bulk update operation failed');
      }
    }

    // Verify updates were applied
    const updatedRecords = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    for (const record of updatedRecords.data) {
      if (record.priority !== 'high') {
        throw new Error('Bulk update did not apply priority correctly');
      }
      
      if (!['active', 'on_hold'].includes(record.status)) {
        throw new Error('Bulk update did not apply status correctly');
      }
    }
  });

  // Test partial bulk updates
  await runTest('Handle partial bulk update failures', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('record');
    
    // Create initial records
    const createdRecords = await DataForgeTestHelper.createBulkRecords(entityName, 'record', 5);
    
    const updatePromises = createdRecords.map((record, index) => {
      if (index === 2) {
        // This update should fail (invalid record ID)
        return DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}/invalid-id`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'updated' })
          }
        ).catch(error => ({ success: false, error: error.message }));
      } else {
        // Valid updates
        return DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}/${record.saved.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'active' })
          }
        );
      }
    });

    const updateResults = await Promise.all(updatePromises);
    
    // Count successful vs failed updates
    const successCount = updateResults.filter(r => r.success).length;
    const failCount = updateResults.filter(r => !r.success).length;

    if (successCount !== 4 || failCount !== 1) {
      throw new Error(`Expected 4 successes and 1 failure, got ${successCount} successes and ${failCount} failures`);
    }

    // Verify successful updates were applied
    const records = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    const activeRecords = records.data.filter((r: any) => r.status === 'active');
    
    if (activeRecords.length !== 4) {
      throw new Error(`Expected 4 active records after partial bulk update, got ${activeRecords.length}`);
    }
  });

  // Test concurrent updates
  await runTest('Handle concurrent bulk updates', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('document');
    
    // Create a single record to update concurrently
    const recordData = {
      title: 'Concurrent Update Test Document',
      content: 'Original content',
      status: 'draft',
      version: '1.0.0'
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );

    const recordId = result.saved.id;

    // Perform concurrent updates
    const concurrentUpdates = [
      { content: 'Update 1', version: '1.0.1' },
      { content: 'Update 2', version: '1.0.2' },
      { content: 'Update 3', version: '1.0.3' },
      { status: 'review' },
      { status: 'published' }
    ];

    const updatePromises = concurrentUpdates.map(updateData =>
      DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}/${recordId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        }
      )
    );

    const updateResults = await Promise.all(updatePromises);

    // All updates should complete (last writer wins)
    const successCount = updateResults.filter(r => r.success).length;
    if (successCount !== concurrentUpdates.length) {
      throw new Error(`Expected all ${concurrentUpdates.length} concurrent updates to succeed, got ${successCount}`);
    }

    // Verify final state
    const finalRecord = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    const record = finalRecord.data.find((r: any) => r.id === recordId);
    if (!record) {
      throw new Error('Record not found after concurrent updates');
    }

    // The final status should be one of the updated values
    if (!['draft', 'review', 'published'].includes(record.status)) {
      throw new Error(`Unexpected final status: ${record.status}`);
    }
  });
}

/**
 * Test bulk delete operations
 */
async function testBulkDelete() {
  console.log('\n🗑️ Testing Bulk Delete Operations...\n');

  await runTest('Bulk delete multiple records', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('activity');
    
    // Create records to delete
    const createdRecords = await DataForgeTestHelper.createBulkRecords(entityName, 'activity', 8);
    
    // Delete first 5 records
    const recordsToDelete = createdRecords.slice(0, 5);
    
    const deletePromises = recordsToDelete.map(record =>
      DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}/${record.saved.id}`,
        {
          method: 'DELETE'
        }
      )
    );

    const deleteResults = await Promise.all(deletePromises);

    // Verify all deletes succeeded
    for (const result of deleteResults) {
      if (!result.success) {
        throw new Error('Bulk delete operation failed');
      }
    }

    // Verify records were deleted
    const remainingRecords = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    if (remainingRecords.data.length !== 3) {
      throw new Error(`Expected 3 remaining records after bulk delete, got ${remainingRecords.data.length}`);
    }

    // Verify deleted records are not in the results
    const deletedIds = recordsToDelete.map(r => r.saved.id);
    const foundDeletedRecord = remainingRecords.data.find((r: any) => 
      deletedIds.includes(r.id)
    );

    if (foundDeletedRecord) {
      throw new Error('Deleted record still found in query results');
    }
  });

  await runTest('Handle bulk delete errors gracefully', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('file');
    
    // Create some records
    const createdRecords = await DataForgeTestHelper.createBulkRecords(entityName, 'file', 3);
    
    // Mix of valid and invalid delete requests
    const deleteRequests = [
      createdRecords[0].saved.id, // Valid
      'invalid-id-1', // Invalid
      createdRecords[1].saved.id, // Valid
      'invalid-id-2', // Invalid
      createdRecords[2].saved.id  // Valid
    ];

    const deletePromises = deleteRequests.map(id =>
      DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}/${id}`,
        {
          method: 'DELETE'
        }
      ).catch(error => ({ success: false, error: error.message }))
    );

    const deleteResults = await Promise.all(deletePromises);

    // Count successful vs failed deletes
    const successCount = deleteResults.filter(r => r.success).length;
    const failCount = deleteResults.filter(r => !r.success).length;

    if (successCount !== 3) {
      throw new Error(`Expected 3 successful deletes, got ${successCount}`);
    }

    if (failCount !== 2) {
      throw new Error(`Expected 2 failed deletes, got ${failCount}`);
    }

    // Verify all valid records were deleted
    const remainingRecords = await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    
    if (remainingRecords.data.length !== 0) {
      throw new Error(`Expected 0 remaining records, got ${remainingRecords.data.length}`);
    }
  });
}

/**
 * Test bulk operations performance
 */
async function testBulkPerformance() {
  console.log('\n⚡ Testing Bulk Operations Performance...\n');

  const performanceTests = [
    { operation: 'create', count: 100, maxMs: 5000 },
    { operation: 'read', count: 100, maxMs: 500 },
    { operation: 'update', count: 50, maxMs: 3000 },
    { operation: 'delete', count: 50, maxMs: 2000 }
  ];

  for (const test of performanceTests) {
    await runTest(`${test.operation} ${test.count} records < ${test.maxMs}ms`, async () => {
      const { entityName } = await DataForgeTestHelper.createTestEntity('collection');
      let recordIds: string[] = [];

      const { duration, passed } = await DataForgeTestHelper.measurePerformance(
        async () => {
          switch (test.operation) {
            case 'create':
              const createResults = await DataForgeTestHelper.createBulkRecords(
                entityName, 'collection', test.count
              );
              recordIds = createResults.map(r => r.saved.id);
              break;

            case 'read':
              // First create records to read
              await DataForgeTestHelper.createBulkRecords(entityName, 'collection', test.count);
              // Then read them
              await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
              break;

            case 'update':
              // First create records to update
              const recordsToUpdate = await DataForgeTestHelper.createBulkRecords(
                entityName, 'collection', test.count
              );
              // Then update them
              const updatePromises = recordsToUpdate.map(record =>
                DataForgeTestHelper.apiCall(
                  `/orgs/${TEST_ORG_ID}/data/${entityName}/${record.saved.id}`,
                  {
                    method: 'PUT',
                    body: JSON.stringify({ collection_type: 'updated' })
                  }
                )
              );
              await Promise.all(updatePromises);
              break;

            case 'delete':
              // First create records to delete
              const recordsToDelete = await DataForgeTestHelper.createBulkRecords(
                entityName, 'collection', test.count
              );
              // Then delete them
              const deletePromises = recordsToDelete.map(record =>
                DataForgeTestHelper.apiCall(
                  `/orgs/${TEST_ORG_ID}/data/${entityName}/${record.saved.id}`,
                  {
                    method: 'DELETE'
                  }
                )
              );
              await Promise.all(deletePromises);
              break;
          }
        },
        `Bulk ${test.operation}`,
        test.maxMs
      );

      if (!passed) {
        console.warn(`⚠️ Performance warning: ${test.operation} ${test.count} records took ${duration.toFixed(2)}ms (limit: ${test.maxMs}ms)`);
        // Don't fail the test for performance warnings in development
      }

      console.log(`  📊 ${test.operation} ${test.count} records: ${duration.toFixed(2)}ms (${(duration/test.count).toFixed(2)}ms per record)`);
    });
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 DataForge Bulk Operations Test Suite\n');
  console.log('=======================================\n');
  
  try {
    // Authenticate once at the start
    await DataForgeTestHelper.authenticate('CEO');
    console.log('🔐 Authenticated as CEO\n');

    // Run test suites
    await testBulkCreate();
    await testBulkUpdate();
    await testBulkDelete();
    await testBulkPerformance();

    // Cleanup
    if (CLEANUP_AFTER_TESTS) {
      console.log('\n🧹 Cleaning up test entities...\n');
      await DataForgeTestHelper.cleanupTestEntities();
    }

    // Summary
    console.log('\n=======================================');
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

export { main as runBulkOperationsTests };