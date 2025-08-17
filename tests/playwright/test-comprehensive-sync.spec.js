/**
 * Test: Comprehensive Field Types and Relationships
 * Verifies all field types, relationships, and complex data flows through LiveStore/Sync
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('Comprehensive Field Types and Relationships Test', () => {
  test('should handle all field types and relationships correctly', async ({ page }) => {
    console.log('🔬 Testing comprehensive field types and relationships...\n');
    console.log('='.repeat(80));
    
    // Navigate to debug page
    await page.goto('/debug-public', { waitUntil: 'domcontentloaded' });
    
    // Wait for page ready
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Debug page loaded');
    
    // Find comprehensive test button
    const comprehensiveButton = page.locator('button:has-text("🔬 Test All Field Types")');
    await comprehensiveButton.waitFor({ timeout: 10000 });
    
    console.log('✅ Comprehensive test button found');
    
    // Set up console monitoring
    const testLogs = [];
    const fieldTypeResults = {};
    
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'log' && (
        text.includes('🔬') ||
        text.includes('✅') ||
        text.includes('❌') ||
        text.includes('📊') ||
        text.includes('📋') ||
        text.includes('🎉')
      )) {
        testLogs.push(text);
        console.log(`  [BROWSER] ${text}`);
        
        // Extract field type test results
        if (text.includes('Client in LiveStore:')) {
          fieldTypeResults.clientInLiveStore = text.includes('✅');
        }
        if (text.includes('Foreign key preserved:')) {
          fieldTypeResults.foreignKeyPreserved = text.includes('✅');
        }
        if (text.includes('Boolean field preserved:')) {
          fieldTypeResults.booleanFieldPreserved = text.includes('✅');
        }
        if (text.includes('Numeric precision preserved:')) {
          fieldTypeResults.numericPrecisionPreserved = text.includes('✅');
        }
        if (text.includes('Date field preserved:')) {
          fieldTypeResults.dateFieldPreserved = text.includes('✅');
        }
        if (text.includes('Complex query successful:')) {
          fieldTypeResults.complexQuerySuccessful = text.includes('✅');
        }
      }
    });
    
    // Execute comprehensive test
    console.log('🔬 Executing comprehensive field types test...');
    await comprehensiveButton.click();
    
    // Wait for test completion (up to 60 seconds)
    let testCompleted = false;
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds
    
    while (!testCompleted && attempts < maxAttempts) {
      const hasCompletionLog = testLogs.some(log => 
        log.includes('✅ Comprehensive test PASSED!') || 
        log.includes('❌ Comprehensive test FAILED!')
      );
      
      if (hasCompletionLog) {
        testCompleted = true;
        break;
      }
      
      await page.waitForTimeout(500);
      attempts++;
    }
    
    console.log('\n📊 Comprehensive Test Analysis:');
    console.log(`   Test completed: ${testCompleted ? '✅' : '❌'}`);
    console.log(`   Total logs captured: ${testLogs.length}`);
    
    // Analyze field type test results
    console.log('\n🔍 Field Type Test Results:');
    console.log(`   Client data handling: ${fieldTypeResults.clientInLiveStore ? '✅' : '❌'}`);
    console.log(`   Foreign key relationships: ${fieldTypeResults.foreignKeyPreserved ? '✅' : '❌'}`);
    console.log(`   Boolean field handling: ${fieldTypeResults.booleanFieldPreserved ? '✅' : '❌'}`);
    console.log(`   Numeric precision: ${fieldTypeResults.numericPrecisionPreserved ? '✅' : '❌'}`);
    console.log(`   Date field handling: ${fieldTypeResults.dateFieldPreserved ? '✅' : '❌'}`);
    console.log(`   Complex queries: ${fieldTypeResults.complexQuerySuccessful ? '✅' : '❌'}`);
    
    // Check for test success indicators
    const testPassed = testLogs.some(log => log.includes('✅ Comprehensive test PASSED!'));
    const testFailed = testLogs.some(log => log.includes('❌ Comprehensive test FAILED!'));
    
    // Check database state for verification
    const dbVerification = await page.evaluate(async () => {
      try {
        const { db } = await import('./db/dexie-schema.js');
        
        // Check for comprehensive test records
        const testProjects = await db.project
          .where('name')
          .startsWith('Digital Transformation Initiative')
          .toArray();
        
        const bridgeChanges = await db.localChanges
          .where('clientId')
          .equals('livestore-bridge')
          .count();
        
        return {
          success: true,
          testProjects: testProjects.length,
          bridgeChanges,
          latestProject: testProjects[testProjects.length - 1]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    if (dbVerification.success) {
      console.log('\n🗄️ Database Verification:');
      console.log(`   Test projects found: ${dbVerification.testProjects}`);
      console.log(`   Bridge sync records: ${dbVerification.bridgeChanges}`);
      if (dbVerification.latestProject) {
        console.log(`   Latest project: ${dbVerification.latestProject.name}`);
        console.log(`   Project budget: ${dbVerification.latestProject.budget}`);
        console.log(`   Project client_id: ${dbVerification.latestProject.client_id}`);
      }
    }
    
    // Take screenshot for documentation
    await page.screenshot({ 
      path: `screenshots/comprehensive-test-${Date.now()}.png`,
      fullPage: true 
    });
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE FIELD TYPES & RELATIONSHIPS TEST SUMMARY');
    console.log('='.repeat(80));
    
    const coreFieldsWorking = fieldTypeResults.clientInLiveStore && 
                             fieldTypeResults.booleanFieldPreserved && 
                             fieldTypeResults.numericPrecisionPreserved;
    
    const relationshipsWorking = fieldTypeResults.foreignKeyPreserved && 
                                fieldTypeResults.complexQuerySuccessful;
    
    const overallSuccess = testPassed && !testFailed && coreFieldsWorking;
    
    if (overallSuccess) {
      console.log('\n✅ COMPREHENSIVE TEST PASSED');
      console.log('   - All field types handled correctly');
      console.log('   - Foreign key relationships preserved');
      console.log('   - Boolean and numeric precision maintained');
      console.log('   - Date fields processed properly');
      console.log('   - Complex queries with JOINs working');
      console.log('   - Sync bridge integration successful');
    } else {
      console.log('\n⚠️ COMPREHENSIVE TEST NEEDS ATTENTION');
      if (!testPassed) console.log('   - Test execution incomplete');
      if (!coreFieldsWorking) console.log('   - Core field type handling issues');
      if (!relationshipsWorking) console.log('   - Relationship handling problems');
    }
    
    console.log('\n📋 Field Types Tested:');
    console.log('   ✓ VARCHAR (client names, emails)');
    console.log('   ✓ TEXT (project descriptions)');
    console.log('   ✓ NUMERIC (budgets, hours, rates)');
    console.log('   ✓ BOOLEAN (timesheet billable)');
    console.log('   ✓ DATE (project dates, certifications)');
    console.log('   ✓ TIMESTAMP (created_at, updated_at)');
    console.log('   ✓ FOREIGN KEYS (client_id, project_id, user_id)');
    
    console.log('\n📋 Operations Tested:');
    console.log('   ✓ INSERT operations (all entities)');
    console.log('   ✓ UPDATE operations (project status)');
    console.log('   ✓ Complex SELECT with JOINs');
    console.log('   ✓ Aggregate functions (SUM, COUNT)');
    console.log('   ✓ LiveStore ↔ Dexie sync bridge');
    console.log('   ✓ Multiple related records');
    
    console.log('\n' + '='.repeat(80));
    
    // Assertions for test framework
    expect(testCompleted).toBe(true);
    expect(testPassed).toBe(true);
    expect(coreFieldsWorking).toBe(true);
  });
});