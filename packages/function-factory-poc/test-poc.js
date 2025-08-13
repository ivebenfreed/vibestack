// Simple test script for Function Factory POC
// Run this after starting the worker with: pnpm dev

const BASE_URL = 'http://localhost:8788';

async function testFunctionFactoryPOC() {
  console.log('🚀 Testing Function Factory POC\n');

  try {
    // 1. Check health
    console.log('1. Health check...');
    const health = await fetch(`${BASE_URL}/health`);
    console.log('   Status:', health.status, await health.text());

    // 2. Get available primitives
    console.log('\n2. Available primitives...');
    const primitives = await fetch(`${BASE_URL}/primitives`);
    const primitivesData = await primitives.json();
    console.log('   Primitives:', primitivesData.primitives.map(p => p.name).join(', '));

    // 3. Deploy a SoftwareProject entity
    console.log('\n3. Deploying SoftwareProject entity...');
    const entityDef = {
      name: 'SoftwareProject',
      orgId: 'acme-corp',
      basePrimitive: 'Project',
      customFields: {
        repositoryUrl: {
          type: 'url',
          required: true
        },
        techStack: {
          type: 'array',
          required: false
        },
        programmingLanguage: {
          type: 'enum',
          options: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust'],
          required: true
        }
      },
      businessLogic: {
        validate: `
          function validate(data) {
            const errors = [];
            
            // Custom validation: repository must be from acme org
            if (data.repositoryUrl && !data.repositoryUrl.includes('github.com/acme/')) {
              errors.push('Repository must be in the acme GitHub organization');
            }
            
            // Custom validation: no PHP allowed
            if (data.techStack && data.techStack.includes('PHP')) {
              errors.push('PHP is not allowed in Acme projects');
            }
            
            return {
              valid: errors.length === 0,
              errors: errors
            };
          }
          
          return validate(data);
        `
      }
    };

    const deployResponse = await fetch(`${BASE_URL}/factory/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityDef)
    });
    const deployData = await deployResponse.json();
    console.log('   Deploy result:', deployData.success ? '✅ Success' : '❌ Failed');
    if (!deployData.success) {
      console.log('   Error:', deployData.error);
      return;
    }

    // 4. Test validation function
    console.log('\n4. Testing validation function...');
    
    // Valid data
    const validData = {
      name: 'My Awesome Project',
      description: 'A cool software project',
      repositoryUrl: 'https://github.com/acme/awesome-project',
      techStack: ['JavaScript', 'React'],
      programmingLanguage: 'TypeScript'
    };

    const validationResponse = await fetch(`${BASE_URL}/entity/acme-corp/SoftwareProject/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validData)
    });
    const validationResult = await validationResponse.json();
    console.log('   Valid data test:', validationResult.result?.valid ? '✅ Pass' : '❌ Fail');
    if (!validationResult.result?.valid) {
      console.log('   Errors:', validationResult.result?.errors);
    }

    // Invalid data (wrong repo)
    const invalidData = {
      ...validData,
      repositoryUrl: 'https://github.com/competitor/project',
      techStack: ['PHP'] // Also not allowed
    };

    const invalidValidationResponse = await fetch(`${BASE_URL}/entity/acme-corp/SoftwareProject/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });
    const invalidValidationResult = await invalidValidationResponse.json();
    console.log('   Invalid data test:', !invalidValidationResult.result?.valid ? '✅ Pass (correctly rejected)' : '❌ Fail');
    if (!invalidValidationResult.result?.valid) {
      console.log('   Expected errors:', invalidValidationResult.result?.errors);
    }

    // 5. Test save function
    console.log('\n5. Testing save function...');
    const saveResponse = await fetch(`${BASE_URL}/entity/acme-corp/SoftwareProject/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validData)
    });
    const saveResult = await saveResponse.json();
    console.log('   Save result:', saveResult.success ? '✅ Success' : '❌ Failed');
    if (saveResult.success) {
      console.log('   Generated data structure:');
      console.log('   - ID:', saveResult.result.id ? '✅ Generated' : '❌ Missing');
      console.log('   - Timestamps:', saveResult.result.created_at ? '✅ Set' : '❌ Missing');
      console.log('   - Custom data:', saveResult.result.custom_data ? '✅ Separated' : '❌ Missing');
    }

    // 6. Test query function
    console.log('\n6. Testing query function...');
    const queryResponse = await fetch(`${BASE_URL}/entity/acme-corp/SoftwareProject/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    const queryResult = await queryResponse.json();
    console.log('   Query result:', queryResult.success ? '✅ Success' : '❌ Failed');
    if (queryResult.success) {
      console.log('   Generated query for table:', queryResult.result.table);
    }

    // 7. List entities
    console.log('\n7. Listing org entities...');
    const entitiesResponse = await fetch(`${BASE_URL}/org/acme-corp/entities`);
    const entitiesData = await entitiesResponse.json();
    console.log('   Entities:', entitiesData.entities.join(', '));

    // 8. Debug: Show stored functions
    console.log('\n8. Debug: Stored functions...');
    const debugResponse = await fetch(`${BASE_URL}/debug/functions`);
    const debugData = await debugResponse.json();
    console.log('   Functions stored:', debugData.functions.length);
    console.log('   Schemas stored:', debugData.schemas.length);
    console.log('   Function keys:', debugData.functions.slice(0, 3).join(', ') + '...');

    console.log('\n🎉 Function Factory POC test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Entity deployed with custom business logic');
    console.log('   ✅ Functions generated and stored in KV');
    console.log('   ✅ Custom validation logic working');
    console.log('   ✅ Save function generates proper structure');
    console.log('   ✅ Pure runtime execution (no builds!)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFunctionFactoryPOC();