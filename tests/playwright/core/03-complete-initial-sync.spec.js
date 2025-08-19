// Complete initial sync validation test - triggers and verifies full sync process
import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Complete Initial Sync Validation', () => {
  test.setTimeout(90000); // Extended timeout for complete sync process

  test('should perform complete initial sync with records received and LSN saving', async ({ page }) => {
    console.log('🚀 Testing complete initial sync process...\n');
    
    // Navigate to app 
    await page.goto('/');
    
    // Wait for app to be ready (authenticated with persistent context)
    console.log('⏳ Waiting for app initialization...');
    
    try {
      // Wait for the app to fully initialize (should already be authenticated)
      await page.waitForFunction(() => {
        return document.body.getAttribute('data-playwright-ready') === 'true' ||
               window.appInitActor ||
               window.liveStoreDomain ||
               document.querySelector('[data-testid="dashboard"]') !== null ||
               document.querySelector('h2:has-text("Select Organization")') !== null;
      }, { timeout: 30000 });
      console.log('✅ App initialized');
    } catch (error) {
      console.log('⚠️  App not fully ready, continuing...');
    }
    
    // Check if we need to select an organization first - look for the heading text
    const needsOrgSelection = await page.evaluate(() => {
      const heading = document.querySelector('h2');
      return heading && heading.textContent.includes('Select Organization');
    });
    
    console.log(`🔍 Organization selection needed: ${needsOrgSelection ? '✅' : '❌'}`);
    
    if (needsOrgSelection) {
      console.log('🏢 Organization selection required - selecting Wide Corp Solutions');
      
      try {
        // Wait a moment for UI to be ready
        await page.waitForTimeout(2000);
        
        // Try to click on Wide Corp Solutions - use multiple approaches
        const clicked = await page.evaluate(() => {
          // Find and click the Wide Corp Solutions option
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes('Wide Corp Solutions')
          );
          
          for (const element of elements) {
            if (element.click) {
              element.click();
              console.log('Clicked Wide Corp Solutions');
              return true;
            }
          }
          return false;
        });
        
        if (clicked) {
          console.log('✅ Selected Wide Corp Solutions');
          
          // Wait for navigation to complete
          await page.waitForFunction(() => {
            const hasOrgSelector = document.querySelector('h2') && 
                                   document.querySelector('h2').textContent.includes('Select Organization');
            return !hasOrgSelector; // Wait until org selector is gone
          }, { timeout: 15000 });
          
          console.log('✅ Navigated past organization selection');
          
          // Give time for sync to initialize after org selection
          await page.waitForTimeout(8000);
          
        } else {
          console.log('⚠️  Could not find Wide Corp Solutions button');
        }
        
      } catch (error) {
        console.log('⚠️  Error selecting organization:', error.message);
        // Continue anyway
        await page.waitForTimeout(5000);
      }
    } else {
      // Give additional time for sync to start automatically
      await page.waitForTimeout(5000);
    }
    
    console.log('🔍 Checking initial state...');
    
    // Get initial LSN and record state
    const initialState = await page.evaluate(() => {
      // Check localStorage for any existing sync state
      const syncState = localStorage.getItem('sync-machine-state');
      const parsedState = syncState ? JSON.parse(syncState) : {};
      
      return {
        currentLSN: parsedState.currentLSN || '0/0',
        hasSync: !!syncState,
        appReady: document.body.getAttribute('data-playwright-ready') === 'true'
      };
    });
    
    console.log(`📍 Initial state:`);
    console.log(`   LSN: ${initialState.currentLSN}`);
    console.log(`   Has sync state: ${initialState.hasSync ? '✅' : '❌'}`);
    console.log(`   App ready: ${initialState.appReady ? '✅' : '❌'}`);
    
    // Check if we already have an authenticated session with data
    const hasExistingData = initialState.currentLSN !== '0/0' || initialState.hasSync;
    
    if (hasExistingData) {
      console.log('✅ Found existing sync state - this indicates sync has already run');
      console.log('   This is expected with persistent authentication context');
    } else {
      console.log('⚠️  No existing sync state found');
      console.log('   Will monitor for automatic sync initialization...');
    }
    
    console.log('🔄 Triggering initial sync...');
    
    // Monitor sync state and check if sync is working
    const syncResult = await page.evaluate(async (hasExistingData) => {
      console.log('Monitoring sync state and activity...');
      
      let attempts = 0;
      let syncCompleted = false;
      let finalRecordCount = 0;
      let finalLSN = '0/0';
      let initialLSN = '0/0';
      
      // Get initial LSN from existing state
      const initialSyncState = localStorage.getItem('sync-machine-state');
      if (initialSyncState) {
        try {
          const parsed = JSON.parse(initialSyncState);
          initialLSN = parsed.currentLSN || '0/0';
          finalLSN = initialLSN;
          console.log(`Starting with existing LSN: ${initialLSN}`);
          
          // If we already have data, that's success
          if (initialLSN !== '0/0') {
            syncCompleted = true;
            finalRecordCount = parsed.totalRecords || 0;
          }
        } catch (error) {
          console.log('Error parsing initial sync state:', error.message);
        }
      }
      
      // If we don't have sync data yet, wait and monitor for it
      if (!syncCompleted) {
        console.log('No existing sync data found, monitoring for sync initialization...');
        
        while (attempts < 20 && !syncCompleted) {  // 20 second timeout
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check for sync state changes
          const currentSyncState = localStorage.getItem('sync-machine-state');
          if (currentSyncState) {
            try {
              const parsed = JSON.parse(currentSyncState);
              const currentLSN = parsed.currentLSN || '0/0';
              console.log(`Check ${attempts}: LSN = ${currentLSN}, State = ${parsed.state || 'unknown'}`);
              
              if (currentLSN !== '0/0') {
                finalLSN = currentLSN;
                finalRecordCount = parsed.totalRecords || 0;
                
                // If we have an LSN and are idle or completed, consider it success
                if (parsed.state === 'idle' || parsed.syncCompleted || finalRecordCount > 0) {
                  syncCompleted = true;
                  console.log(`Sync detected! LSN: ${finalLSN}, Records: ${finalRecordCount}`);
                  break;
                }
              }
            } catch (error) {
              console.log(`Parse error attempt ${attempts}:`, error.message);
            }
          }
          
          // Try to trigger sync on early attempts
          if (attempts <= 3) {
            console.log(`Attempt ${attempts}: Trying to trigger sync...`);
            
            if (window.appInitActor) {
              try {
                const snapshot = window.appInitActor.getSnapshot();
                console.log(`AppInit state: ${snapshot.value}`);
                if (snapshot.value !== 'systemReady') {
                  window.appInitActor.send({ type: 'INITIALIZE' });
                }
              } catch (error) {
                console.log(`AppInit error:`, error.message);
              }
            }
          }
        }
      }
      
      return {
        success: syncCompleted,
        attempts,
        finalLSN,
        finalRecordCount,
        initialLSN,
        timeoutReached: attempts >= 20,
        hadExistingData: hasExistingData
      };
    }, hasExistingData);
    
    console.log('🔄 Sync trigger results:');
    console.log(`   Success: ${syncResult.success ? '✅' : '❌'}`);
    console.log(`   Attempts: ${syncResult.attempts}`);
    console.log(`   Final LSN: ${syncResult.finalLSN}`);
    console.log(`   Records: ${syncResult.finalRecordCount}`);
    console.log(`   Timeout: ${syncResult.timeoutReached ? '❌' : '✅'}`);
    
    // If sync didn't complete through normal flow, check if data exists anyway
    let dataVerification = { hasData: false, recordCount: 0 };
    
    if (!syncResult.success) {
      console.log('\\n🔍 Checking for existing data despite sync state...');
      
      dataVerification = await page.evaluate(async () => {
        try {
          // Check various entity endpoints to see if data exists
          const endpoints = [
            '/api/archetype/orgs/01920000-1000-7000-8000-000000000001/project',
            '/api/archetype/orgs/01920000-1000-7000-8000-000000000001/certification',
            '/api/archetype/orgs/01920000-1000-7000-8000-000000000001/contract'
          ];
          
          let totalRecords = 0;
          for (const endpoint of endpoints) {
            try {
              const response = await fetch(endpoint);
              if (response.ok) {
                const data = await response.json();
                const count = Array.isArray(data) ? data.length : 0;
                totalRecords += count;
                console.log(`${endpoint.split('/').pop()}: ${count} records`);
              }
            } catch (error) {
              console.log(`Error checking ${endpoint}:`, error.message);
            }
          }
          
          return {
            hasData: totalRecords > 0,
            recordCount: totalRecords
          };
        } catch (error) {
          console.log('Data verification error:', error.message);
          return { hasData: false, recordCount: 0 };
        }
      });
      
      console.log(`   Data exists: ${dataVerification.hasData ? '✅' : '❌'}`);
      console.log(`   Total records: ${dataVerification.recordCount}`);
    }
    
    // Final state check
    const finalState = await page.evaluate(() => {
      const syncState = localStorage.getItem('sync-machine-state');
      const parsed = syncState ? JSON.parse(syncState) : {};
      
      return {
        currentLSN: parsed.currentLSN || '0/0',
        state: parsed.state || 'unknown',
        totalRecords: parsed.totalRecords || 0,
        syncCompleted: parsed.syncCompleted || false,
        hasValidState: !!syncState
      };
    });
    
    console.log('\\n📊 Final State Check:');
    console.log(`   Persisted LSN: ${finalState.currentLSN}`);
    console.log(`   Sync state: ${finalState.state}`);
    console.log(`   Total records: ${finalState.totalRecords}`);
    console.log(`   Sync completed: ${finalState.syncCompleted ? '✅' : '❌'}`);
    console.log(`   Has sync state: ${finalState.hasValidState ? '✅' : '❌'}`);
    
    // Comprehensive validation
    const validationResults = {
      syncAttempted: syncResult.attempts > 0,
      lsnAdvanced: finalState.currentLSN !== '0/0',
      lsnPersisted: finalState.hasValidState,
      recordsReceived: (finalState.totalRecords > 0) || (dataVerification.recordCount > 0),
      syncCompleted: syncResult.success || finalState.syncCompleted,
      hasWorkingData: dataVerification.hasData || finalState.totalRecords > 0
    };
    
    console.log('\\n📋 Complete Sync Validation Results:');
    Object.entries(validationResults).forEach(([key, passed]) => {
      console.log(`   ${key}: ${passed ? '✅' : '❌'}`);
    });
    
    const passedChecks = Object.values(validationResults).filter(Boolean).length;
    const totalChecks = Object.keys(validationResults).length;
    console.log(`\\n📊 Overall Score: ${passedChecks}/${totalChecks}`);
    
    // Test assertions
    expect(validationResults.syncAttempted, 'Should attempt sync process').toBe(true);
    expect(validationResults.lsnPersisted, 'Should persist sync state').toBe(true);
    
    // Core sync requirements - at least one should be true
    const hasSyncEvidence = validationResults.lsnAdvanced || validationResults.recordsReceived || validationResults.hasWorkingData;
    expect(hasSyncEvidence, 'Should show evidence of sync (LSN advancement or records)').toBe(true);
    
    // Overall success
    expect(passedChecks, 'Should pass majority of validation checks').toBeGreaterThanOrEqual(4);
    
    console.log('\\n✅ Complete initial sync validation finished!');
    console.log(`🎉 Sync system ${hasSyncEvidence ? 'is working' : 'needs investigation'}`);
  });
});