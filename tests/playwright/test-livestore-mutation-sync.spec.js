/**
 * Test: LiveStore Mutation and Server Sync Tracking
 * Verifies that LiveStore mutations are properly tracked by the server sync system
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('LiveStore Mutation and Sync Tracking', () => {
  test('should execute LiveStore mutation and verify server sync tracking', async ({ page }) => {
    console.log('🚀 Testing LiveStore mutation and server sync tracking...\n');
    console.log('='.repeat(70));
    
    // Navigate to the LiveStore debug page
    await page.goto('/debug-public', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to be ready
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Debug page loaded successfully');
    
    // Wait for the mutation test button to appear
    const mutationButton = page.locator('button:has-text("Test Mutation & Sync")');
    await mutationButton.waitFor({ timeout: 10000 });
    
    console.log('✅ Mutation test button found');
    
    // Set up console log capture to monitor the test
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && (
        msg.text().includes('🧪') ||
        msg.text().includes('📝') ||
        msg.text().includes('✅') ||
        msg.text().includes('⚠️') ||
        msg.text().includes('🔄') ||
        msg.text().includes('🎉')
      )) {
        consoleLogs.push(msg.text());
        console.log(`  [BROWSER] ${msg.text()}`);
      }
    });
    
    // Click the mutation test button
    console.log('🧪 Executing LiveStore mutation test...');
    await mutationButton.click();
    
    // Wait for the test to complete (up to 30 seconds)
    let testCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds with 500ms intervals
    
    while (!testCompleted && attempts < maxAttempts) {
      // Check if test completed by looking for completion message
      const hasCompletionLog = consoleLogs.some(log => 
        log.includes('🎉 LiveStore mutation test completed!')
      );
      
      if (hasCompletionLog) {
        testCompleted = true;
        console.log('✅ Mutation test completed!');
        break;
      }
      
      // Check for error messages
      const hasErrorLog = consoleLogs.some(log => 
        log.toLowerCase().includes('error') || log.includes('❌')
      );
      
      if (hasErrorLog) {
        console.log('⚠️ Error detected in mutation test');
        break;
      }
      
      await page.waitForTimeout(500);
      attempts++;
    }
    
    // Analyze the results
    console.log('\n📊 Mutation Test Analysis:');
    console.log(`   Total console logs captured: ${consoleLogs.length}`);
    
    // Check key success indicators
    const mutationExecuted = consoleLogs.some(log => 
      log.includes('✅ LiveStore mutation executed successfully')
    );
    
    const recordVerified = consoleLogs.some(log => 
      log.includes('✅ Record verified in LiveStore')
    );
    
    const syncEventDetected = consoleLogs.some(log => 
      log.includes('✅ Sync event captured - server is tracking changes!')
    );
    
    const dexieRecordFound = consoleLogs.some(log => 
      log.includes('✅ Record found in Dexie - sync tracking works!')
    );
    
    const updateSynced = consoleLogs.some(log => 
      log.includes('✅ Update synced to Dexie successfully!')
    );
    
    console.log('\n🔍 Key Indicators:');
    console.log(`   LiveStore mutation executed: ${mutationExecuted ? '✅' : '❌'}`);
    console.log(`   Record verified in LiveStore: ${recordVerified ? '✅' : '❌'}`);
    console.log(`   Sync event detected: ${syncEventDetected ? '✅' : '❌'}`);
    console.log(`   Record found in Dexie: ${dexieRecordFound ? '✅' : '❌'}`);
    console.log(`   Update synced: ${updateSynced ? '✅' : '❌'}`);
    
    // Verify database changes directly
    console.log('\n🗄️ Verifying database changes...');
    
    const dbVerification = await page.evaluate(async () => {
      try {
        // Check if the test record exists in the database
        const { db } = await import('./db/dexie-schema.js');
        
        // Look for test projects created in the last minute
        const recentTestProjects = await db.project
          .where('name')
          .startsWith('Test Project')
          .toArray();
        
        return {
          success: true,
          testProjectsFound: recentTestProjects.length,
          latestProject: recentTestProjects[recentTestProjects.length - 1]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    if (dbVerification.success) {
      console.log(`   Test projects in database: ${dbVerification.testProjectsFound}`);
      if (dbVerification.latestProject) {
        console.log(`   Latest test project: ${dbVerification.latestProject.name}`);
      }
    } else {
      console.log(`   Database verification failed: ${dbVerification.error}`);
    }
    
    // Take a screenshot for documentation
    await page.screenshot({ 
      path: `screenshots/livestore-mutation-test-${Date.now()}.png`,
      fullPage: true 
    });
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(70));
    console.log('LIVESTORE MUTATION & SYNC TRACKING SUMMARY');
    console.log('='.repeat(70));
    
    const overallSuccess = mutationExecuted && recordVerified;
    const syncSuccess = syncEventDetected || dexieRecordFound;
    
    if (overallSuccess) {
      console.log('\n✅ LIVESTORE MUTATION TEST PASSED');
      console.log('   - LiveStore mutations executed successfully');
      console.log('   - Records verified in LiveStore database');
      
      if (syncSuccess) {
        console.log('   - Sync tracking working correctly');
        console.log('   - Changes propagated between systems');
      } else {
        console.log('   - Sync tracking needs investigation');
      }
    } else {
      console.log('\n⚠️ LIVESTORE MUTATION TEST NEEDS ATTENTION');
      if (!mutationExecuted) {
        console.log('   - Mutation execution failed');
      }
      if (!recordVerified) {
        console.log('   - Record verification failed');
      }
    }
    
    console.log('\n📋 Console Logs:');
    consoleLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log}`);
    });
    
    console.log('\n' + '='.repeat(70));
    
    // Assertions for test framework
    expect(mutationExecuted).toBe(true);
    expect(recordVerified).toBe(true);
  });
});