// Real server test for Function Factory POC
// Tests against the actual running HTTP server

const BASE_URL = 'http://localhost:8788';

async function httpRequest(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
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

async function runRealServerTests() {
  console.log('🧪 Function Factory POC - Real Server Testing');
  console.log('==============================================\n');

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
    // Test 1: Health check
    console.log('📋 TEST 1: Health Check');
    const healthResponse = await httpRequest('GET', '/health');
    testResult('Health endpoint', healthResponse.ok && healthResponse.data === 'Function Factory POC OK', 
                `Status: ${healthResponse.status}, Response: ${healthResponse.data}`);

    // Test 2: List primitives
    console.log('\n📋 TEST 2: List Available Primitives');
    const primitivesResponse = await httpRequest('GET', '/primitives');
    const hasPrimitives = primitivesResponse.ok && 
                         primitivesResponse.data.primitives && 
                         primitivesResponse.data.primitives.length > 0;
    testResult('Primitives endpoint', hasPrimitives, 
               `Found ${primitivesResponse.data?.primitives?.length || 0} primitives: ${primitivesResponse.data?.primitives?.map(p => p.name).join(', ') || 'none'}`);

    // Test 3: Deploy SoftwareProject entity
    console.log('\n📋 TEST 3: Deploy SoftwareProject Entity');
    const softwareProjectDef = {
      name: 'SoftwareProject',
      orgId: 'acme-corp',
      basePrimitive: 'Project',
      customFields: {
        repositoryUrl: { type: 'url', required: true },
        techStack: { type: 'array', required: false },
        programmingLanguage: { type: 'enum', options: ['JavaScript', 'TypeScript', 'Python', 'Go'], required: true },
        codeQuality: { type: 'number', required: false }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            
            // Repository validation
            if (data.repositoryUrl && !data.repositoryUrl.includes('github.com/acme/')) {
              errors.push('Repository must be in acme GitHub organization');
            }
            
            // Tech stack validation
            if (data.techStack && data.techStack.includes('PHP')) {
              errors.push('PHP not allowed in Acme projects');
            }
            
            // Code quality validation
            if (data.codeQuality && (data.codeQuality < 1 || data.codeQuality > 10)) {
              errors.push('Code quality must be between 1 and 10');
            }
            
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const deployResponse = await httpRequest('POST', '/factory/deploy', softwareProjectDef);
    const deploySuccess = deployResponse.ok && deployResponse.data.success;
    testResult('SoftwareProject deployment', deploySuccess, 
               `Status: ${deployResponse.status}, Message: ${deployResponse.data?.message || 'No message'}`);

    // Test 4: Deploy MarketingCampaign entity
    console.log('\n📋 TEST 4: Deploy MarketingCampaign Entity');
    const marketingCampaignDef = {
      name: 'MarketingCampaign',
      orgId: 'acme-corp',
      basePrimitive: 'Project',
      customFields: {
        budget: { type: 'number', required: true },
        targetAudience: { type: 'string', required: true },
        channels: { type: 'array', required: false },
        roi: { type: 'number', required: false }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            
            if (data.budget && data.budget > 100000) {
              errors.push('Budget cannot exceed $100,000');
            }
            
            if (data.budget && data.budget < 1000) {
              errors.push('Budget must be at least $1,000');
            }
            
            if (data.targetAudience && data.targetAudience.length < 10) {
              errors.push('Target audience description too short');
            }
            
            if (data.roi && data.roi < 0) {
              errors.push('ROI cannot be negative');
            }
            
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const marketingDeployResponse = await httpRequest('POST', '/factory/deploy', marketingCampaignDef);
    const marketingDeploySuccess = marketingDeployResponse.ok && marketingDeployResponse.data.success;
    testResult('MarketingCampaign deployment', marketingDeploySuccess, 
               `Status: ${marketingDeployResponse.status}, Table: ${marketingDeployResponse.data?.schema?.tableName || 'N/A'}`);

    // Test 5: Validation function testing
    console.log('\n📋 TEST 5: Validation Function Testing');

    // Valid SoftwareProject
    const validProject = {
      name: 'Awesome App',
      description: 'A revolutionary software project',
      repositoryUrl: 'https://github.com/acme/awesome-app',
      techStack: ['JavaScript', 'React', 'Node.js'],
      programmingLanguage: 'TypeScript',
      codeQuality: 9
    };

    const validProjectResponse = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/validate', validProject);
    const validProjectSuccess = validProjectResponse.ok && validProjectResponse.data.result?.valid;
    testResult('Valid project validation', validProjectSuccess, 
               validProjectSuccess ? 'Validation passed' : `Errors: ${validProjectResponse.data.result?.errors?.join(', ') || 'Unknown error'}`);

    // Invalid SoftwareProject (multiple issues)
    const invalidProject = {
      name: 'Bad Project',
      description: 'A problematic project',
      repositoryUrl: 'https://github.com/competitor/bad-project',
      techStack: ['PHP', 'Legacy'],
      programmingLanguage: 'TypeScript',
      codeQuality: 15  // Out of range
    };

    const invalidProjectResponse = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/validate', invalidProject);
    const invalidProjectCorrect = invalidProjectResponse.ok && !invalidProjectResponse.data.result?.valid && 
                                  invalidProjectResponse.data.result?.errors?.length >= 2;
    testResult('Invalid project validation', invalidProjectCorrect, 
               `Found ${invalidProjectResponse.data.result?.errors?.length || 0} errors: ${invalidProjectResponse.data.result?.errors?.join(', ') || 'None'}`);

    // Valid MarketingCampaign
    const validCampaign = {
      name: 'Summer Launch Campaign',
      description: 'Quarterly product launch campaign',
      budget: 50000,
      targetAudience: 'Tech-savvy professionals aged 25-45 interested in productivity tools',
      channels: ['Social Media', 'Email', 'Content Marketing'],
      roi: 2.5
    };

    const validCampaignResponse = await httpRequest('POST', '/entity/acme-corp/MarketingCampaign/validate', validCampaign);
    const validCampaignSuccess = validCampaignResponse.ok && validCampaignResponse.data.result?.valid;
    testResult('Valid campaign validation', validCampaignSuccess, 
               validCampaignSuccess ? 'Validation passed' : `Errors: ${validCampaignResponse.data.result?.errors?.join(', ') || 'Unknown error'}`);

    // Invalid MarketingCampaign (over budget + short description)
    const invalidCampaign = {
      name: 'Expensive Campaign',
      description: 'Bad campaign',
      budget: 150000,  // Over limit
      targetAudience: 'People',  // Too short
      roi: -1  // Negative
    };

    const invalidCampaignResponse = await httpRequest('POST', '/entity/acme-corp/MarketingCampaign/validate', invalidCampaign);
    const invalidCampaignCorrect = invalidCampaignResponse.ok && !invalidCampaignResponse.data.result?.valid && 
                                   invalidCampaignResponse.data.result?.errors?.length >= 3;
    testResult('Invalid campaign validation', invalidCampaignCorrect, 
               `Found ${invalidCampaignResponse.data.result?.errors?.length || 0} errors: ${invalidCampaignResponse.data.result?.errors?.join(', ') || 'None'}`);

    // Test 6: Save function testing
    console.log('\n📋 TEST 6: Save Function Testing');
    const saveProjectResponse = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/save', validProject);
    const saveSuccess = saveProjectResponse.ok && saveProjectResponse.data.result;
    const savedData = saveProjectResponse.data.result || {};
    
    const hasId = savedData.id && savedData.id.startsWith('uuid-');
    const hasTimestamps = savedData.created_at && savedData.updated_at;
    const hasStatus = savedData.status === 'draft';
    const hasCustomData = savedData.custom_data && typeof savedData.custom_data === 'object';
    
    testResult('Save function execution', saveSuccess, 
               `ID: ${hasId ? '✅' : '❌'}, Timestamps: ${hasTimestamps ? '✅' : '❌'}, Status: ${hasStatus ? '✅' : '❌'}, Custom data: ${hasCustomData ? '✅' : '❌'}`);

    // Test 7: Query function testing
    console.log('\n📋 TEST 7: Query Function Testing');
    const queryResponse = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/query', { status: 'active', techStack: 'React' });
    const querySuccess = queryResponse.ok && queryResponse.data.result;
    const queryData = queryResponse.data.result || {};
    
    const hasQueryTable = queryData.table === 'acme-corp_softwareprojects';
    const hasFilters = queryData.filters && typeof queryData.filters === 'object';
    const hasCoreFields = Array.isArray(queryData.coreFields) && queryData.coreFields.length > 0;
    const hasCustomFields = Array.isArray(queryData.customFields) && queryData.customFields.length > 0;
    
    testResult('Query function execution', querySuccess && hasQueryTable, 
               `Table: ${hasQueryTable ? '✅' : '❌'}, Filters: ${hasFilters ? '✅' : '❌'}, Core fields: ${hasCoreFields ? queryData.coreFields.length : 0}, Custom fields: ${hasCustomFields ? queryData.customFields.length : 0}`);

    // Test 8: List org entities
    console.log('\n📋 TEST 8: List Organization Entities');
    const entitiesResponse = await httpRequest('GET', '/org/acme-corp/entities');
    const entitiesSuccess = entitiesResponse.ok && Array.isArray(entitiesResponse.data.entities);
    const entityList = entitiesResponse.data.entities || [];
    
    const hasExpectedEntities = entityList.includes('SoftwareProject') && entityList.includes('MarketingCampaign');
    testResult('List org entities', entitiesSuccess && hasExpectedEntities, 
               `Found ${entityList.length} entities: ${entityList.join(', ')}`);

    // Test 9: Get entity schema
    console.log('\n📋 TEST 9: Get Entity Schema');
    const schemaResponse = await httpRequest('GET', '/schema/acme-corp/SoftwareProject');
    const schemaSuccess = schemaResponse.ok && schemaResponse.data.schema;
    const schema = schemaResponse.data.schema || {};
    
    const hasDefinition = schema.definition && schema.definition.name === 'SoftwareProject';
    const hasSchemaTable = schema.tableName === 'acme-corp_softwareprojects';
    const hasVersion = schema.version === 1;
    
    testResult('Get entity schema', schemaSuccess && hasDefinition, 
               `Definition: ${hasDefinition ? '✅' : '❌'}, Table: ${hasSchemaTable ? '✅' : '❌'}, Version: ${hasVersion ? '✅' : '❌'}`);

    // Test 10: Debug functions
    console.log('\n📋 TEST 10: Debug Functions List');
    const debugResponse = await httpRequest('GET', '/debug/functions');
    const debugSuccess = debugResponse.ok && debugResponse.data;
    const debugData = debugResponse.data || {};
    
    const functionCount = debugData.functions?.length || 0;
    const schemaCount = debugData.schemas?.length || 0;
    const configCount = debugData.config?.length || 0;
    
    const hasExpectedCounts = functionCount >= 6 && schemaCount >= 2 && configCount >= 2;
    testResult('Debug functions list', debugSuccess && hasExpectedCounts, 
               `Functions: ${functionCount}, Schemas: ${schemaCount}, Config: ${configCount}`);

    // Test 11: Multi-org isolation
    console.log('\n📋 TEST 11: Multi-Org Isolation Test');
    
    // Deploy same entity name for different org
    const otherOrgEntity = {
      name: 'SoftwareProject',
      orgId: 'other-corp',
      basePrimitive: 'Project',
      customFields: {
        repositoryUrl: { type: 'url', required: true }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (data.repositoryUrl && !data.repositoryUrl.includes('github.com/other/')) {
              errors.push('Repository must be in other GitHub organization');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    };

    const otherOrgDeployResponse = await httpRequest('POST', '/factory/deploy', otherOrgEntity);
    const otherOrgDeploySuccess = otherOrgDeployResponse.ok && otherOrgDeployResponse.data.success;
    
    // Test that acme-corp rules still work
    const acmeValidationResponse = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/validate', {
      name: 'Test',
      repositoryUrl: 'https://github.com/acme/test'
    });
    
    // Test that other-corp has different rules
    const otherValidationResponse = await httpRequest('POST', '/entity/other-corp/SoftwareProject/validate', {
      name: 'Test',
      repositoryUrl: 'https://github.com/other/test'
    });
    
    const isolationWorking = otherOrgDeploySuccess && 
                            acmeValidationResponse.data.result?.valid &&
                            otherValidationResponse.data.result?.valid;
    
    testResult('Multi-org isolation', isolationWorking, 
               `Other org deploy: ${otherOrgDeploySuccess ? '✅' : '❌'}, Acme validation: ${acmeValidationResponse.data.result?.valid ? '✅' : '❌'}, Other validation: ${otherValidationResponse.data.result?.valid ? '✅' : '❌'}`);

    // Summary
    console.log('\n🎯 REAL SERVER TEST SUMMARY');
    console.log('===========================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL REAL SERVER TESTS PASSED!');
      console.log('\n✅ HTTP API working perfectly');
      console.log('✅ Entity deployment working');
      console.log('✅ Function execution working');
      console.log('✅ Custom validation logic working');
      console.log('✅ Save and query functions working');
      console.log('✅ Multi-org isolation working');
      console.log('✅ Debug endpoints working');
      console.log('✅ Schema management working');
      console.log('\n🚀 FUNCTION FACTORY POC FULLY VALIDATED AGAINST REAL SERVER!');
    } else {
      console.log('\n⚠️  Some tests failed - review needed');
    }

  } catch (error) {
    console.error('❌ Real server test failed:', error);
  }
}

// Run the real server tests
runRealServerTests().catch(console.error);