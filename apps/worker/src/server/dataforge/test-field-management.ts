/**
 * Test script for new field management system
 */

import { fieldManager } from './services/FieldManager';
import { fieldValidationPipeline } from './validation/FieldValidationPipeline';
import { ArchetypeRegistry } from './ArchetypeRegistry';

async function testFieldManagement() {
  console.log('🧪 Testing DataForge Field Management System\n');
  
  // Test 1: Validate custom fields
  console.log('Test 1: Custom Field Validation');
  const customFields = [
    { name: 'company_size', type: 'integer', required: false, min: 1, max: 100000 },
    { name: 'industry', type: 'text', required: true, maxLength: 100 },
    { name: 'founded_date', type: 'date', required: false },
    { name: 'is_public', type: 'boolean', defaultValue: false },
    { name: 'title', type: 'text', required: true } // This will conflict with task archetype
  ];
  
  const validation = await fieldManager.validateCustomFields(customFields, 'task');
  console.log('Validation result:', {
    success: validation.success,
    errors: validation.errors,
    warnings: validation.warnings,
    processedFields: validation.processedFields?.size
  });
  console.log('');
  
  // Test 2: Field merging with conflict resolution
  console.log('Test 2: Field Merging with Conflict Resolution');
  const mergedFields = await fieldManager.mergeFieldDefinitions(
    'task',
    customFields,
    {
      conflictStrategy: 'prefix',
      customFieldPrefix: 'custom',
      validateTypes: true,
      preserveArchetypeDefaults: true
    }
  );
  
  console.log('Merge result:', {
    totalFields: mergedFields.metadata.totalFields,
    baseFields: mergedFields.metadata.baseFieldCount,
    customFields: mergedFields.metadata.customFieldCount,
    hasConflicts: mergedFields.metadata.hasConflicts,
    conflicts: mergedFields.conflicts.map(c => ({
      field: c.fieldName,
      type: c.type
    }))
  });
  console.log('');
  
  // Test 3: Default value resolution
  console.log('Test 3: Default Value Resolution');
  const dataWithDefaults = await fieldManager.applyFieldDefaults(
    { 
      title: 'Test Task',
      industry: 'Technology'
    },
    'task',
    mergedFields.customFields
  );
  
  console.log('Data with defaults:', dataWithDefaults);
  console.log('');
  
  // Test 4: Field validation pipeline
  console.log('Test 4: Field Validation Pipeline');
  const testData = {
    title: 'Implement new feature',
    description: 'Add user authentication',
    priority: 'high',
    status: 'in_progress',
    due_date: '2024-12-31',
    estimated_hours: 8,
    industry: 'Software',
    company_size: 50,
    is_public: true
  };
  
  const pipelineResult = await fieldValidationPipeline.validate({
    data: testData,
    fields: mergedFields.allFields,
    archetype: 'task',
    organizationId: '01920000-1000-7000-8000-000000000001'
  });
  
  console.log('Pipeline validation:', {
    valid: pipelineResult.valid,
    errors: pipelineResult.errors.length,
    warnings: pipelineResult.warnings?.length || 0,
    hasTransformedData: !!pipelineResult.transformedData
  });
  
  if (pipelineResult.errors.length > 0) {
    console.log('Errors:', pipelineResult.errors.slice(0, 3));
  }
  console.log('');
  
  // Test 5: Extract custom field data
  console.log('Test 5: Custom Field Data Extraction');
  const { baseData, customData } = fieldManager.extractCustomFieldData(
    testData,
    mergedFields.customFields
  );
  
  console.log('Base data keys:', Object.keys(baseData));
  console.log('Custom data:', customData);
  console.log('');
  
  // Test 6: Archetype field retrieval
  console.log('Test 6: Archetype Field Retrieval');
  const taskFields = await fieldManager.getArchetypeFields('task');
  console.log('Task archetype has', taskFields.size, 'base fields');
  console.log('Required fields:', Array.from(taskFields.values())
    .filter(f => f.required)
    .map(f => f.name)
  );
  
  console.log('\n✅ Field Management System Tests Complete');
}

// Run tests
testFieldManagement().catch(console.error);

export { testFieldManagement };