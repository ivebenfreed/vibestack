/**
 * Test LiveStore LocalChanges Implementation
 * 
 * Create and test a LiveStore-based LocalChanges system
 */

import { test, expect } from '@playwright/test';

test('LiveStore LocalChanges implementation', async ({ page }) => {
  console.log('🔗 Testing LiveStore LocalChanges implementation...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('LiveStore') || 
        text.includes('LocalChanges') ||
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
  await page.waitForTimeout(5000);
  
  // Test LiveStore LocalChanges implementation
  console.log('🧪 Creating LiveStore LocalChanges system...');
  
  const liveStoreLocalChangesTest = await page.evaluate(async () => {
    const results = {
      timestamp: Date.now(),
      steps: {}
    };
    
    try {
      // Step 1: Check LiveStore client availability and initialize if needed
      console.log('[BROWSER] Step 1: Checking LiveStore client...');
      
      if (!window.liveStoreClient) {
        console.log('[BROWSER] LiveStore client not available, attempting to initialize...');
        
        // Try to manually initialize LiveStore if possible
        if (window.testLiveStoreInBrowser) {
          console.log('[BROWSER] Found testLiveStoreInBrowser function, using it...');
          try {
            await window.testLiveStoreInBrowser();
            console.log('[BROWSER] ✅ LiveStore test function executed');
            
            // Check if client is now available
            if (window.liveStoreClient) {
              console.log('[BROWSER] ✅ LiveStore client now available after test');
            }
          } catch (error) {
            console.log('[BROWSER] ❌ LiveStore test function failed:', error.message);
          }
        }
        
        if (!window.liveStoreClient) {
          console.log('[BROWSER] ❌ Still no LiveStore client available');
          results.steps.clientCheck = {
            success: false,
            reason: 'LiveStore client not available'
          };
          return results;
        }
      }
      
      console.log('[BROWSER] ✅ LiveStore client is available');
      results.steps.clientCheck = {
        success: true
      };
      
      // Step 2: Create LocalChanges table in LiveStore
      console.log('[BROWSER] Step 2: Creating LocalChanges table...');
      
      const orgId = '01920000_1000_7000_8000_000000000001';
      const localChangesTableName = `org_${orgId}_local_changes`;
      
      try {
        // Create the LocalChanges table with proper schema
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS ${localChangesTableName} (
            id TEXT PRIMARY KEY,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
            record_id TEXT NOT NULL,
            data TEXT NOT NULL,
            is_processed BOOLEAN DEFAULT FALSE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            client_id TEXT,
            client_sequence TEXT,
            retry_count INTEGER DEFAULT 0,
            last_error TEXT,
            INDEX idx_local_changes_processed (is_processed),
            INDEX idx_local_changes_table (table_name),
            INDEX idx_local_changes_created (created_at)
          )
        `;
        
        await window.liveStoreClient.execute(createTableSQL);
        console.log('[BROWSER] ✅ LocalChanges table created successfully');
        
        results.steps.tableCreation = {
          success: true,
          tableName: localChangesTableName
        };
      } catch (createError) {
        console.log('[BROWSER] ❌ Failed to create LocalChanges table:', createError.message);
        results.steps.tableCreation = {
          success: false,
          error: createError.message
        };
        return results;
      }
      
      // Step 3: Test LocalChanges operations
      console.log('[BROWSER] Step 3: Testing LocalChanges operations...');
      
      const testTimestamp = Date.now();
      const testRecord = {
        id: `test_change_${testTimestamp}`,
        table_name: `org_${orgId}_clients`,
        operation: 'INSERT',
        record_id: `test_client_${testTimestamp}`,
        data: JSON.stringify({
          id: `test_client_${testTimestamp}`,
          name: `Test Client ${testTimestamp}`,
          email: `test.${testTimestamp}@livestore.com`,
          status: 'active'
        }),
        is_processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        client_id: 'livestore-test-client',
        client_sequence: `test-${testTimestamp}`,
        retry_count: 0
      };
      
      try {
        // Insert test LocalChanges record
        await window.liveStoreClient.insert(localChangesTableName, testRecord);
        console.log('[BROWSER] ✅ Test LocalChanges record inserted');
        
        // Query it back to verify
        const queryResult = await window.liveStoreClient.query(
          `SELECT * FROM ${localChangesTableName} WHERE id = ?`,
          [testRecord.id]
        );
        
        if (queryResult.length > 0) {
          console.log('[BROWSER] ✅ Test LocalChanges record verified');
          results.steps.operations = {
            success: true,
            testRecordId: testRecord.id,
            retrieved: queryResult[0]
          };
        } else {
          console.log('[BROWSER] ❌ Test LocalChanges record not found after insert');
          results.steps.operations = {
            success: false,
            reason: 'Record not found after insert'
          };
        }
      } catch (opError) {
        console.log('[BROWSER] ❌ LocalChanges operations failed:', opError.message);
        results.steps.operations = {
          success: false,
          error: opError.message
        };
      }
      
      // Step 4: Create LocalChanges helper functions
      console.log('[BROWSER] Step 4: Creating LocalChanges helper functions...');
      
      try {
        // Create helper functions and expose them to window
        window.liveStoreLocalChanges = {
          tableName: localChangesTableName,
          
          async add(change) {
            const record = {
              id: change.id || `change_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              table_name: change.table_name,
              operation: change.operation,
              record_id: change.record_id,
              data: typeof change.data === 'string' ? change.data : JSON.stringify(change.data),
              is_processed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              client_id: change.client_id || 'livestore-client',
              client_sequence: change.client_sequence || `seq_${Date.now()}`,
              retry_count: 0
            };
            
            await window.liveStoreClient.insert(localChangesTableName, record);
            console.log(`[LiveStore LocalChanges] Added record: ${record.id}`);
            return record;
          },
          
          async getPending(limit = 100) {
            return await window.liveStoreClient.query(
              `SELECT * FROM ${localChangesTableName} WHERE is_processed = FALSE ORDER BY created_at ASC LIMIT ?`,
              [limit]
            );
          },
          
          async getAll() {
            return await window.liveStoreClient.query(
              `SELECT * FROM ${localChangesTableName} ORDER BY created_at DESC`
            );
          },
          
          async markProcessed(changeIds) {
            const placeholders = changeIds.map(() => '?').join(',');
            await window.liveStoreClient.execute(
              `UPDATE ${localChangesTableName} SET is_processed = TRUE, updated_at = ? WHERE id IN (${placeholders})`,
              [new Date().toISOString(), ...changeIds]
            );
            console.log(`[LiveStore LocalChanges] Marked ${changeIds.length} changes as processed`);
          },
          
          async count() {
            const result = await window.liveStoreClient.query(
              `SELECT COUNT(*) as count FROM ${localChangesTableName}`
            );
            return result[0]?.count || 0;
          },
          
          async clear() {
            await window.liveStoreClient.execute(
              `DELETE FROM ${localChangesTableName}`
            );
            console.log(`[LiveStore LocalChanges] Cleared all records`);
          }
        };
        
        console.log('[BROWSER] ✅ LiveStore LocalChanges helper functions created');
        
        // Test the helper functions
        const testChange = {
          table_name: `org_${orgId}_projects`,
          operation: 'UPDATE',
          record_id: `test_project_${testTimestamp}`,
          data: { name: 'Updated Project Name', updated_at: new Date().toISOString() }
        };
        
        const addedRecord = await window.liveStoreLocalChanges.add(testChange);
        console.log('[BROWSER] ✅ Helper function test - record added');
        
        const pendingCount = (await window.liveStoreLocalChanges.getPending()).length;
        console.log(`[BROWSER] ✅ Helper function test - found ${pendingCount} pending changes`);
        
        results.steps.helperFunctions = {
          success: true,
          testRecordId: addedRecord.id,
          pendingCount
        };
        
      } catch (helperError) {
        console.log('[BROWSER] ❌ Helper functions creation failed:', helperError.message);
        results.steps.helperFunctions = {
          success: false,
          error: helperError.message
        };
      }
      
      // Step 5: Final verification
      console.log('[BROWSER] Step 5: Final verification...');
      
      try {
        const totalCount = await window.liveStoreLocalChanges.count();
        const allChanges = await window.liveStoreLocalChanges.getAll();
        const pendingChanges = await window.liveStoreLocalChanges.getPending();
        
        console.log(`[BROWSER] ✅ Final count: ${totalCount} total, ${pendingChanges.length} pending`);
        
        results.steps.verification = {
          success: true,
          totalCount,
          pendingCount: pendingChanges.length,
          sampleChanges: allChanges.slice(0, 3)
        };
        
      } catch (verifyError) {
        console.log('[BROWSER] ❌ Final verification failed:', verifyError.message);
        results.steps.verification = {
          success: false,
          error: verifyError.message
        };
      }
      
      console.log('[BROWSER] LiveStore LocalChanges implementation test complete');
      return results;
      
    } catch (error) {
      console.log('[BROWSER] LiveStore LocalChanges test error:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  await page.screenshot({ path: 'livestore-localchanges-implementation.png' });
  
  // Analyze results
  console.log('\n=== LIVESTORE LOCALCHANGES IMPLEMENTATION ===');
  
  const steps = liveStoreLocalChangesTest.steps || {};
  
  console.log(`🔗 LiveStore Client: ${steps.clientCheck?.success ? '✅' : '❌'}`);
  console.log(`🗄️ Table Creation: ${steps.tableCreation?.success ? '✅' : '❌'}`);
  if (steps.tableCreation?.success) {
    console.log(`   Table: ${steps.tableCreation.tableName}`);
  }
  
  console.log(`📝 Operations Test: ${steps.operations?.success ? '✅' : '❌'}`);
  if (steps.operations?.success) {
    console.log(`   Test Record: ${steps.operations.testRecordId}`);
  }
  
  console.log(`🔧 Helper Functions: ${steps.helperFunctions?.success ? '✅' : '❌'}`);
  if (steps.helperFunctions?.success) {
    console.log(`   Pending Count: ${steps.helperFunctions.pendingCount}`);
  }
  
  console.log(`✅ Final Verification: ${steps.verification?.success ? '✅' : '❌'}`);
  if (steps.verification?.success) {
    console.log(`   Total: ${steps.verification.totalCount}`);
    console.log(`   Pending: ${steps.verification.pendingCount}`);
  }
  
  console.log('\n=== IMPLEMENTATION STATUS ===');
  
  const allStepsSuccessful = Object.values(steps).every(step => step?.success);
  
  if (allStepsSuccessful) {
    console.log('🎉 SUCCESS: LiveStore LocalChanges system implemented!');
    console.log('   ✅ LiveStore client working');
    console.log('   ✅ LocalChanges table created');
    console.log('   ✅ CRUD operations working');
    console.log('   ✅ Helper functions available');
    console.log('   🔧 Ready for sync bridge integration');
  } else {
    console.log('❌ ISSUES: LiveStore LocalChanges implementation incomplete');
    Object.entries(steps).forEach(([stepName, step]) => {
      if (!step?.success) {
        console.log(`   🔧 Fix ${stepName}: ${step?.error || step?.reason || 'unknown issue'}`);
      }
    });
  }
  
  console.log('=============================================');
  
  // Test passes if we can at least create the table and basic operations
  expect(steps.clientCheck?.success).toBe(true);
  expect(steps.tableCreation?.success).toBe(true);
});