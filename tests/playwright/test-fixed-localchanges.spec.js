/**
 * Test Fixed LocalChanges System
 * 
 * Verify that LocalChanges works with corrected DataForge imports
 */

import { test, expect } from '@playwright/test';

test('Fixed LocalChanges system test', async ({ page }) => {
  console.log('🔧 Testing fixed LocalChanges system...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('LocalChanges') || 
        text.includes('local_changes') ||
        text.includes('sync') ||
        text.includes('Wide Corp')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Quick auth setup
  console.log('🔐 Authentication setup...');
  await page.goto('http://localhost:5173/sign-in');
  
  await page.evaluate(() => {
    localStorage.removeItem('vibestack-last-organization-id');
    localStorage.removeItem('auth-machine-state');
  });
  
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  // Wait for org selection
  let orgSelected = false;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const hasOrgSelection = await page.locator('text=Wide Corp Solutions').isVisible().catch(() => false);
    if (hasOrgSelection) {
      await page.locator('text=Wide Corp Solutions').click();
      orgSelected = true;
      break;
    }
  }
  
  if (orgSelected) {
    console.log('✅ Organization selected');
    await page.waitForTimeout(3000);
  }
  
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  // Test the fixed LocalChanges system
  console.log('🧪 Testing fixed LocalChanges...');
  
  const localChangesTest = await page.evaluate(async () => {
    const results = {
      timestamp: Date.now(),
      tests: {}
    };
    
    try {
      // Test 1: Check if db.local_changes is available
      console.log('[BROWSER] Testing db.local_changes availability...');
      if (window.db && window.db.local_changes) {
        const initialCount = await window.db.local_changes.count();
        console.log(`[BROWSER] ✅ db.local_changes available with ${initialCount} records`);
        
        results.tests.availability = {
          success: true,
          initialCount
        };
      } else {
        console.log('[BROWSER] ❌ db.local_changes not available');
        results.tests.availability = {
          success: false,
          reason: 'db.local_changes not found'
        };
        return results;
      }
      
      // Test 2: Try creating a LocalChanges record directly
      console.log('[BROWSER] Testing direct LocalChanges creation...');
      
      const testTimestamp = Date.now();
      const testRecord = {
        id: `fixed_test_${testTimestamp}`,
        table: 'clients',
        operation: 'insert',
        data: {
          id: `test_client_${testTimestamp}`,
          name: `Fixed Test Client ${testTimestamp}`,
          email: `fixed.test.${testTimestamp}@test.com`
        },
        lsn: '',
        clientSequence: `fixed-${testTimestamp}-${Math.random().toString(36).substring(2, 9)}`,
        clientId: 'fixed-test-client',
        updatedAt: new Date(),
        processedSync: 0
      };
      
      try {
        await window.db.local_changes.add(testRecord);
        console.log('[BROWSER] ✅ Successfully created LocalChanges record directly');
        
        // Verify it was created
        const createdRecord = await window.db.local_changes.get(testRecord.id);
        if (createdRecord) {
          console.log('[BROWSER] ✅ LocalChanges record verified in database');
          results.tests.directCreation = {
            success: true,
            recordId: testRecord.id,
            verified: true
          };
        } else {
          results.tests.directCreation = {
            success: false,
            reason: 'Record not found after creation'
          };
        }
      } catch (error) {
        console.log('[BROWSER] ❌ Failed to create LocalChanges record:', error.message);
        results.tests.directCreation = {
          success: false,
          error: error.message
        };
      }
      
      // Test 3: Check if we can query LocalChanges
      console.log('[BROWSER] Testing LocalChanges query...');
      
      try {
        const allChanges = await window.db.local_changes.toArray();
        const pendingChanges = await window.db.local_changes
          .where('processedSync')
          .equals(0)
          .toArray();
          
        console.log(`[BROWSER] ✅ Found ${allChanges.length} total, ${pendingChanges.length} pending LocalChanges`);
        
        results.tests.query = {
          success: true,
          totalCount: allChanges.length,
          pendingCount: pendingChanges.length
        };
      } catch (error) {
        console.log('[BROWSER] ❌ Failed to query LocalChanges:', error.message);
        results.tests.query = {
          success: false,
          error: error.message
        };
      }
      
      // Test 4: Test if LocalChanges helper functions work
      console.log('[BROWSER] Testing LocalChanges helper functions...');
      
      const helperTests = {};
      
      // Test getAllChanges if available
      if (window.getAllChanges) {
        try {
          const changes = await window.getAllChanges();
          console.log(`[BROWSER] ✅ getAllChanges() returned ${changes.length} records`);
          helperTests.getAllChanges = { success: true, count: changes.length };
        } catch (error) {
          console.log('[BROWSER] ❌ getAllChanges() failed:', error.message);
          helperTests.getAllChanges = { success: false, error: error.message };
        }
      } else {
        console.log('[BROWSER] ⚠️ getAllChanges() not available');
        helperTests.getAllChanges = { success: false, reason: 'function not available' };
      }
      
      // Test getPendingChanges if available
      if (window.getPendingChanges) {
        try {
          const pending = await window.getPendingChanges();
          console.log(`[BROWSER] ✅ getPendingChanges() returned ${pending.length} records`);
          helperTests.getPendingChanges = { success: true, count: pending.length };
        } catch (error) {
          console.log('[BROWSER] ❌ getPendingChanges() failed:', error.message);
          helperTests.getPendingChanges = { success: false, error: error.message };
        }
      } else {
        console.log('[BROWSER] ⚠️ getPendingChanges() not available');
        helperTests.getPendingChanges = { success: false, reason: 'function not available' };
      }
      
      results.tests.helperFunctions = helperTests;
      
      // Test 5: Final count verification
      const finalCount = await window.db.local_changes.count();
      console.log(`[BROWSER] Final LocalChanges count: ${finalCount}`);
      
      results.tests.finalCount = finalCount;
      
      console.log('[BROWSER] Fixed LocalChanges test complete');
      return results;
      
    } catch (error) {
      console.log('[BROWSER] LocalChanges test error:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  await page.screenshot({ path: 'fixed-localchanges-test.png' });
  
  // Analyze results
  console.log('\n=== FIXED LOCALCHANGES ANALYSIS ===');
  
  const tests = localChangesTest.tests || {};
  
  console.log(`🗄️ Database Availability: ${tests.availability?.success ? '✅' : '❌'}`);
  if (tests.availability?.success) {
    console.log(`   Initial count: ${tests.availability.initialCount}`);
  }
  
  console.log(`📝 Direct Creation: ${tests.directCreation?.success ? '✅' : '❌'}`);
  if (tests.directCreation?.success) {
    console.log(`   Record ID: ${tests.directCreation.recordId}`);
    console.log(`   Verified: ${tests.directCreation.verified ? '✅' : '❌'}`);
  } else if (tests.directCreation?.error) {
    console.log(`   Error: ${tests.directCreation.error}`);
  }
  
  console.log(`🔍 Query Operations: ${tests.query?.success ? '✅' : '❌'}`);
  if (tests.query?.success) {
    console.log(`   Total records: ${tests.query.totalCount}`);
    console.log(`   Pending records: ${tests.query.pendingCount}`);
  }
  
  console.log('\n🔧 Helper Functions:');
  const helpers = tests.helperFunctions || {};
  Object.entries(helpers).forEach(([name, result]) => {
    console.log(`   ${name}: ${result.success ? '✅' : '❌'}`);
    if (result.success && result.count !== undefined) {
      console.log(`      Records: ${result.count}`);
    } else if (!result.success && result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  console.log(`\n📊 Final Count: ${tests.finalCount || 'unknown'}`);
  
  console.log('\n=== NEXT STEPS ===');
  
  const systemWorking = tests.availability?.success && tests.directCreation?.success && tests.query?.success;
  
  if (systemWorking) {
    console.log('🎉 SUCCESS: Fixed LocalChanges system is working!');
    console.log('   ✅ Database access restored');
    console.log('   ✅ Can create and query LocalChanges');
    console.log('   🔧 Ready to test sync bridge functionality');
  } else {
    console.log('❌ ISSUES: LocalChanges system still has problems');
    if (!tests.availability?.success) {
      console.log('   🔧 Fix database import/initialization');
    }
    if (!tests.directCreation?.success) {
      console.log('   🔧 Fix LocalChanges record creation');
    }
    if (!tests.query?.success) {
      console.log('   🔧 Fix LocalChanges query operations');
    }
  }
  
  console.log('======================================');
  
  // Test passes if core functionality works
  expect(tests.availability?.success).toBe(true);
  expect(tests.directCreation?.success).toBe(true);
});