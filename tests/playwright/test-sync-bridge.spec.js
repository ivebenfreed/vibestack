/**
 * Test: LiveStore to Sync Protocol Bridge
 * Verifies that LiveStore mutations trigger the existing sync protocol
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('LiveStore to Sync Protocol Bridge', () => {
  test('should bridge LiveStore mutations to sync protocol', async ({ page }) => {
    console.log('🌉 Testing LiveStore to Sync Protocol Bridge...\n');
    console.log('='.repeat(70));
    
    // Navigate to the debug page
    await page.goto('/debug-public', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to be ready
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Debug page loaded');
    
    // Find and click the sync bridge test button
    const bridgeButton = page.locator('button:has-text("🌉 Test Sync Bridge")');
    await bridgeButton.waitFor({ timeout: 10000 });
    
    console.log('✅ Bridge test button found');
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && (
        msg.text().includes('🌉') ||
        msg.text().includes('✅') ||
        msg.text().includes('📊') ||
        msg.text().includes('🧪') ||
        msg.text().includes('📝') ||
        msg.text().includes('🔄') ||
        msg.text().includes('🎉')
      )) {
        consoleLogs.push(msg.text());
        console.log(`  [BROWSER] ${msg.text()}`);
      }
    });
    
    // Click the bridge test button
    console.log('🌉 Executing sync bridge test...');
    await bridgeButton.click();
    
    // Wait for test completion
    let testCompleted = false;
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds with 500ms intervals
    
    while (!testCompleted && attempts < maxAttempts) {
      const hasCompletionLog = consoleLogs.some(log => 
        log.includes('🎉 Sync bridge test completed!')
      );
      
      if (hasCompletionLog) {
        testCompleted = true;
        console.log('✅ Bridge test completed!');
        break;
      }
      
      await page.waitForTimeout(500);
      attempts++;
    }
    
    // Analyze results
    console.log('\n📊 Bridge Test Analysis:');
    console.log(`   Console logs captured: ${consoleLogs.length}`);
    
    const bridgeInitialized = consoleLogs.some(log => 
      log.includes('✅ Bridge initialized')
    );
    
    const mutationExecuted = consoleLogs.some(log => 
      log.includes('✅ Test mutation executed')
    );
    
    const localChangesCreated = consoleLogs.some(log => 
      log.includes('📝 Found') && log.includes('LocalChanges records')
    );
    
    const bridgeEventCaptured = consoleLogs.some(log => 
      log.includes('✅ Bridge event captured')
    );
    
    console.log('\n🔍 Key Indicators:');
    console.log(`   Bridge initialized: ${bridgeInitialized ? '✅' : '❌'}`);
    console.log(`   Mutation executed: ${mutationExecuted ? '✅' : '❌'}`);
    console.log(`   LocalChanges created: ${localChangesCreated ? '✅' : '❌'}`);
    console.log(`   Bridge event captured: ${bridgeEventCaptured ? '✅' : '❌'}`);
    
    // Check database state
    const dbCheck = await page.evaluate(async () => {
      try {
        const { db } = await import('./db/dexie-schema.js');
        
        // Count bridge-generated LocalChanges
        const bridgeChanges = await db.localChanges
          .where('clientId')
          .equals('livestore-bridge')
          .count();
        
        // Count test projects
        const testProjects = await db.project
          .where('name')
          .startsWith('Bridge Test Project')
          .count();
        
        return {
          success: true,
          bridgeChanges,
          testProjects
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    if (dbCheck.success) {
      console.log(`   Bridge LocalChanges records: ${dbCheck.bridgeChanges}`);
      console.log(`   Test projects created: ${dbCheck.testProjects}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/sync-bridge-test-${Date.now()}.png`,
      fullPage: true 
    });
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(70));
    console.log('SYNC BRIDGE TEST SUMMARY');
    console.log('='.repeat(70));
    
    const bridgeWorking = bridgeInitialized && mutationExecuted && localChangesCreated;
    
    if (bridgeWorking) {
      console.log('\n✅ SYNC BRIDGE TEST PASSED');
      console.log('   - Bridge initialized successfully');
      console.log('   - LiveStore mutations executed');
      console.log('   - LocalChanges records created');
      console.log('   - Sync protocol integration working');
    } else {
      console.log('\n⚠️ SYNC BRIDGE TEST NEEDS ATTENTION');
      if (!bridgeInitialized) console.log('   - Bridge initialization failed');
      if (!mutationExecuted) console.log('   - Mutation execution failed');
      if (!localChangesCreated) console.log('   - LocalChanges creation failed');
    }
    
    console.log('\n📋 All Console Logs:');
    consoleLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log}`);
    });
    
    console.log('\n' + '='.repeat(70));
    
    // Assertions
    expect(bridgeInitialized).toBe(true);
    expect(mutationExecuted).toBe(true);
    expect(localChangesCreated).toBe(true);
  });
});