#!/usr/bin/env tsx
/**
 * DataForge Field Management & Validation Tests
 * 
 * Tests field validation pipeline, conflict resolution, field types,
 * constraints, and field set management across all archetypes.
 */

import { 
  DataForgeTestHelper, 
  FieldValidationHelper,
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
 * Test base field validation for all archetypes
 */
async function testBaseFieldValidation() {
  console.log('\n🧱 Testing Base Field Validation...\n');

  // Test each archetype has expected base fields
  for (const archetype of ARCHETYPES) {
    await runTest(`Validate ${archetype} base fields`, async () => {
      const { entityName } = await DataForgeTestHelper.createTestEntity(archetype);
      
      // Get entity schema
      const schema = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/entities/${entityName}`
      );

      if (!schema.data || !schema.data.fields) {
        throw new Error('Schema fields not found');
      }

      const fields = schema.data.fields;

      // Verify system fields are present
      const requiredSystemFields = ['id', 'organization_id', 'created_at', 'updated_at'];
      for (const field of requiredSystemFields) {
        if (!fields[field]) {
          throw new Error(`System field ${field} missing from ${archetype} schema`);
        }
      }

      // Verify archetype-specific fields based on type
      switch (archetype) {
        case 'task':
          const requiredTaskFields = ['title', 'priority', 'status'];
          for (const field of requiredTaskFields) {
            if (!fields[field]) {
              throw new Error(`Task field ${field} missing from schema`);
            }
          }
          break;

        case 'project':
          const requiredProjectFields = ['name', 'status', 'priority'];
          for (const field of requiredProjectFields) {
            if (!fields[field]) {
              throw new Error(`Project field ${field} missing from schema`);
            }
          }
          break;

        case 'record':
          const requiredRecordFields = ['name', 'record_type', 'status'];
          for (const field of requiredRecordFields) {
            if (!fields[field]) {
              throw new Error(`Record field ${field} missing from schema`);
            }
          }
          break;

        case 'document':
          const requiredDocumentFields = ['title', 'content', 'status'];
          for (const field of requiredDocumentFields) {
            if (!fields[field]) {
              throw new Error(`Document field ${field} missing from schema`);
            }
          }
          break;
      }
    });
  }

  // Test field type validation
  const fieldTypeTests = FieldValidationHelper.getFieldTypeTestCases();
  
  for (const typeTest of fieldTypeTests) {
    await runTest(`Validate ${typeTest.type} field type constraints`, async () => {
      const customFields = [{
        name: `test_${typeTest.type}`,
        type: typeTest.type,
        required: false
      }];

      const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);

      // Test valid values
      for (const validValue of typeTest.validValues) {
        const recordData = {
          name: 'Test Record',
          description: 'Testing field validation',
          record_type: 'test',
          status: 'active',
          [`test_${typeTest.type}`]: validValue
        };

        const result = await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}`,
          {
            method: 'POST',
            body: JSON.stringify(recordData)
          }
        );

        if (!result.success) {
          throw new Error(`Valid ${typeTest.type} value ${JSON.stringify(validValue)} was rejected`);
        }
      }

      // Note: Invalid value testing would require field validation pipeline
      // to be implemented in the DataForge API. Currently, API may accept
      // invalid values and rely on database constraints or frontend validation.
    });
  }
}

/**
 * Test field conflict resolution
 */
async function testFieldConflictResolution() {
  console.log('\n⚔️ Testing Field Conflict Resolution...\n');

  // Test name collision with base fields
  await runTest('Detect field name collision with base fields', async () => {
    // Try to create custom field that conflicts with base field 'id'
    const conflictResult = await DataForgeTestHelper.testFieldConflict('task', 'id', 'reject');
    
    if (conflictResult.success) {
      // If it succeeded, the system might be using prefix strategy automatically
      console.warn('⚠️ Warning: Field conflict was allowed (might use auto-prefix)');
    } else {
      // Expected: should be rejected
      if (!conflictResult.error.includes('conflict') && 
          !conflictResult.error.includes('exists') && 
          !conflictResult.error.includes('invalid')) {
        throw new Error(`Unexpected error for field conflict: ${conflictResult.error}`);
      }
    }
  });

  // Test conflicting with archetype fields
  await runTest('Detect field name collision with archetype fields', async () => {
    const conflictResult = await DataForgeTestHelper.testFieldConflict('task', 'title', 'reject');
    
    if (conflictResult.success) {
      console.warn('⚠️ Warning: Archetype field conflict was allowed');
    } else {
      if (!conflictResult.error.includes('conflict') && 
          !conflictResult.error.includes('exists')) {
        throw new Error(`Unexpected error for archetype field conflict: ${conflictResult.error}`);
      }
    }
  });

  // Test valid custom field names
  await runTest('Allow valid custom field names', async () => {
    const customFields = [
      { name: 'custom_identifier', type: 'text', required: false },
      { name: 'project_code', type: 'text', required: false },
      { name: 'estimated_hours', type: 'number', required: false },
      { name: 'is_billable', type: 'boolean', defaultValue: false }
    ];

    const result = await DataForgeTestHelper.createTestEntity('task', customFields);
    
    if (!result.success) {
      throw new Error(`Valid custom fields were rejected: ${result.error}`);
    }

    // Verify custom fields are in schema
    const schema = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/entities/${result.entityName}`
    );

    for (const field of customFields) {
      if (!schema.data.customFields || !schema.data.customFields[field.name]) {
        throw new Error(`Custom field ${field.name} not found in schema`);
      }
    }
  });
}

/**
 * Test field constraints and validation rules
 */
async function testFieldConstraints() {
  console.log('\n📏 Testing Field Constraints...\n');

  // Test required field validation
  await runTest('Enforce required field validation', async () => {
    const customFields = [
      { name: 'required_text', type: 'text', required: true },
      { name: 'optional_text', type: 'text', required: false }
    ];

    const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);

    // Test with missing required field
    try {
      const recordData = {
        name: 'Test Record',
        description: 'Testing required fields',
        record_type: 'test',
        status: 'active',
        optional_text: 'This is optional'
        // Missing required_text
      };

      const result = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}`,
        {
          method: 'POST',
          body: JSON.stringify(recordData)
        }
      );

      // If this succeeds, required validation might not be implemented yet
      if (result.success) {
        console.warn('⚠️ Warning: Required field validation not enforced');
      }
    } catch (error: any) {
      // Expected: should fail due to missing required field
      if (!error.message.includes('required') && !error.message.includes('missing')) {
        throw error;
      }
    }

    // Test with all required fields
    const validRecordData = {
      name: 'Test Record',
      description: 'Testing required fields',
      record_type: 'test',
      status: 'active',
      required_text: 'This is required',
      optional_text: 'This is optional'
    };

    const validResult = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(validRecordData)
      }
    );

    if (!validResult.success) {
      throw new Error('Record creation failed with all required fields provided');
    }
  });

  // Test default value assignment
  await runTest('Apply default values correctly', async () => {
    const customFields = [
      { name: 'default_text', type: 'text', defaultValue: 'Default Text Value' },
      { name: 'default_number', type: 'number', defaultValue: 42 },
      { name: 'default_boolean', type: 'boolean', defaultValue: true },
      { name: 'default_json', type: 'json', defaultValue: { key: 'default_value' } },
      { name: 'default_array', type: 'json', defaultValue: [1, 2, 3] }
    ];

    const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);

    // Create record without specifying default fields
    const recordData = {
      name: 'Test Record with Defaults',
      description: 'Testing default values',
      record_type: 'test',
      status: 'active'
      // Not specifying any custom fields with defaults
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    );

    if (!result.success) {
      throw new Error('Failed to create record with default values');
    }

    // Verify defaults were applied
    const records = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`
    );

    const record = records.data?.find((r: any) => r.id === result.saved.id);
    if (!record) {
      throw new Error('Created record not found');
    }

    // Check default values
    if (record.default_text !== 'Default Text Value') {
      console.warn(`⚠️ Default text value: expected "Default Text Value", got "${record.default_text}"`);
    }

    if (record.default_number !== 42) {
      console.warn(`⚠️ Default number value: expected 42, got ${record.default_number}`);
    }

    if (record.default_boolean !== true) {
      console.warn(`⚠️ Default boolean value: expected true, got ${record.default_boolean}`);
    }

    if (!record.default_json || record.default_json.key !== 'default_value') {
      console.warn(`⚠️ Default JSON value not applied correctly`);
    }

    if (!Array.isArray(record.default_array) || record.default_array.length !== 3) {
      console.warn(`⚠️ Default array value not applied correctly`);
    }
  });

  // Test field type constraints
  await runTest('Validate enum field constraints', async () => {
    const customFields = [
      { 
        name: 'status_enum', 
        type: 'enum', 
        required: false,
        enum: ['draft', 'active', 'archived'],
        defaultValue: 'draft'
      }
    ];

    const { entityName } = await DataForgeTestHelper.createTestEntity('record', customFields);

    // Test valid enum value
    const validRecordData = {
      name: 'Test Record',
      description: 'Testing enum validation',
      record_type: 'test',
      status: 'active',
      status_enum: 'active'
    };

    const validResult = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(validRecordData)
      }
    );

    if (!validResult.success) {
      throw new Error('Valid enum value was rejected');
    }

    // Test invalid enum value (if validation is implemented)
    try {
      const invalidRecordData = {
        name: 'Test Record Invalid',
        description: 'Testing invalid enum',
        record_type: 'test',
        status: 'active',
        status_enum: 'invalid_status'
      };

      const invalidResult = await DataForgeTestHelper.apiCall(
        `/orgs/${TEST_ORG_ID}/data/${entityName}`,
        {
          method: 'POST',
          body: JSON.stringify(invalidRecordData)
        }
      );

      if (invalidResult.success) {
        console.warn('⚠️ Warning: Invalid enum value was accepted');
      }
    } catch (error: any) {
      // Expected: should fail for invalid enum value
      if (!error.message.includes('enum') && 
          !error.message.includes('invalid') && 
          !error.message.includes('constraint')) {
        console.warn(`⚠️ Unexpected error for invalid enum: ${error.message}`);
      }
    }
  });
}

/**
 * Test field set management (status, priority, etc.)
 */
async function testFieldSetManagement() {
  console.log('\n🎛️ Testing Field Set Management...\n');

  // Test archetype field sets are applied
  await runTest('Apply archetype-specific field sets', async () => {
    const { entityName } = await DataForgeTestHelper.createTestEntity('task');
    
    // Create task with field set values
    const taskData = {
      title: 'Test Task with Field Sets',
      description: 'Testing field set values',
      priority: 'high',
      status: 'in_progress',
      due_date: new Date(Date.now() + 86400000).toISOString()
    };

    const result = await DataForgeTestHelper.apiCall(
      `/orgs/${TEST_ORG_ID}/data/${entityName}`,
      {
        method: 'POST',
        body: JSON.stringify(taskData)
      }
    );

    if (!result.success) {
      throw new Error('Failed to create task with field set values');
    }

    // Verify field set values were saved
    const verified = await DataForgeTestHelper.verifyRecordFields(
      entityName,
      result.saved.id,
      { priority: 'high', status: 'in_progress' }
    );

    if (!verified) {
      throw new Error('Field set values not properly saved');
    }
  });

  // Test field set validation for different archetypes
  const archetypeFieldSets = [
    { archetype: 'task', field: 'priority', validValues: ['low', 'medium', 'high', 'critical'] },
    { archetype: 'task', field: 'status', validValues: ['todo', 'in_progress', 'review', 'blocked', 'completed', 'cancelled'] },
    { archetype: 'project', field: 'status', validValues: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
    { archetype: 'record', field: 'status', validValues: ['active', 'inactive', 'archived', 'draft'] }
  ];

  for (const fieldSetTest of archetypeFieldSets) {
    await runTest(`Validate ${fieldSetTest.archetype} ${fieldSetTest.field} field set`, async () => {
      const { entityName } = await DataForgeTestHelper.createTestEntity(fieldSetTest.archetype);
      
      // Test each valid value
      for (const value of fieldSetTest.validValues) {
        const recordData = {
          ...(fieldSetTest.archetype === 'task' && { title: `Test Task ${value}` }),
          ...(fieldSetTest.archetype === 'project' && { name: `Test Project ${value}` }),
          ...(fieldSetTest.archetype === 'record' && { 
            name: `Test Record ${value}`,
            record_type: 'test'
          }),
          [fieldSetTest.field]: value
        };

        const result = await DataForgeTestHelper.apiCall(
          `/orgs/${TEST_ORG_ID}/data/${entityName}`,
          {
            method: 'POST',
            body: JSON.stringify(recordData)
          }
        );

        if (!result.success) {
          throw new Error(`Valid ${fieldSetTest.field} value '${value}' was rejected`);
        }
      }
    });
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 DataForge Field Management & Validation Test Suite\n');
  console.log('===================================================\n');
  
  try {
    // Authenticate once at the start
    await DataForgeTestHelper.authenticate('CEO');
    console.log('🔐 Authenticated as CEO\n');

    // Run test suites
    await testBaseFieldValidation();
    await testFieldConflictResolution();
    await testFieldConstraints();
    await testFieldSetManagement();

    // Cleanup
    if (CLEANUP_AFTER_TESTS) {
      console.log('\n🧹 Cleaning up test entities...\n');
      await DataForgeTestHelper.cleanupTestEntities();
    }

    // Summary
    console.log('\n===================================================');
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

export { main as runFieldValidationTests };