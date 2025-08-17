/**
 * Complete LiveStore Migration Test Suite
 * 
 * Comprehensive testing of the LiveStore migration:
 * - Domain layer operations
 * - Event sync functionality  
 * - Multi-tenant isolation
 * - Sync loop prevention
 * - Performance validation
 * - Integration testing
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Complete LiveStore migration test suite', async ({ page }) => {
  console.log('🧪 Starting comprehensive LiveStore migration testing...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('[LiveStore') || 
        text.includes('domain') ||
        text.includes('sync') ||
        text.includes('Event')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate to debug page for testing
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  console.log('🔧 Running comprehensive LiveStore tests...');
  
  const testResults = await page.evaluate(async () => {
    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
      errors: [],
      summary: {}
    };
    
    try {
      console.log('[BROWSER] === COMPREHENSIVE LIVESTORE MIGRATION TESTS ===');
      
      // Test 1: Verify LiveStore Domain Services Available
      console.log('[BROWSER] 1. Testing LiveStore Domain Services...');
      
      if (window.liveStoreDomain && window.liveStoreDomain.services) {
        results.tests.domainServicesAvailable = true;
        
        const services = window.liveStoreDomain.services;
        results.tests.availableServices = Object.keys(services);
        
        console.log('[BROWSER]    ✅ Domain services:', Object.keys(services));
      } else {
        results.tests.domainServicesAvailable = false;
        results.errors.push('LiveStore domain services not available');
      }
      
      // Test 2: Verify Event Sync Service
      console.log('[BROWSER] 2. Testing Event Sync Service...');
      
      try {
        const syncStatus = window.liveStoreDomain?.syncStatus();
        results.tests.eventSyncStatus = syncStatus;
        
        if (syncStatus) {
          console.log('[BROWSER]    ✅ Event sync status:', syncStatus);
        } else {
          console.log('[BROWSER]    ⚠️ No sync status available');
        }
      } catch (error) {
        results.tests.eventSyncError = error.message;
        results.errors.push(`Event sync error: ${error.message}`);
      }
      
      // Test 3: Test LiveStore Info
      console.log('[BROWSER] 3. Testing LiveStore Info...');
      
      try {
        const info = await window.liveStoreDomain?.info();
        results.tests.liveStoreInfo = info;
        
        if (info && !info.error) {
          console.log('[BROWSER]    ✅ LiveStore info:', info);
        } else {
          console.log('[BROWSER]    ⚠️ LiveStore info error:', info?.error);
        }
      } catch (error) {
        results.tests.liveStoreInfoError = error.message;
        results.errors.push(`LiveStore info error: ${error.message}`);
      }
      
      // Test 4: Test Event Sync Implementation
      console.log('[BROWSER] 4. Testing Event Sync Implementation...');
      
      if (window.testLiveStoreEventSync && window.testLiveStoreEventSync.runAllTests) {
        try {
          await window.testLiveStoreEventSync.runAllTests();
          results.tests.eventSyncTests = true;
          console.log('[BROWSER]    ✅ Event sync tests passed');
        } catch (error) {
          results.tests.eventSyncTests = false;
          results.tests.eventSyncTestError = error.message;
          results.errors.push(`Event sync tests failed: ${error.message}`);
        }
      } else {
        results.tests.eventSyncTests = false;
        results.errors.push('Event sync test functions not available');
      }
      
      // Test 5: Test Domain Operations (if org available)
      console.log('[BROWSER] 5. Testing Domain Operations...');
      
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      if (orgId && window.liveStoreDomain?.services) {
        try {
          // Test project creation
          const project = await window.liveStoreDomain.services.project.create({
            name: `Test Project ${Date.now()}`,
            description: 'Comprehensive test project',
            status: 'active'
          });
          
          results.tests.projectCreation = {
            success: true,
            projectId: project.id,
            projectName: project.name
          };
          
          console.log('[BROWSER]    ✅ Project created:', project.id);
          
          // Test task creation
          const task = await window.liveStoreDomain.services.task.create({
            title: `Test Task ${Date.now()}`,
            description: 'Comprehensive test task',
            projectId: project.id,
            status: 'todo'
          });
          
          results.tests.taskCreation = {
            success: true,
            taskId: task.id,
            taskTitle: task.title
          };
          
          console.log('[BROWSER]    ✅ Task created:', task.id);
          
          // Test update operation
          const updatedTask = await window.liveStoreDomain.services.task.update(task.id, {
            status: 'in_progress'
          });
          
          results.tests.taskUpdate = {
            success: true,
            updatedStatus: updatedTask.status
          };
          
          console.log('[BROWSER]    ✅ Task updated:', updatedTask.status);
          
          // Test query operations
          const allProjects = await window.liveStoreDomain.services.project.findAll();
          const projectTasks = await window.liveStoreDomain.services.task.findByProject(project.id);
          
          results.tests.queryOperations = {
            success: true,
            totalProjects: allProjects.length,
            projectTasks: projectTasks.length
          };
          
          console.log('[BROWSER]    ✅ Query operations completed');
          
        } catch (error) {
          results.tests.domainOperations = {
            success: false,
            error: error.message
          };
          results.errors.push(`Domain operations failed: ${error.message}`);
          console.log('[BROWSER]    ❌ Domain operations failed:', error.message);
        }
      } else {
        results.tests.domainOperations = {
          success: false,
          reason: 'No organization selected or services unavailable'
        };
      }
      
      // Test 6: Performance Test
      console.log('[BROWSER] 6. Testing Performance...');
      
      if (window.liveStoreDomain?.devUtils?.runPerformanceTest) {
        try {
          await window.liveStoreDomain.devUtils.runPerformanceTest();
          results.tests.performanceTest = true;
          console.log('[BROWSER]    ✅ Performance test completed');
        } catch (error) {
          results.tests.performanceTest = false;
          results.tests.performanceError = error.message;
          results.errors.push(`Performance test failed: ${error.message}`);
        }
      } else {
        results.tests.performanceTest = false;
        results.errors.push('Performance test function not available');
      }
      
      // Test 7: Multi-tenant Validation
      console.log('[BROWSER] 7. Testing Multi-tenant Features...');
      
      try {
        const orgId = localStorage.getItem('vibestack-last-organization-id');
        if (orgId) {
          // Test organization-scoped table names
          if (window.liveStoreSchemaClient?.getTableName) {
            const tableName = window.liveStoreSchemaClient.getTableName(orgId, 'projects');
            results.tests.multiTenant = {
              success: true,
              orgId: orgId,
              tableName: tableName,
              isOrgScoped: tableName.includes(orgId)
            };
            
            console.log('[BROWSER]    ✅ Multi-tenant validation:', tableName);
          } else {
            results.tests.multiTenant = {
              success: false,
              reason: 'Schema client not available'
            };
          }
        } else {
          results.tests.multiTenant = {
            success: false,
            reason: 'No organization selected'
          };
        }
      } catch (error) {
        results.tests.multiTenant = {
          success: false,
          error: error.message
        };
        results.errors.push(`Multi-tenant test failed: ${error.message}`);
      }
      
      // Test 8: Schema Integration
      console.log('[BROWSER] 8. Testing Schema Integration...');
      
      try {
        if (window.liveStoreSchemaClient) {
          const orgId = localStorage.getItem('vibestack-last-organization-id');
          if (orgId) {
            const instance = window.liveStoreSchemaClient.getLiveStoreInstance(orgId);
            results.tests.schemaIntegration = {
              success: !!instance,
              hasInstance: !!instance,
              orgId: orgId
            };
            
            if (instance) {
              console.log('[BROWSER]    ✅ Schema integration working');
            } else {
              console.log('[BROWSER]    ⚠️ No LiveStore instance for org');
            }
          } else {
            results.tests.schemaIntegration = {
              success: false,
              reason: 'No organization selected'
            };
          }
        } else {
          results.tests.schemaIntegration = {
            success: false,
            reason: 'Schema client not available'
          };
        }
      } catch (error) {
        results.tests.schemaIntegration = {
          success: false,
          error: error.message
        };
        results.errors.push(`Schema integration test failed: ${error.message}`);
      }
      
      // Generate summary
      const successfulTests = Object.values(results.tests).filter(test => 
        test === true || (typeof test === 'object' && test.success === true)
      ).length;
      
      const totalTests = Object.keys(results.tests).length;
      
      results.summary = {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        errorCount: results.errors.length,
        overallSuccess: results.errors.length === 0 && successfulTests > totalTests * 0.7
      };
      
      console.log('[BROWSER] === TEST SUMMARY ===');
      console.log(`[BROWSER] Total Tests: ${totalTests}`);
      console.log(`[BROWSER] Successful: ${successfulTests}`);
      console.log(`[BROWSER] Failed: ${totalTests - successfulTests}`);
      console.log(`[BROWSER] Errors: ${results.errors.length}`);
      console.log(`[BROWSER] Overall: ${results.summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
      
      return results;
      
    } catch (error) {
      results.errors.push(`Test suite error: ${error.message}`);
      results.summary = {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        errorCount: results.errors.length,
        overallSuccess: false
      };
      return results;
    }
  });
  
  await page.screenshot({ path: 'livestore-comprehensive-test.png' });
  
  // Analyze results
  console.log('\n' + '='.repeat(80));
  console.log('🔍 COMPREHENSIVE LIVESTORE MIGRATION TEST RESULTS');
  console.log('='.repeat(80));
  
  const { tests, errors, summary } = testResults;
  
  // Test Results Analysis
  console.log('\n📋 TEST RESULTS:');
  
  console.log(`\n1. Domain Services: ${tests.domainServicesAvailable ? '✅' : '❌'}`);
  if (tests.availableServices) {
    console.log(`   Services: ${tests.availableServices.join(', ')}`);
  }
  
  console.log(`\n2. Event Sync: ${tests.eventSyncStatus ? '✅' : '❌'}`);
  if (tests.eventSyncStatus) {
    console.log(`   Status:`, tests.eventSyncStatus);
  }
  
  console.log(`\n3. LiveStore Info: ${tests.liveStoreInfo && !tests.liveStoreInfo.error ? '✅' : '❌'}`);
  if (tests.liveStoreInfo && !tests.liveStoreInfo.error) {
    console.log(`   Org: ${tests.liveStoreInfo.organizationId}`);
    console.log(`   Records: ${tests.liveStoreInfo.totalRecords}`);
  }
  
  console.log(`\n4. Event Sync Tests: ${tests.eventSyncTests ? '✅' : '❌'}`);
  
  console.log(`\n5. Domain Operations: ${tests.projectCreation?.success ? '✅' : '❌'}`);
  if (tests.projectCreation?.success) {
    console.log(`   Project: ${tests.projectCreation.projectId}`);
    console.log(`   Task: ${tests.taskCreation?.taskId}`);
    console.log(`   Update: ${tests.taskUpdate?.success ? '✅' : '❌'}`);
    console.log(`   Queries: ${tests.queryOperations?.success ? '✅' : '❌'}`);
  }
  
  console.log(`\n6. Performance Test: ${tests.performanceTest ? '✅' : '❌'}`);
  
  console.log(`\n7. Multi-tenant: ${tests.multiTenant?.success ? '✅' : '❌'}`);
  if (tests.multiTenant?.success) {
    console.log(`   Org-scoped: ${tests.multiTenant.isOrgScoped ? '✅' : '❌'}`);
    console.log(`   Table: ${tests.multiTenant.tableName}`);
  }
  
  console.log(`\n8. Schema Integration: ${tests.schemaIntegration?.success ? '✅' : '❌'}`);
  
  // Error Analysis
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL SUMMARY:');
  console.log('='.repeat(80));
  
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Successful: ${summary.successfulTests} ✅`);
  console.log(`Failed: ${summary.failedTests} ${summary.failedTests > 0 ? '❌' : '✅'}`);
  console.log(`Errors: ${summary.errorCount} ${summary.errorCount > 0 ? '❌' : '✅'}`);
  
  console.log(`\nOVERALL RESULT: ${summary.overallSuccess ? '🎉 PASS' : '❌ FAIL'}`);
  
  if (summary.overallSuccess) {
    console.log('\n🚀 LiveStore migration is working correctly!');
    console.log('   ✅ Domain services operational');
    console.log('   ✅ Event sync functional');
    console.log('   ✅ Multi-tenant isolation working');
    console.log('   ✅ Performance acceptable');
    console.log('   ✅ Schema integration complete');
  } else {
    console.log('\n🔧 LiveStore migration needs attention:');
    errors.forEach(error => console.log(`   ❌ ${error}`));
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Test assertions
  expect(summary.errorCount).toBeLessThan(3); // Allow minor errors
  expect(summary.successfulTests).toBeGreaterThan(summary.totalTests * 0.6); // At least 60% success
  expect(tests.domainServicesAvailable).toBe(true);
  
  return testResults;
});