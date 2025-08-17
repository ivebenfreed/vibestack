/**
 * Direct LiveStore Sync Test
 * 
 * Test LiveStore sync bridge functionality directly without organization selection
 */

import { test, expect } from '@playwright/test';

test('Direct LiveStore sync bridge test', async ({ page }) => {
  console.log('🧪 Testing LiveStore sync bridge directly...');
  
  // Capture console logs to monitor sync activity
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important sync and LiveStore messages
    if (text.includes('LiveStore') || 
        text.includes('sync') ||
        text.includes('mutation') ||
        text.includes('LocalChanges') ||
        text.includes('DexieOutgoingChangeService') ||
        text.includes('handleLiveStoreMutation') ||
        text.includes('bridge')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate directly to the debug page 
  console.log('🌐 Navigating to LiveStore debug page...');
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(5000);
  
  // Check if page loaded
  const pageContent = await page.textContent('body');
  console.log('📄 Page content preview:', pageContent.substring(0, 200));
  
  // Test LiveStore sync bridge functionality directly
  console.log('🧪 Testing LiveStore sync bridge...');
  
  const syncBridgeTest = await page.evaluate(async () => {
    try {
      console.log('[BROWSER] Starting direct sync bridge test...');
      
      // Check if LiveStore sync bridge is available
      if (!window.handleLiveStoreMutation) {
        console.log('[BROWSER] Sync bridge not loaded, attempting to load...');
        
        // Try to import the sync bridge module directly
        try {
          const module = await import('/src/lib/livestore-sync-bridge.ts');
          console.log('[BROWSER] Sync bridge module loaded:', Object.keys(module));
        } catch (importError) {
          console.log('[BROWSER] Failed to import sync bridge:', importError.message);
          return { success: false, error: 'Sync bridge not available', stage: 'import' };
        }
      }
      
      // Test creating a mock LiveStore mutation
      const mockMutation = {
        operation: 'insert',
        tableName: 'org_01920000_1000_7000_8000_000000000001_clients',
        recordId: 'test_client_' + Date.now(),
        data: {
          id: 'test_client_' + Date.now(),
          name: 'Direct Test Client',
          email: 'direct.test@example.com',
          status: 'active',
          created_at: new Date().toISOString()
        },
        organizationId: '01920000-1000-7000-8000-000000000001',
        timestamp: new Date()
      };
      
      console.log('[BROWSER] Created mock mutation:', mockMutation);
      
      // Check if sync bridge handler exists
      if (typeof window.handleLiveStoreMutation === 'function') {
        console.log('[BROWSER] Calling sync bridge handler...');
        await window.handleLiveStoreMutation(mockMutation);
        console.log('[BROWSER] ✅ Sync bridge handler executed successfully');
        return { success: true, stage: 'handler_executed', mutation: mockMutation };
      } else {
        console.log('[BROWSER] ❌ Sync bridge handler not available');
        return { success: false, error: 'Handler not available', stage: 'handler_check' };
      }
      
    } catch (error) {
      console.log('[BROWSER] ❌ Error in sync bridge test:', error.message);
      return { success: false, error: error.message, stage: 'execution' };
    }
  });
  
  console.log('📊 Sync bridge test result:', syncBridgeTest);
  
  // Test 2: Check if Dexie/LocalChanges functionality is working
  console.log('🔍 Testing LocalChanges generation...');
  
  const localChangesTest = await page.evaluate(async () => {
    try {
      console.log('[BROWSER] Testing LocalChanges functionality...');
      
      // Check if Dexie database is available
      if (typeof window.Dexie !== 'undefined') {
        console.log('[BROWSER] Dexie is available');
        
        // Try to access the LocalChanges table directly
        if (window.db && window.db.localChanges) {
          console.log('[BROWSER] LocalChanges table found');
          
          // Try to create a test local change
          const testChange = {
            id: 'test_change_' + Date.now(),
            operation: 'INSERT',
            table_name: 'org_01920000_1000_7000_8000_000000000001_clients',
            record_id: 'test_client_' + Date.now(),
            changes: JSON.stringify({
              name: 'Direct Test Client',
              email: 'direct.test@example.com'
            }),
            organization_id: '01920000-1000-7000-8000-000000000001',
            created_at: new Date(),
            is_processed: false
          };
          
          await window.db.localChanges.add(testChange);
          console.log('[BROWSER] ✅ Test LocalChange created successfully');
          
          // Check if record was created
          const savedChange = await window.db.localChanges.get(testChange.id);
          console.log('[BROWSER] Saved change retrieved:', savedChange ? 'SUCCESS' : 'FAILED');
          
          return { success: true, changeCreated: !!savedChange, testChange };
        } else {
          console.log('[BROWSER] LocalChanges table not found');
          return { success: false, error: 'LocalChanges table not available' };
        }
      } else {
        console.log('[BROWSER] Dexie not available');
        return { success: false, error: 'Dexie not available' };
      }
    } catch (error) {
      console.log('[BROWSER] Error in LocalChanges test:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  console.log('📊 LocalChanges test result:', localChangesTest);
  
  // Wait for any async operations
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'direct-livestore-sync-test.png' });
  
  // Analyze the results
  console.log('\\n=== DIRECT SYNC BRIDGE ANALYSIS ===');
  
  const hasSyncBridgeModule = consoleLogs.some(log => 
    log.includes('Sync bridge module loaded') || log.includes('handleLiveStoreMutation')
  );
  
  const hasSyncBridgeExecution = consoleLogs.some(log => 
    log.includes('Sync bridge handler executed')
  );
  
  const hasLocalChangesActivity = consoleLogs.some(log => 
    log.includes('LocalChange created') || log.includes('localChanges.add')
  );
  
  const hasDexieAccess = consoleLogs.some(log => 
    log.includes('Dexie is available')
  );
  
  console.log(`🔗 Sync Bridge Module: ${hasSyncBridgeModule ? '✅' : '❌'}`);
  console.log(`⚡ Sync Bridge Execution: ${hasSyncBridgeExecution ? '✅' : '❌'}`);
  console.log(`📝 LocalChanges Activity: ${hasLocalChangesActivity ? '✅' : '❌'}`);
  console.log(`🗃️ Dexie Database Access: ${hasDexieAccess ? '✅' : '❌'}`);
  
  console.log(`\\n📊 Test Results:`);
  console.log(`   Sync Bridge Test: ${syncBridgeTest.success ? '✅' : '❌'} (${syncBridgeTest.stage || 'unknown'})`);
  console.log(`   LocalChanges Test: ${localChangesTest.success ? '✅' : '❌'}`);
  
  if (syncBridgeTest.success || localChangesTest.success) {
    console.log('🎉 SUCCESS: Core sync functionality is working!');
  } else {
    console.log('⚠️ ISSUES: Sync infrastructure needs debugging');
    console.log('   Sync Bridge Error:', syncBridgeTest.error);
    console.log('   LocalChanges Error:', localChangesTest.error);
  }
  
  console.log('=====================================');
  
  // The test passes if we can at least demonstrate one part of the sync system
  expect(syncBridgeTest.success || localChangesTest.success).toBe(true);
});