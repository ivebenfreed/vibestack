// D1 SQLite Database Integration Test
// Tests real database persistence with Cloudflare D1 SQLite

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

async function runD1SqliteTest() {
  console.log('💾 D1 SQLite Database Integration Test');
  console.log('=====================================\\n');

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
    // Test 1: Health Check with D1 Binding
    console.log('📋 TEST 1: Health Check with D1 Database Binding');
    
    const healthCheck = await httpRequest('GET', '/health');
    testResult('Worker health check', healthCheck.ok, `Status: ${healthCheck.status}`);

    // Test 2: Deploy Entity with Real D1 Table Creation
    console.log('\\n📋 TEST 2: Deploy Entity with Real D1 Table Creation');
    
    const testEntity = {
      name: 'D1TestEntity',
      orgId: 'test-d1-org',
      basePrimitive: 'Project',
      customFields: {
        projectType: { type: 'enum', enum: ['web', 'mobile', 'api'], required: true },
        budget: { type: 'number', min: 1000, max: 100000, required: true },
        clientEmail: { type: 'email', required: true },
        isActive: { type: 'boolean', default: true },
        tags: { type: 'array', default: [] }
      },
      validationRules: {
        rules: [
          { field: 'budget', operator: 'greater_than', value: 5000, message: 'Budget must exceed $5000 for D1 testing' },
          { field: 'clientEmail', operator: 'ends_with', value: '.com', message: 'Email must end with .com' }
        ],
        operator: 'and'
      }
    };

    const deployResult = await httpRequest('POST', '/rules/deploy', testEntity);
    testResult('Entity deployment with D1 table creation', 
               deployResult.ok && deployResult.data.success, 
               `Table: ${deployResult.data.schema?.tableName || 'N/A'}`);

    // Test 3: Verify Table Schema in D1 Database
    console.log('\\n📋 TEST 3: Verify Table Schema in D1 Database');
    
    const expectedTableName = 'test_d1_org_d1testentitys';
    const schemaResult = await httpRequest('GET', `/debug/table/${expectedTableName}/schema`);
    const hasRealSchema = schemaResult.ok && schemaResult.data.schema;
    testResult('Real D1 table schema verification', hasRealSchema,
               `Schema SQL: ${schemaResult.data.schema?.sql ? 'Found' : 'Missing'}`);

    // Test 4: Real Data Persistence - Insert Records
    console.log('\\n📋 TEST 4: Real Data Persistence - Insert Records');
    
    const testRecords = [
      {
        name: 'D1 E-commerce Platform',
        description: 'SQLite-powered online store',
        projectType: 'web',
        budget: 25000,
        clientEmail: 'client1@test.com',
        isActive: true,
        tags: ['e-commerce', 'sqlite', 'd1']
      },
      {
        name: 'Mobile Banking App',
        description: 'Secure banking with D1 backend',
        projectType: 'mobile',
        budget: 45000,
        clientEmail: 'client2@bank.com',
        isActive: true,
        tags: ['mobile', 'banking', 'security']
      },
      {
        name: 'API Gateway Service',
        description: 'Microservices API with D1 storage',
        projectType: 'api',
        budget: 15000,
        clientEmail: 'client3@api.com',
        isActive: false,
        tags: ['api', 'microservices', 'gateway']
      }
    ];

    const insertResults = [];
    for (const record of testRecords) {
      const insertResult = await httpRequest('POST', '/data/test-d1-org/D1TestEntity/save', record);
      insertResults.push(insertResult);
    }

    const successfulInserts = insertResults.filter(r => r.ok && r.data.success).length;
    testResult('Real data insertion to D1', successfulInserts === testRecords.length,
               `Inserted ${successfulInserts}/${testRecords.length} records successfully`);

    // Test 5: Real Data Retrieval from D1
    console.log('\\n📋 TEST 5: Real Data Retrieval from D1');
    
    const queryResult = await httpRequest('GET', '/data/test-d1-org/D1TestEntity?limit=10');
    const hasData = queryResult.ok && queryResult.data.success && queryResult.data.data.length > 0;
    testResult('Data retrieval from D1 SQLite', hasData,
               `Retrieved ${queryResult.data?.count || 0} records from D1 database`);

    if (hasData) {
      const firstRecord = queryResult.data.data[0];
      const hasCorrectStructure = firstRecord.id && firstRecord.created_at && firstRecord.organization_id;
      testResult('D1 record structure validation', hasCorrectStructure,
                 `Record contains: ${Object.keys(firstRecord).slice(0, 5).join(', ')}`);
    }

    // Test 6: Business Rules Validation with D1 Backend
    console.log('\\n📋 TEST 6: Business Rules Validation with D1 Backend');
    
    const invalidRecord = {
      name: 'Invalid Budget Project',
      projectType: 'web',
      budget: 2000, // Below minimum of 5000
      clientEmail: 'invalid@test.org', // Doesn't end with .com
      isActive: true
    };

    const validationResult = await httpRequest('POST', '/data/test-d1-org/D1TestEntity/save', invalidRecord);
    const validationFailed = !validationResult.ok && validationResult.data.errors?.length > 0;
    testResult('Business rules validation with D1', validationFailed,
               `Validation errors: ${validationResult.data.errors?.join('; ') || 'None'}`);

    // Test 7: Multi-Organization Isolation in D1
    console.log('\\n📋 TEST 7: Multi-Organization Isolation in D1');
    
    // Deploy same entity to different org
    const org2Entity = {
      ...testEntity,
      orgId: 'test-d1-org-2'
    };

    const org2Deploy = await httpRequest('POST', '/rules/deploy', org2Entity);
    const org2Success = org2Deploy.ok && org2Deploy.data.success;
    testResult('Second organization entity deployment', org2Success,
               `Org2 table: ${org2Deploy.data.schema?.tableName || 'N/A'}`);

    if (org2Success) {
      // Insert data to second org
      const org2Record = {
        name: 'Org2 Project',
        projectType: 'mobile',
        budget: 30000,
        clientEmail: 'org2client@test.com',
        isActive: true
      };

      const org2Insert = await httpRequest('POST', '/data/test-d1-org-2/D1TestEntity/save', org2Record);
      const org2InsertSuccess = org2Insert.ok && org2Insert.data.success;
      testResult('Multi-org data isolation', org2InsertSuccess,
                 `Org2 record saved to separate D1 table`);

      // Verify data isolation
      const org1Data = await httpRequest('GET', '/data/test-d1-org/D1TestEntity?limit=20');
      const org2Data = await httpRequest('GET', '/data/test-d1-org-2/D1TestEntity?limit=20');
      
      const isolationWorking = org1Data.ok && org2Data.ok && 
                              org1Data.data.count !== org2Data.data.count;
      testResult('Cross-org data isolation verification', isolationWorking,
                 `Org1: ${org1Data.data?.count || 0} records, Org2: ${org2Data.data?.count || 0} records`);
    }

    // Test 8: D1 Migration Tracking
    console.log('\\n📋 TEST 8: D1 Migration Tracking');
    
    const migrationsResult = await httpRequest('GET', '/debug/migrations');
    const hasMigrations = migrationsResult.ok && migrationsResult.data.migrations?.length > 0;
    testResult('D1 migration tracking', hasMigrations,
               `Total migrations: ${migrationsResult.data?.total || 0}`);

    if (hasMigrations) {
      const latestMigration = migrationsResult.data.migrations[0];
      const migrationValid = latestMigration.id && latestMigration.executedAt && latestMigration.sql;
      testResult('Migration metadata completeness', migrationValid,
                 `Latest: ${latestMigration.operation} for ${latestMigration.entityName}`);
    }

    // Test 9: Enhanced Database Report with D1 Statistics
    console.log('\\n📋 TEST 9: Enhanced Database Report with D1 Statistics');
    
    const databaseReport = await httpRequest('GET', '/reports/database');
    const hasD1Stats = databaseReport.ok && databaseReport.data.persistenceType === 'd1-sqlite' && 
                      databaseReport.data.summary?.actualTablesInD1 !== undefined;
    testResult('D1-enhanced database report', hasD1Stats,
               `D1 tables: ${databaseReport.data.summary?.actualTablesInD1 || 0}, Total: ${databaseReport.data.summary?.totalTables || 0}`);

    // Test 10: Comprehensive Multi-Org Report with D1
    console.log('\\n📋 TEST 10: Comprehensive Multi-Org Report with D1');
    
    const multiOrgReport = await httpRequest('GET', '/reports/multi-org');
    const hasD1MultiOrg = multiOrgReport.ok && multiOrgReport.data.persistenceType === 'd1-sqlite' &&
                         multiOrgReport.data.summary?.actualTablesInD1 !== undefined;
    testResult('D1-powered multi-org report', hasD1MultiOrg,
               `Organizations: ${multiOrgReport.data.summary?.totalOrganizations || 0}, D1 tables: ${multiOrgReport.data.summary?.actualTablesInD1 || 0}`);

    // Final Summary
    console.log('\\n🎯 D1 SQLITE INTEGRATION TEST SUMMARY');
    console.log('=====================================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\\n🎉 ALL D1 SQLITE TESTS PASSED!');
      console.log('\\n✅ Real database table creation working');
      console.log('✅ Data persistence to D1 SQLite confirmed');
      console.log('✅ Business rules validation with real DB backend');
      console.log('✅ Multi-organization isolation in D1 tables');
      console.log('✅ Migration tracking in D1 database');
      console.log('✅ Enhanced reporting with D1 statistics');
      console.log('\\n🚀 D1 SQLITE INTEGRATION FULLY VALIDATED!');
      
      // Display database statistics
      if (multiOrgReport.ok && databaseReport.ok) {
        console.log('\\n📊 D1 DATABASE STATISTICS:');
        console.log(`   - Organizations in D1: ${multiOrgReport.data.summary?.totalOrganizations}`);
        console.log(`   - Tables created in D1: ${databaseReport.data.summary?.actualTablesInD1}`);
        console.log(`   - Migrations executed: ${databaseReport.data.summary?.completedMigrations}`);
        console.log(`   - Records inserted: ${successfulInserts}`);
        console.log(`   - Persistence Type: ${databaseReport.data.persistenceType}`);
        console.log(`   - Database Type: SQLite (Cloudflare D1)`);
      }
    } else {
      console.log('\\n⚠️  Some D1 SQLite tests failed - review D1 configuration');
    }

  } catch (error) {
    console.error('❌ D1 SQLite test failed:', error);
  }
}

// Run the D1 SQLite integration tests
runD1SqliteTest().catch(console.error);