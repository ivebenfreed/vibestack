// Rules-Based Engine Test - Testing the alternative approach
// Tests secure declarative validation without dynamic code execution

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

async function runRulesEngineTests() {
  console.log('🛡️  Rules-Based Engine Testing - Secure Alternative Approach');
  console.log('=========================================================\\n');

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
    // Test 1: Health Check and Sample Configurations
    console.log('📋 TEST 1: Basic Setup and Samples');
    
    const healthResponse = await httpRequest('GET', '/health');
    const healthWorking = healthResponse.ok && healthResponse.data === 'Function Factory POC OK';
    testResult('Health check', healthWorking, `Status: ${healthResponse.status}`);
    
    const samplesResponse = await httpRequest('GET', '/samples');
    const samplesWorking = samplesResponse.ok && samplesResponse.data.samples;
    const hasSampleConfigs = samplesResponse.data.samples.SoftwareProject && samplesResponse.data.samples.MarketingCampaign;
    testResult('Sample configurations available', samplesWorking && hasSampleConfigs, 
               `Approach: ${samplesResponse.data.approach}, Samples: ${Object.keys(samplesResponse.data.samples || {}).length}`);

    // Test 2: Deploy Rules-Based Entity Configuration
    console.log('\\n📋 TEST 2: Rules-Based Entity Deployment');
    
    const rulesEntityConfig = {
      name: 'SoftwareProject',
      orgId: 'rules-test-org',
      basePrimitive: 'Project',
      customFields: {
        budget: { type: 'number', required: true, min: 1000 },
        technology: { type: 'enum', required: true, enum: ['React', 'Vue', 'Angular'] },
        repository_url: { type: 'url', required: false },
        team_lead_email: { type: 'email', required: true }
      },
      validationRules: {
        rules: [
          { field: 'budget', operator: 'greater_than_equal', value: 5000, message: 'Budget must be at least $5,000' },
          { field: 'name', operator: 'min_length', value: 5, message: 'Project name must be at least 5 characters' },
          { field: 'repository_url', operator: 'starts_with', value: 'https://github.com/', message: 'Repository must be a GitHub URL' }
        ],
        operator: 'and'
      },
      workflows: {
        draft: ['active', 'cancelled'],
        active: ['on_hold', 'completed'],
        on_hold: ['active', 'cancelled']
      },
      defaultValues: {
        status: 'draft',
        technology: 'React'
      }
    };

    const deployResponse = await httpRequest('POST', '/rules/deploy', rulesEntityConfig);
    const deploySuccess = deployResponse.ok && deployResponse.data.success;
    const isRulesBased = deployResponse.data.approach === 'rules-based';
    testResult('Rules-based entity deployment', deploySuccess && isRulesBased, 
               `Status: ${deployResponse.status}, Approach: ${deployResponse.data.approach}`);

    // Test 3: Rules-Based Validation - Valid Data
    console.log('\\n📋 TEST 3: Rules-Based Validation - Valid Data');
    
    const validProjectData = {
      name: 'Advanced Web Platform',
      description: 'A cutting-edge web platform',
      budget: 10000,
      technology: 'React',
      repository_url: 'https://github.com/company/web-platform',
      team_lead_email: 'lead@company.com'
    };

    const validValidationResponse = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/validate', validProjectData);
    const validationPassed = validValidationResponse.ok && validValidationResponse.data.success;
    const hasRuleBasedResult = validValidationResponse.data.approach === 'rules-based';
    testResult('Valid data validation', validationPassed && hasRuleBasedResult, 
               `Validation passed: ${validationPassed}, Approach: ${validValidationResponse.data.approach}`);

    // Test 4: Rules-Based Validation - Invalid Data (Multiple Rule Failures)
    console.log('\\n📋 TEST 4: Rules-Based Validation - Invalid Data');
    
    const invalidProjectData = {
      name: 'Bad', // Too short
      budget: 2000, // Below minimum rule
      technology: 'React',
      repository_url: 'https://gitlab.com/bad-url', // Wrong URL pattern
      team_lead_email: 'not-an-email' // Invalid email
    };

    const invalidValidationResponse = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/validate', invalidProjectData);
    const validationCorrectlyFailed = !invalidValidationResponse.ok && !invalidValidationResponse.data.success;
    const hasExpectedErrors = invalidValidationResponse.data.errors && invalidValidationResponse.data.errors.length > 0;
    const errorMessages = invalidValidationResponse.data.errors || [];
    
    testResult('Invalid data validation (correctly fails)', validationCorrectlyFailed && hasExpectedErrors, 
               `Errors found: ${errorMessages.length} - ${errorMessages.slice(0, 2).join(', ')}`);

    // Test 5: Save Operation with Defaults and Timestamps
    console.log('\\n📋 TEST 5: Save Operation with Defaults and Timestamps');
    
    const saveData = {
      name: 'Complete Project',
      description: 'A well-configured project',
      budget: 15000,
      team_lead_email: 'lead@example.com'
      // Note: technology and status should get defaults
    };

    const saveResponse = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/save', saveData);
    const saveSuccess = saveResponse.ok && saveResponse.data.success;
    const savedData = saveResponse.data.result;
    const hasId = savedData && savedData.id;
    const hasTimestamps = savedData && savedData.created_at && savedData.updated_at;
    const hasDefaults = savedData && savedData.status === 'draft' && savedData.technology === 'React';
    
    testResult('Save operation with defaults', saveSuccess && hasId && hasTimestamps && hasDefaults, 
               `ID: ${hasId ? '✅' : '❌'}, Timestamps: ${hasTimestamps ? '✅' : '❌'}, Defaults: ${hasDefaults ? '✅' : '❌'}`);

    // Test 6: Query Configuration Generation
    console.log('\\n📋 TEST 6: Query Configuration Generation');
    
    const queryFilters = { status: 'active', technology: 'React' };
    const queryResponse = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/query', queryFilters);
    const querySuccess = queryResponse.ok && queryResponse.data.success;
    const queryConfig = queryResponse.data.result;
    const hasTableName = queryConfig && queryConfig.table === 'rules-test-org_softwareprojects';
    const hasFilters = queryConfig && queryConfig.filters;
    const hasAllowedFilters = queryConfig && Array.isArray(queryConfig.allowedFilters);
    
    testResult('Query configuration generation', querySuccess && hasTableName && hasFilters && hasAllowedFilters, 
               `Table: ${hasTableName ? '✅' : '❌'}, Filters: ${hasFilters ? '✅' : '❌'}, Allowed fields: ${queryConfig?.allowedFilters?.length || 0}`);

    // Test 7: Multi-Organization Isolation
    console.log('\\n📋 TEST 7: Multi-Organization Isolation');
    
    const otherOrgConfig = {
      ...rulesEntityConfig,
      orgId: 'other-rules-org',
      validationRules: {
        rules: [
          { field: 'budget', operator: 'greater_than', value: 20000, message: 'Other org requires $20K+ budget' }
        ]
      }
    };

    const otherOrgDeployResponse = await httpRequest('POST', '/rules/deploy', otherOrgConfig);
    const otherOrgDeploySuccess = otherOrgDeployResponse.ok && otherOrgDeployResponse.data.success;

    // Test that each org has different validation rules
    const firstOrgTest = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/validate', { ...validProjectData, budget: 10000 });
    const secondOrgTest = await httpRequest('POST', '/entity/other-rules-org/SoftwareProject/validate', { ...validProjectData, budget: 10000 });
    
    const firstOrgPasses = firstOrgTest.ok && firstOrgTest.data.success; // Should pass (>= 5000)
    const secondOrgFails = !secondOrgTest.ok && !secondOrgTest.data.success; // Should fail (< 20000)
    
    testResult('Multi-org rule isolation', otherOrgDeploySuccess && firstOrgPasses && secondOrgFails, 
               `Other org deployed: ${otherOrgDeploySuccess}, First org passes: ${firstOrgPasses}, Second org fails: ${secondOrgFails}`);

    // Test 8: Configuration Update/Overwrite
    console.log('\\n📋 TEST 8: Configuration Update/Overwrite');
    
    const updatedConfig = {
      ...rulesEntityConfig,
      validationRules: {
        rules: [
          { field: 'budget', operator: 'greater_than_equal', value: 25000, message: 'Updated: Budget must be at least $25,000' }
        ]
      }
    };

    const updateResponse = await httpRequest('POST', '/rules/deploy', updatedConfig);
    const updateSuccess = updateResponse.ok && updateResponse.data.success;

    // Test that updated rules are in effect
    const oldValidData = { ...validProjectData, budget: 10000 }; // Should now fail with updated rule
    const updatedRuleTest = await httpRequest('POST', '/entity/rules-test-org/SoftwareProject/validate', oldValidData);
    const updatedRuleInEffect = !updatedRuleTest.ok && updatedRuleTest.data.errors?.some(e => e.includes('25,000'));

    testResult('Configuration update/overwrite', updateSuccess && updatedRuleInEffect, 
               `Update deployed: ${updateSuccess}, New rule in effect: ${updatedRuleInEffect}`);

    // Test 9: Debug and Monitoring
    console.log('\\n📋 TEST 9: Debug and Monitoring');
    
    const debugResponse = await httpRequest('GET', '/debug/configurations');
    const debugWorking = debugResponse.ok && debugResponse.data.approach === 'rules-based';
    const hasConfigurations = debugResponse.data.configurations && debugResponse.data.configurations.length > 0;
    const hasSchemas = debugResponse.data.schemas && debugResponse.data.schemas.length > 0;
    
    testResult('Debug configurations endpoint', debugWorking && hasConfigurations && hasSchemas, 
               `Configurations: ${debugResponse.data.configurations?.length}, Schemas: ${debugResponse.data.schemas?.length}`);

    // Test 10: Legacy Compatibility
    console.log('\\n📋 TEST 10: Legacy Compatibility');
    
    const legacyResponse = await httpRequest('GET', '/debug/functions');
    const legacyWorking = legacyResponse.ok && legacyResponse.data.approach === 'rules-based';
    const noFunctions = Array.isArray(legacyResponse.data.functions) && legacyResponse.data.functions.length === 0;
    const hasNote = legacyResponse.data.note && legacyResponse.data.note.includes('rule-based');
    
    testResult('Legacy endpoint compatibility', legacyWorking && noFunctions && hasNote, 
               `Functions: ${legacyResponse.data.functions?.length || 0}, Note provided: ${hasNote}`);

    // Summary
    console.log('\\n🎯 RULES-BASED ENGINE TEST SUMMARY');
    console.log('===================================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\\n🎉 ALL RULES-BASED TESTS PASSED!');
      console.log('\\n✅ Secure declarative validation working perfectly');
      console.log('✅ Multi-org isolation maintained');
      console.log('✅ Configuration-driven entity customization working');  
      console.log('✅ Hot-swappable rule updates working');
      console.log('✅ Workflow and default value handling working');
      console.log('✅ Legacy compatibility maintained');
      console.log('\\n🚀 RULES-BASED ALTERNATIVE FULLY VALIDATED!');
      console.log('\\n📊 KEY BENEFITS:');
      console.log('   - 🛡️  Security: No dynamic code execution');
      console.log('   - 🔧 Flexibility: Rich rule-based validation');
      console.log('   - 🏢 Multi-tenant: Perfect org isolation');
      console.log('   - ⚡ Performance: Fast declarative evaluation');
      console.log('   - 🔄 Maintainable: JSON-based configuration');
      console.log('   - 📋 Auditable: All rules are transparent');
    } else {
      console.log('\\n⚠️  Some rules-based tests failed - review needed');
    }

  } catch (error) {
    console.error('❌ Rules engine test failed:', error);
  }
}

// Run the rules-based engine tests
runRulesEngineTests().catch(console.error);