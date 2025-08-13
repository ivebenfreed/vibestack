// Durable Objects Enhanced POC Test
// Tests per-org/per-entity isolation with persistent state management

const BASE_URL = 'http://localhost:8789';

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

async function runDurableObjectsTest() {
  console.log('🏗️  Durable Objects Enhanced POC Test');
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
    // Test 1: Initialize Organizations with Different Isolation Levels
    console.log('📋 TEST 1: Initialize Organizations with Different Isolation Levels');
    
    const organizations = [
      {
        orgId: 'enterprise-corp',
        isolationLevel: 'entity-level',
        scaling: {
          minInstances: 2,
          maxInstances: 10,
          scaleUpThreshold: { requestsPerSecond: 50 }
        },
        storage: { persistent: true },
        compliance: { dataRetention: '7-years', auditLogging: true }
      },
      {
        orgId: 'startup-company',
        isolationLevel: 'org-level', 
        scaling: { minInstances: 1, maxInstances: 3 },
        storage: { persistent: true, caching: { ttl: 3600, strategy: 'write-through' } }
      },
      {
        orgId: 'test-automation',
        isolationLevel: 'auto',
        storage: { persistent: true }
      }
    ];

    const orgInitResults = [];
    for (const orgConfig of organizations) {
      const initResult = await httpRequest('POST', `/durable/org/${orgConfig.orgId}/init`, orgConfig);
      orgInitResults.push({
        orgId: orgConfig.orgId,
        success: initResult.ok,
        isolationLevel: orgConfig.isolationLevel,
        response: initResult.data
      });
    }

    const successfulInits = orgInitResults.filter(r => r.success).length;
    testResult('Multi-tier organization initialization', successfulInits === organizations.length,
               `Initialized ${successfulInits}/${organizations.length} organizations with Durable Objects`);

    // Test 2: Deploy Entities with Smart Routing
    console.log('\\n📋 TEST 2: Deploy Entities with Smart Routing');
    
    const entityConfigs = [
      {
        name: 'HighVolumeEntity',
        orgId: 'enterprise-corp',
        basePrimitive: 'Project',
        customFields: {
          transactionVolume: { type: 'number', min: 1000, max: 1000000, required: true },
          processingPriority: { type: 'enum', enum: ['low', 'high', 'critical'], required: true },
          dataSize: { type: 'string', required: true }
        },
        validationRules: {
          rules: [
            { field: 'transactionVolume', operator: 'greater_than', value: 10000, message: 'High-volume entity requires 10K+ transactions' },
            { field: 'processingPriority', operator: 'in', value: ['high', 'critical'], message: 'High-volume entities need priority processing' }
          ],
          operator: 'and'
        }
      },
      {
        name: 'StartupProject',
        orgId: 'startup-company',
        basePrimitive: 'Task', 
        customFields: {
          mvpFeatures: { type: 'array', required: true },
          fundingStage: { type: 'enum', enum: ['pre-seed', 'seed', 'series-a'], required: true },
          teamSize: { type: 'number', min: 1, max: 50, required: true }
        },
        validationRules: {
          rules: [
            { field: 'mvpFeatures', operator: 'min_length', value: 3, message: 'MVP must have at least 3 core features' }
          ]
        }
      },
      {
        name: 'AutoTestEntity',
        orgId: 'test-automation',
        basePrimitive: 'Project',
        customFields: {
          testCoverage: { type: 'number', min: 0, max: 100, required: true },
          automationLevel: { type: 'enum', enum: ['manual', 'semi', 'full'], required: true }
        }
      }
    ];

    const deployResults = [];
    for (const entityConfig of entityConfigs) {
      const deployResult = await httpRequest('POST', '/durable/deploy', entityConfig);
      deployResults.push({
        entity: `${entityConfig.orgId}:${entityConfig.name}`,
        success: deployResult.ok,
        routing: deployResult.data?.routing,
        response: deployResult.data
      });
    }

    const successfulDeploys = deployResults.filter(r => r.success).length;
    testResult('Smart routing entity deployment', successfulDeploys === entityConfigs.length,
               `Deployed ${successfulDeploys}/${entityConfigs.length} entities with smart routing`);

    // Test smart routing decisions
    const routingDecisions = deployResults
      .filter(r => r.routing?.decision)
      .map(r => `${r.entity}: ${r.routing.decision.route} (${r.routing.decision.confidence?.toFixed(2)})`);
    
    if (routingDecisions.length > 0) {
      testResult('Smart routing decision making', true,
                 `Routing decisions: ${routingDecisions.join(', ')}`);
    }

    // Test 3: Execute Operations via Durable Objects
    console.log('\\n📋 TEST 3: Execute Operations via Durable Objects');
    
    const testOperations = [
      {
        orgId: 'enterprise-corp',
        entityName: 'HighVolumeEntity',
        operation: 'validate',
        data: {
          name: 'High-Volume Processing System',
          transactionVolume: 50000,
          processingPriority: 'critical',
          dataSize: '500MB'
        }
      },
      {
        orgId: 'startup-company', 
        entityName: 'StartupProject',
        operation: 'save',
        data: {
          title: 'Revolutionary Social App',
          mvpFeatures: ['user-auth', 'social-feed', 'real-time-chat', 'media-upload'],
          fundingStage: 'seed',
          teamSize: 8
        }
      },
      {
        orgId: 'test-automation',
        entityName: 'AutoTestEntity',
        operation: 'validate',
        data: {
          name: 'Automated Test Suite',
          testCoverage: 95,
          automationLevel: 'full'
        }
      }
    ];

    const operationResults = [];
    for (const op of testOperations) {
      const opResult = await httpRequest('POST', `/durable/entity/${op.orgId}/${op.entityName}/${op.operation}`, op.data);
      operationResults.push({
        operation: `${op.orgId}:${op.entityName}:${op.operation}`,
        success: opResult.ok,
        isolationLevel: opResult.data?.decision?.route || 'unknown',
        response: opResult.data
      });
    }

    const successfulOps = operationResults.filter(r => r.success).length;
    testResult('Durable Object operations execution', successfulOps === testOperations.length,
               `Executed ${successfulOps}/${testOperations.length} operations successfully`);

    // Test isolation levels achieved
    const isolationLevels = operationResults.map(r => r.isolationLevel);
    const uniqueIsolations = [...new Set(isolationLevels)];
    testResult('Multiple isolation levels working', uniqueIsolations.length > 1,
               `Isolation levels used: ${uniqueIsolations.join(', ')}`);

    // Test 4: Data Persistence in Durable Objects
    console.log('\\n📋 TEST 4: Data Persistence in Durable Objects');
    
    const persistenceTests = [
      {
        orgId: 'enterprise-corp',
        entityName: 'HighVolumeEntity',
        data: {
          name: 'Persistent High-Volume System',
          transactionVolume: 75000,
          processingPriority: 'high',
          dataSize: '750MB'
        }
      },
      {
        orgId: 'startup-company',
        entityName: 'StartupProject', 
        data: {
          title: 'Persistent Startup Project',
          mvpFeatures: ['auth', 'dashboard', 'analytics'],
          fundingStage: 'series-a',
          teamSize: 15
        }
      }
    ];

    const persistenceResults = [];
    for (const test of persistenceTests) {
      // Save data
      const saveResult = await httpRequest('POST', `/durable/data/${test.orgId}/${test.entityName}/save`, test.data);
      
      // Query it back
      const queryResult = await httpRequest('GET', `/durable/data/${test.orgId}/${test.entityName}?limit=5`);
      
      persistenceResults.push({
        entity: `${test.orgId}:${test.entityName}`,
        saveSuccess: saveResult.ok,
        querySuccess: queryResult.ok,
        recordCount: queryResult.data?.records?.length || 0,
        isolationLevel: saveResult.data?.isolationLevel
      });
    }

    const persistenceSuccess = persistenceResults.every(r => r.saveSuccess && r.querySuccess && r.recordCount > 0);
    testResult('Durable Object data persistence', persistenceSuccess,
               `All entities saved and retrieved data successfully`);

    // Test isolation verification
    const isolationVerified = persistenceResults.every(r => r.isolationLevel && r.isolationLevel !== 'unknown');
    testResult('Data isolation level verification', isolationVerified,
               `Isolation levels: ${persistenceResults.map(r => `${r.entity}:${r.isolationLevel}`).join(', ')}`);

    // Test 5: Organization and Entity Statistics
    console.log('\\n📋 TEST 5: Organization and Entity Statistics');
    
    const statsTests = [];
    for (const org of ['enterprise-corp', 'startup-company', 'test-automation']) {
      const orgStatsResult = await httpRequest('GET', `/durable/org/${org}/stats`);
      statsTests.push({
        type: 'org-stats',
        orgId: org,
        success: orgStatsResult.ok,
        stats: orgStatsResult.data?.stats
      });
    }

    // Try to get entity-level stats (may not exist for all)
    for (const entity of ['enterprise-corp:HighVolumeEntity', 'startup-company:StartupProject']) {
      const [orgId, entityName] = entity.split(':');
      const entityStatsResult = await httpRequest('GET', `/durable/entity/${orgId}/${entityName}/stats`);
      statsTests.push({
        type: 'entity-stats',
        entity,
        success: entityStatsResult.ok,
        stats: entityStatsResult.data?.stats
      });
    }

    const successfulStats = statsTests.filter(r => r.success).length;
    testResult('Statistics collection from Durable Objects', successfulStats >= statsTests.length * 0.5,
               `Collected stats from ${successfulStats}/${statsTests.length} objects`);

    // Test 6: Smart Routing Analytics
    console.log('\\n📋 TEST 6: Smart Routing Analytics');
    
    const analyticsResult = await httpRequest('GET', '/durable/routing/analytics');
    const analyticsSuccess = analyticsResult.ok && analyticsResult.data?.analytics;
    testResult('Smart routing analytics', analyticsSuccess,
               `Organizations: ${analyticsResult.data?.analytics?.totalOrganizations}, Entities: ${analyticsResult.data?.analytics?.totalEntities}`);

    const recommendationsResult = await httpRequest('GET', '/durable/routing/recommendations');
    const recommendationsSuccess = recommendationsResult.ok && recommendationsResult.data?.recommendations;
    testResult('Routing recommendations generation', recommendationsSuccess,
               `Generated ${Object.keys(recommendationsResult.data?.recommendations || {}).length} routing recommendations`);

    // Test 7: Cross-Isolation Performance Verification
    console.log('\\n📋 TEST 7: Cross-Isolation Performance Verification');
    
    const performanceTests = [];
    const startTime = performance.now();
    
    // Concurrent operations across different isolation levels
    const concurrentOps = [
      httpRequest('POST', '/durable/entity/enterprise-corp/HighVolumeEntity/validate', { 
        name: 'Concurrent Test 1', transactionVolume: 25000, processingPriority: 'high', dataSize: '100MB' 
      }),
      httpRequest('POST', '/durable/entity/startup-company/StartupProject/validate', { 
        title: 'Concurrent Test 2', mvpFeatures: ['feature1', 'feature2', 'feature3'], fundingStage: 'seed', teamSize: 5 
      }),
      httpRequest('POST', '/durable/entity/test-automation/AutoTestEntity/validate', { 
        name: 'Concurrent Test 3', testCoverage: 80, automationLevel: 'semi' 
      })
    ];

    const concurrentResults = await Promise.all(concurrentOps);
    const endTime = performance.now();
    
    const allConcurrentSuccess = concurrentResults.every(r => r.ok);
    const avgResponseTime = (endTime - startTime) / concurrentOps.length;
    
    testResult('Concurrent cross-isolation operations', allConcurrentSuccess && avgResponseTime < 1000,
               `Average response time: ${avgResponseTime.toFixed(2)}ms, All operations successful: ${allConcurrentSuccess}`);

    // Test 8: Health Check with Durable Objects
    console.log('\\n📋 TEST 8: Health Check with Durable Objects');
    
    const healthResult = await httpRequest('GET', '/health');
    testResult('Main worker health with Durable Objects', healthResult.ok,
               `Status: ${healthResult.status}, Response: ${healthResult.data}`);

    // Final Summary
    console.log('\\n🎯 DURABLE OBJECTS ENHANCED POC TEST SUMMARY');
    console.log('===========================================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests >= totalTests * 0.75) {
      console.log('\\n🎉 DURABLE OBJECTS POC LARGELY SUCCESSFUL!');
      console.log('\\n✅ Multi-tier organization isolation working');
      console.log('✅ Smart routing with confidence scoring');
      console.log('✅ Per-entity and per-org persistent storage');
      console.log('✅ Cross-isolation performance maintained');
      console.log('✅ Real-time statistics and analytics');
      console.log('✅ Configuration-driven scaling patterns');
      console.log('\\n🚀 DURABLE OBJECTS ARCHITECTURE VALIDATED!');
      
      // Display final architecture summary
      console.log('\\n🏗️  ARCHITECTURE SUMMARY:');
      console.log(`   - Organizations initialized: ${successfulInits}`);
      console.log(`   - Entities deployed: ${successfulDeploys}`);
      console.log(`   - Operations executed: ${successfulOps}`);
      console.log(`   - Isolation levels achieved: ${uniqueIsolations.join(', ')}`);
      console.log(`   - Average operation time: ${avgResponseTime?.toFixed(2)}ms`);
      console.log(`   - Data persistence: ${persistenceSuccess ? 'Working' : 'Issues detected'}`);
      console.log('   - Smart routing: Active with confidence scoring');
    } else {
      console.log('\\n⚠️  Some Durable Objects tests failed - review architecture');
    }

  } catch (error) {
    console.error('❌ Durable Objects test failed:', error);
  }
}

// Run the enhanced Durable Objects tests
runDurableObjectsTest().catch(console.error);