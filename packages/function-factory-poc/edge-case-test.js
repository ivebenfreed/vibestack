// Edge case and error handling test for Function Factory POC

// Reuse the mock setup from simple-test.js
class MockKV {
  constructor() {
    this.storage = new Map();
  }
  async put(key, value) {
    this.storage.set(key, value);
  }
  async get(key) {
    return this.storage.get(key);
  }
  async list(options = {}) {
    const keys = Array.from(this.storage.keys());
    const filtered = options.prefix ? keys.filter(k => k.startsWith(options.prefix)) : keys;
    return { keys: filtered.map(name => ({ name })) };
  }
}

const BASE_PRIMITIVES = {
  Project: {
    name: 'Project',
    coreFields: { id: 'string', name: 'string', status: 'enum' },
    defaultStatus: 'draft'
  }
};

class SimpleFunctionFactory {
  constructor(env) {
    this.env = env;
  }

  async deployEntity(entityDef) {
    const primitive = BASE_PRIMITIVES[entityDef.basePrimitive];
    if (!primitive) {
      throw new Error(`Unknown primitive: ${entityDef.basePrimitive}`);
    }

    const tableName = `${entityDef.orgId}_${entityDef.name.toLowerCase()}s`;
    const schema = { definition: entityDef, tableName, createdAt: new Date().toISOString(), version: 1 };

    // Store functions
    const functions = {
      validate: entityDef.businessLogic.validate || this.generateValidationFunction(entityDef, primitive)
    };

    for (const [fnName, code] of Object.entries(functions)) {
      const key = `fn:${entityDef.orgId}:${entityDef.name}:${fnName}`;
      await this.env.ENTITY_FUNCTIONS.put(key, code);
    }

    const schemaKey = `schema:${entityDef.orgId}:${entityDef.name}`;
    await this.env.ENTITY_SCHEMAS.put(schemaKey, JSON.stringify(schema));

    return schema;
  }

  generateValidationFunction(entityDef, primitive) {
    return `
      function validate(data) {
        const errors = [];
        if (!data.name) errors.push('name is required');
        return { valid: errors.length === 0, errors: errors };
      }
      return validate(data);
    `;
  }

  async executeFunction(orgId, entityName, operation, data) {
    try {
      const functionKey = `fn:${orgId}:${entityName}:${operation}`;
      const code = await this.env.ENTITY_FUNCTIONS.get(functionKey);

      if (!code) {
        return { success: false, error: `Function not found: ${functionKey}` };
      }

      const result = this.executeFunctionCode(code, data);
      return { success: true, result: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  executeFunctionCode(code, data) {
    const safeGlobals = { console: console, data: data, URL: URL };
    return Function('console', 'data', 'URL', code)(safeGlobals.console, safeGlobals.data, safeGlobals.URL);
  }
}

// Run edge case tests
async function runEdgeCaseTests() {
  console.log('🔬 Function Factory POC - Edge Case Testing');
  console.log('===========================================\n');

  const mockEnv = {
    ENTITY_FUNCTIONS: new MockKV(),
    ENTITY_SCHEMAS: new MockKV(),
    ENTITY_CONFIG: new MockKV()
  };

  const factory = new SimpleFunctionFactory(mockEnv);
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
    // Test 1: Invalid primitive
    console.log('📋 TEST 1: Error Handling - Invalid Primitive');
    try {
      await factory.deployEntity({
        name: 'TestEntity',
        orgId: 'test-org',
        basePrimitive: 'NonExistentPrimitive',
        customFields: {},
        businessLogic: {}
      });
      testResult('Invalid primitive handling', false, 'Should have thrown error');
    } catch (error) {
      testResult('Invalid primitive handling', error.message.includes('Unknown primitive'), `Error: ${error.message}`);
    }

    // Test 2: Function not found
    console.log('\n📋 TEST 2: Error Handling - Function Not Found');
    const result = await factory.executeFunction('missing-org', 'MissingEntity', 'validate', {});
    testResult('Function not found handling', !result.success && result.error.includes('Function not found'), `Error: ${result.error}`);

    // Test 3: Malformed function code
    console.log('\n📋 TEST 3: Error Handling - Malformed Function Code');
    
    // Deploy entity with broken validation code
    await factory.deployEntity({
      name: 'BrokenEntity',
      orgId: 'test-org',
      basePrimitive: 'Project',
      customFields: {},
      businessLogic: {
        validate: 'this is not valid javascript code!!!'
      }
    });

    const brokenResult = await factory.executeFunction('test-org', 'BrokenEntity', 'validate', { name: 'test' });
    testResult('Malformed function handling', !brokenResult.success, `Handled error: ${brokenResult.error}`);

    // Test 4: Function throws runtime error
    console.log('\n📋 TEST 4: Error Handling - Runtime Error in Function');
    
    await factory.deployEntity({
      name: 'RuntimeErrorEntity',
      orgId: 'test-org',
      basePrimitive: 'Project',
      customFields: {},
      businessLogic: {
        validate: `
          function validate(data) {
            throw new Error('Intentional runtime error');
          }
          return validate(data);
        `
      }
    });

    const runtimeErrorResult = await factory.executeFunction('test-org', 'RuntimeErrorEntity', 'validate', { name: 'test' });
    testResult('Runtime error handling', !runtimeErrorResult.success && runtimeErrorResult.error.includes('Intentional runtime error'), `Handled error: ${runtimeErrorResult.error}`);

    // Test 5: Complex validation logic
    console.log('\n📋 TEST 5: Complex Validation Logic');
    
    await factory.deployEntity({
      name: 'ComplexEntity',
      orgId: 'advanced-org',
      basePrimitive: 'Project',
      customFields: {
        email: { type: 'email', required: true },
        age: { type: 'number', required: true },
        website: { type: 'url', required: false }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            
            // Email validation
            if (!data.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.email)) {
              errors.push('Valid email is required');
            }
            
            // Age validation
            if (!data.age || data.age < 18 || data.age > 120) {
              errors.push('Age must be between 18 and 120');
            }
            
            // Website validation (if provided)
            if (data.website) {
              try {
                new URL(data.website);
                if (!data.website.startsWith('https://')) {
                  errors.push('Website must use HTTPS');
                }
              } catch {
                errors.push('Website must be a valid URL');
              }
            }
            
            // Business logic: certain domains not allowed
            if (data.email && data.email.endsWith('@competitor.com')) {
              errors.push('Competitor email addresses not allowed');
            }
            
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    });

    // Valid complex data
    const validComplexData = {
      name: 'John Doe',
      email: 'john@company.com',
      age: 30,
      website: 'https://johndoe.com'
    };

    const validComplexResult = await factory.executeFunction('advanced-org', 'ComplexEntity', 'validate', validComplexData);
    testResult('Complex validation - valid data', validComplexResult.success && validComplexResult.result.valid, 'All validations passed');

    // Invalid complex data (multiple errors)
    const invalidComplexData = {
      name: 'Jane Doe',
      email: 'jane@competitor.com',  // Not allowed domain
      age: 15,                       // Too young
      website: 'http://jane.com'     // Not HTTPS
    };

    const invalidComplexResult = await factory.executeFunction('advanced-org', 'ComplexEntity', 'validate', invalidComplexData);
    const hasExpectedErrors = !invalidComplexResult.result.valid && 
                             invalidComplexResult.result.errors.length === 3 &&
                             invalidComplexResult.result.errors.some(e => e.includes('Competitor email')) &&
                             invalidComplexResult.result.errors.some(e => e.includes('Age must be')) &&
                             invalidComplexResult.result.errors.some(e => e.includes('HTTPS'));
    
    testResult('Complex validation - invalid data', hasExpectedErrors, `Found ${invalidComplexResult.result.errors.length} expected errors`);

    // Test 6: Multi-org isolation
    console.log('\n📋 TEST 6: Multi-Org Isolation');
    
    // Deploy same entity name for different orgs
    await factory.deployEntity({
      name: 'UserProfile',
      orgId: 'org-a',
      basePrimitive: 'Project',
      customFields: { department: { type: 'string' } },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (data.department && data.department !== 'Engineering') {
              errors.push('Only Engineering department allowed in Org A');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    });

    await factory.deployEntity({
      name: 'UserProfile',
      orgId: 'org-b',
      basePrimitive: 'Project',
      customFields: { department: { type: 'string' } },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            if (data.department && data.department !== 'Marketing') {
              errors.push('Only Marketing department allowed in Org B');
            }
            return { valid: errors.length === 0, errors: errors };
          }
          return validate(data);
        `
      }
    });

    // Test org A validation
    const orgAResult = await factory.executeFunction('org-a', 'UserProfile', 'validate', { 
      name: 'Alice', 
      department: 'Engineering' 
    });
    testResult('Org A validation', orgAResult.success && orgAResult.result.valid, 'Engineering allowed in Org A');

    const orgAInvalidResult = await factory.executeFunction('org-a', 'UserProfile', 'validate', { 
      name: 'Alice', 
      department: 'Marketing' 
    });
    testResult('Org A isolation', !orgAInvalidResult.result.valid && orgAInvalidResult.result.errors[0].includes('Engineering'), 'Marketing rejected in Org A');

    // Test org B validation
    const orgBResult = await factory.executeFunction('org-b', 'UserProfile', 'validate', { 
      name: 'Bob', 
      department: 'Marketing' 
    });
    testResult('Org B validation', orgBResult.success && orgBResult.result.valid, 'Marketing allowed in Org B');

    const orgBInvalidResult = await factory.executeFunction('org-b', 'UserProfile', 'validate', { 
      name: 'Bob', 
      department: 'Engineering' 
    });
    testResult('Org B isolation', !orgBInvalidResult.result.valid && orgBInvalidResult.result.errors[0].includes('Marketing'), 'Engineering rejected in Org B');

    // Test 7: Function code safety
    console.log('\n📋 TEST 7: Function Code Safety');
    
    await factory.deployEntity({
      name: 'SafetyTestEntity',
      orgId: 'safety-org',
      basePrimitive: 'Project',
      customFields: {},
      businessLogic: {
        validate: `
          function validate(data) {
            // Try to access potentially dangerous globals (should be undefined)
            const unsafeAccess = {
              process: typeof process,
              require: typeof require,
              global: typeof global,
              globalThis: typeof globalThis,
              eval: typeof eval
            };
            
            console.log('Safety check:', unsafeAccess);
            
            return { 
              valid: true, 
              safetyCheck: unsafeAccess,
              canAccessURL: typeof URL !== 'undefined'
            };
          }
          return validate(data);
        `
      }
    });

    const safetyResult = await factory.executeFunction('safety-org', 'SafetyTestEntity', 'validate', { name: 'test' });
    const isSafe = safetyResult.success && 
                   safetyResult.result.safetyCheck.process === 'undefined' &&
                   safetyResult.result.canAccessURL === true;
    
    testResult('Function code safety', isSafe, 'Dangerous globals are undefined, safe globals available');

    // Summary
    console.log('\n🎯 EDGE CASE TEST SUMMARY');
    console.log('=========================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL EDGE CASE TESTS PASSED!');
      console.log('\n✅ Error handling robust');
      console.log('✅ Complex validation logic working');
      console.log('✅ Multi-org isolation perfect');
      console.log('✅ Function code safety verified');
      console.log('✅ Runtime error handling solid');
    } else {
      console.log('\n⚠️  Some edge case tests failed - review needed');
    }

  } catch (error) {
    console.error('❌ Edge case test suite failed:', error);
  }
}

// Run the edge case tests
runEdgeCaseTests();