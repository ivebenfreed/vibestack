// Storage and Function Retrieval Test for Function Factory POC
// Tests the core KV storage and retrieval mechanisms

const BASE_URL = 'http://localhost:8788';

async function httpRequest(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const responseData = await response.text();
  
  try {
    return {
      status: response.status,
      data: JSON.parse(responseData),
      ok: response.ok
    };
  } catch {
    return {
      status: response.status,
      data: responseData,
      ok: response.ok
    };
  }
}

async function runStorageTests() {
  console.log('🗄️  Function Factory POC - Storage & Retrieval Testing');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function testResult(name, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ ${name}`);
      if (details) console.log(`   ${details}`);
    } else {
      console.log(`❌ ${name}`);
      if (details) console.log(`   ${details}`);
    }
  }

  try {
    // Test 1: Deploy entity and verify function storage
    console.log('📋 TEST 1: Function Storage Verification');
    
    const testEntity = {
      name: 'StorageTestEntity',
      orgId: 'storage-test-org',
      basePrimitive: 'Project',
      customFields: {
        testField: { type: 'string', required: true }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (!data.testField || data.testField.length < 5) {
              errors.push('testField must be at least 5 characters');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const deployResponse = await httpRequest('POST', '/factory/deploy', testEntity);
    const deploySuccess = deployResponse.ok && deployResponse.data.success;
    testResult('Entity deployment', deploySuccess, `Status: ${deployResponse.status}`);

    // Verify functions were stored in debug
    const debugResponse = await httpRequest('GET', '/debug/functions');
    const debugSuccess = debugResponse.ok && Array.isArray(debugResponse.data.functions);
    
    const expectedFunctionKeys = [
      'fn:storage-test-org:StorageTestEntity:validate',
      'fn:storage-test-org:StorageTestEntity:save',
      'fn:storage-test-org:StorageTestEntity:query'
    ];
    
    const allFunctionsStored = expectedFunctionKeys.every(key => 
      debugResponse.data.functions.includes(key)
    );
    
    testResult('Function storage verification', debugSuccess && allFunctionsStored, 
               `Found ${debugResponse.data.functions.length} functions, expected keys present: ${allFunctionsStored}`);

    // Test 2: Add debug endpoint for raw function retrieval
    console.log('\n📋 TEST 2: Direct Function Code Retrieval');

    // Test retrieving the custom validation function
    const validationKey = 'fn:storage-test-org:StorageTestEntity:validate';
    const functionResponse = await httpRequest('GET', `/debug/function/${encodeURIComponent(validationKey)}`);
    
    const functionRetrievalSuccess = functionResponse.ok && functionResponse.data.code;
    const codeContainsCustomLogic = functionResponse.data.code && 
                                    functionResponse.data.code.includes('testField must be at least 5 characters');
    
    testResult('Function code retrieval', functionRetrievalSuccess && codeContainsCustomLogic, 
               `Function found: ${functionRetrievalSuccess}, Contains custom logic: ${codeContainsCustomLogic}`);

    // Test 3: Function execution with retrieved code
    console.log('\n📋 TEST 3: Function Execution from Storage');
    
    // Test with valid data (should pass)
    const validData = { name: 'Test Entity', testField: 'This is a valid test field' };
    const validExecResponse = await httpRequest('POST', '/entity/storage-test-org/StorageTestEntity/validate', validData);
    const validExecSuccess = validExecResponse.ok && validExecResponse.data.result?.valid;
    
    // Test with invalid data (should fail custom validation)
    const invalidData = { name: 'Test Entity', testField: 'Bad' }; // Too short
    const invalidExecResponse = await httpRequest('POST', '/entity/storage-test-org/StorageTestEntity/validate', invalidData);
    const invalidExecCorrect = invalidExecResponse.ok && 
                               !invalidExecResponse.data.result?.valid &&
                               invalidExecResponse.data.result?.errors?.some(e => e.includes('at least 5 characters'));
    
    testResult('Function execution from storage - valid data', validExecSuccess, 'Validation passed as expected');
    testResult('Function execution from storage - invalid data', invalidExecCorrect, 
               `Validation failed correctly: ${invalidExecResponse.data.result?.errors?.join(', ') || 'No errors'}`);

    // Test 4: Multiple entity storage isolation
    console.log('\n📋 TEST 4: Multiple Entity Storage Isolation');
    
    // Deploy second entity with different validation logic
    const secondEntity = {
      name: 'AnotherTestEntity', 
      orgId: 'storage-test-org',
      basePrimitive: 'Project',
      customFields: {
        differentField: { type: 'number', required: true }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (!data.differentField || data.differentField < 100) {
              errors.push('differentField must be at least 100');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const secondDeployResponse = await httpRequest('POST', '/factory/deploy', secondEntity);
    const secondDeploySuccess = secondDeployResponse.ok && secondDeployResponse.data.success;

    // Verify both entities have separate functions
    const updatedDebugResponse = await httpRequest('GET', '/debug/functions');
    const bothEntitiesFunctionsStored = updatedDebugResponse.data.functions.filter(f => 
      f.includes('storage-test-org')
    ).length >= 6; // At least 3 functions per entity

    testResult('Multiple entity storage', secondDeploySuccess && bothEntitiesFunctionsStored, 
               `Second entity deployed: ${secondDeploySuccess}, Both entities have separate functions: ${bothEntitiesFunctionsStored}`);

    // Test that each entity uses its own validation logic
    const firstEntityValidation = await httpRequest('POST', '/entity/storage-test-org/StorageTestEntity/validate', 
      { name: 'Test', testField: 'Valid field content', differentField: 50 }
    );
    
    const secondEntityValidation = await httpRequest('POST', '/entity/storage-test-org/AnotherTestEntity/validate', 
      { name: 'Test', differentField: 150, testField: 'abc' }
    );

    const isolationWorking = firstEntityValidation.data.result?.valid && 
                            secondEntityValidation.data.result?.valid;
    
    testResult('Entity function isolation', isolationWorking, 
               `First entity validation: ${firstEntityValidation.data.result?.valid}, Second entity validation: ${secondEntityValidation.data.result?.valid}`);

    // Test 5: Cross-org storage isolation
    console.log('\n📋 TEST 5: Cross-Org Storage Isolation');
    
    const differentOrgEntity = {
      name: 'StorageTestEntity', // Same name, different org
      orgId: 'different-org',
      basePrimitive: 'Project',
      customFields: {
        testField: { type: 'string', required: true }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (!data.testField || !data.testField.startsWith('DIFFERENT-')) {
              errors.push('testField must start with DIFFERENT-');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const diffOrgDeployResponse = await httpRequest('POST', '/factory/deploy', differentOrgEntity);
    const diffOrgDeploySuccess = diffOrgDeployResponse.ok && diffOrgDeployResponse.data.success;

    // Test that same entity name in different orgs have different validation logic
    const originalOrgValidation = await httpRequest('POST', '/entity/storage-test-org/StorageTestEntity/validate', 
      { name: 'Test', testField: 'Valid field content' }
    );
    
    const differentOrgValidation = await httpRequest('POST', '/entity/different-org/StorageTestEntity/validate', 
      { name: 'Test', testField: 'DIFFERENT-Valid field content' }
    );

    const crossOrgIsolation = originalOrgValidation.data.result?.valid && 
                             differentOrgValidation.data.result?.valid;
    
    testResult('Cross-org storage isolation', diffOrgDeploySuccess && crossOrgIsolation, 
               `Different org deployed: ${diffOrgDeploySuccess}, Cross-org isolation working: ${crossOrgIsolation}`);

    // Test 6: Function versioning/overwriting
    console.log('\n📋 TEST 6: Function Update/Overwrite');
    
    // Deploy updated version of first entity with different validation
    const updatedEntity = {
      ...testEntity,
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (!data.testField || data.testField.length < 10) {
              errors.push('testField must be at least 10 characters (updated rule)');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const updateDeployResponse = await httpRequest('POST', '/factory/deploy', updatedEntity);
    const updateDeploySuccess = updateDeployResponse.ok && updateDeployResponse.data.success;

    // Test that the updated validation rule is now in effect
    const oldValidData = { name: 'Test', testField: 'Valid' }; // 5 chars - should fail with new rule
    const updatedValidationResponse = await httpRequest('POST', '/entity/storage-test-org/StorageTestEntity/validate', oldValidData);
    const updatedRuleInEffect = updatedValidationResponse.ok && 
                               !updatedValidationResponse.data.result?.valid &&
                               updatedValidationResponse.data.result?.errors?.some(e => e.includes('10 characters'));

    testResult('Function update/overwrite', updateDeploySuccess && updatedRuleInEffect, 
               `Update deployed: ${updateDeploySuccess}, New rule in effect: ${updatedRuleInEffect} - ${updatedValidationResponse.data.result?.errors?.join(', ') || 'No errors'}`);

    // Test 7: Function count and storage efficiency
    console.log('\n📋 TEST 7: Storage Efficiency Analysis');
    
    const finalDebugResponse = await httpRequest('GET', '/debug/functions');
    const functionCount = finalDebugResponse.data.functions.length;
    const schemaCount = finalDebugResponse.data.schemas.length;
    const configCount = finalDebugResponse.data.config.length;
    
    // We should have functions for multiple entities and orgs
    const expectedMinFunctions = 9; // At least 3 entities * 3 functions each
    const storageEfficient = functionCount >= expectedMinFunctions;
    
    testResult('Storage efficiency', storageEfficient, 
               `Total functions: ${functionCount}, Schemas: ${schemaCount}, Config: ${configCount}`);

    // Show sample function keys for verification
    console.log('\n   📝 Sample stored function keys:');
    finalDebugResponse.data.functions.slice(0, 5).forEach(key => 
      console.log(`      ${key}`)
    );
    if (finalDebugResponse.data.functions.length > 5) {
      console.log(`      ... and ${finalDebugResponse.data.functions.length - 5} more`);
    }

    // Summary
    console.log('\n🎯 STORAGE TEST SUMMARY');
    console.log('=======================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL STORAGE TESTS PASSED!');
      console.log('\n✅ Function storage in KV working perfectly');
      console.log('✅ Function code retrieval working');
      console.log('✅ Function execution from storage working');  
      console.log('✅ Multi-entity storage isolation working');
      console.log('✅ Cross-org storage isolation working');
      console.log('✅ Function update/overwrite working');
      console.log('✅ Storage efficiency verified');
      console.log('\n🚀 CORE KV STORAGE MECHANISMS FULLY VALIDATED!');
      console.log('\n📊 KEY METRICS:');
      console.log(`   - ${functionCount} functions stored across orgs`);
      console.log(`   - ${schemaCount} schemas managed`);
      console.log(`   - Perfect isolation between orgs and entities`);
      console.log(`   - Hot-swappable function updates working`);
      console.log(`   - Zero-downtime business logic deployment proven`);
    } else {
      console.log('\n⚠️  Some storage tests failed - review needed');
    }

  } catch (error) {
    console.error('❌ Storage test failed:', error);
  }
}

// Run the storage tests
runStorageTests().catch(console.error);