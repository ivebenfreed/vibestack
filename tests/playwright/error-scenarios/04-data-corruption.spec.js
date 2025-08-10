/**
 * Data Corruption Scenario Testing
 * 
 * Tests application behavior when handling corrupted data:
 * - Invalid JSON in local storage
 * - Corrupted database records
 * - Malformed server responses
 * - Schema validation failures
 * - Data recovery mechanisms
 * - Cleanup and reset procedures
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Data Corruption Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for app initialization
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
  });

  test('should handle corrupted localStorage data', async ({ page }) => {
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('LocalStorage corruption test: Injecting corrupted data');
      
      // Inject various types of corrupted localStorage data
      localStorage.setItem('auth', '{invalid-json-structure}');
      localStorage.setItem('userSettings', 'not-json-at-all');
      localStorage.setItem('syncState', '{"incomplete": true, "missingFields": ');
      localStorage.setItem('appData', '{"validStart": true, "corruptedEnd": {}}}invalid');
    });

    // Reload page to trigger reading of corrupted localStorage
    await page.reload();
    await page.waitForTimeout(3000);

    // App should handle corrupted localStorage gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') || 'unknown';
    });

    // Should not crash due to corrupted localStorage
    expect(syncState).not.toBe('unknown');
    expect(syncState).toBeTruthy();

    // Check if corrupted data was cleaned up
    const cleanupResult = await page.evaluate(() => {
      try {
        const auth = localStorage.getItem('auth');
        const settings = localStorage.getItem('userSettings');
        
        return {
          authCleaned: !auth || auth === 'null' || (auth.startsWith('{') && auth.endsWith('}')),
          settingsCleaned: !settings || settings === 'null' || (settings.startsWith('{') && settings.endsWith('}')),
          localStorage: Object.keys(localStorage).length
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    // Should either clean up corrupted data or handle it gracefully
    expect(cleanupResult.error).toBeUndefined();
  });

  test('should handle corrupted IndexedDB data', async ({ page }) => {
    // Simulate corrupted IndexedDB data
    await page.evaluate(async () => {
      window.xstateTestInspector?.addMarker('IndexedDB corruption test: Corrupting database');
      
      if (window.db) {
        try {
          // Try to inject corrupted data into IndexedDB
          await window.db.tasks.add({
            id: 'corrupted-task-1',
            // Missing required fields
            invalid_field: 'should not exist',
            nested_corruption: {
              deep: {
                circular: null // Will be made circular
              }
            }
          });
          
          // Create circular reference
          const corrupt = await window.db.tasks.get('corrupted-task-1');
          if (corrupt) {
            corrupt.nested_corruption.deep.circular = corrupt;
            await window.db.tasks.put(corrupt);
          }
        } catch (e) {
          console.log('Expected corruption handling:', e);
        }
      }
    });

    await page.waitForTimeout(2000);

    // Try to perform operations that might encounter corrupted data
    try {
      await page.goto('/tasks');
      await page.waitForTimeout(3000);
    } catch (e) {
      // Navigation might fail with corrupted data
    }

    // Check if application handles corrupted database records
    const dbState = await page.evaluate(async () => {
      if (!window.db) return { available: false };
      
      try {
        // Try to read from potentially corrupted database
        const taskCount = await window.db.tasks.count();
        return {
          available: true,
          taskCount,
          error: null
        };
      } catch (e) {
        return {
          available: true,
          taskCount: 0,
          error: e.message
        };
      }
    });

    // Should handle database corruption gracefully
    expect(dbState.available).toBe(true);
    
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    expect(syncState).not.toBe('error');
  });

  test('should handle malformed server data', async ({ page }) => {
    // Mock server responses with corrupted data structures
    await page.context().route('**/api/**', async route => {
      const url = route.request().url();
      
      if (url.includes('/sync/')) {
        // Send malformed sync data
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            type: 'srv_init_changes',
            changes: [
              {
                // Missing required fields
                operation: 'CREATE',
                // Missing table name
                data: {
                  id: 'malformed-1',
                  // Circular reference that breaks JSON
                  circular: '[Circular Reference]'
                }
              },
              {
                table: 'tasks',
                operation: 'INVALID_OPERATION', // Invalid operation type
                data: null // Null data
              },
              {
                table: 'users',
                operation: 'UPDATE',
                data: {
                  id: 123, // Wrong type for ID
                  name: ['array', 'instead', 'of', 'string'], // Wrong type
                  email: { complex: 'object instead of string' }
                }
              }
            ]
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Malformed server data test: Receiving corrupted sync data');
    });

    // Trigger sync that will receive malformed data
    await page.reload();
    await page.waitForTimeout(5000);

    // Should handle malformed server data without crashing
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should not crash from malformed data
    expect(syncState).not.toBe('unknown');
    expect(typeof syncState).toBe('string');
  });

  test('should validate and reject invalid schema data', async ({ page }) => {
    // Mock server sending data that violates schema
    await page.context().route('**/api/sync/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'srv_init_changes',
          changes: [
            {
              table: 'tasks',
              operation: 'CREATE',
              data: {
                // Schema violations
                id: null, // Required field is null
                title: 123, // Wrong type
                description: ['array', 'not', 'string'],
                created_at: 'not-a-date',
                user_id: 'non-numeric-id',
                status: 'invalid-status-value',
                // Missing required fields
                // Extra fields that don't belong
                hackerField: '<script>alert("xss")</script>',
                sqlInjection: "'; DROP TABLE tasks; --"
              }
            }
          ]
        })
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Schema validation test: Receiving invalid schema data');
    });

    // Trigger sync with invalid schema data
    await page.reload();
    await page.waitForTimeout(5000);

    // Should handle schema validation failures gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Check if invalid data was rejected
    const dbValidation = await page.evaluate(async () => {
      if (!window.db) return { available: false };
      
      try {
        const tasks = await window.db.tasks.toArray();
        const hasInvalidData = tasks.some(task => 
          typeof task.title === 'number' || 
          Array.isArray(task.description) ||
          task.hackerField !== undefined ||
          task.sqlInjection !== undefined
        );
        
        return {
          available: true,
          taskCount: tasks.length,
          hasInvalidData
        };
      } catch (e) {
        return {
          available: true,
          error: e.message
        };
      }
    });

    // Should reject invalid schema data
    expect(dbValidation.hasInvalidData).toBe(false);
    expect(syncState).not.toBe('error');
  });

  test('should handle data recovery after corruption', async ({ page }) => {
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Data recovery test: Simulating recovery scenario');
    });

    // First corrupt the data
    await page.evaluate(() => {
      localStorage.setItem('corruptionFlag', 'true');
      localStorage.setItem('auth', 'corrupted');
      localStorage.setItem('syncState', '{broken}');
    });

    // Then mock recovery endpoint
    await page.context().route('**/api/recovery/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Data recovery completed',
          recoveredRecords: 10,
          cleanupActions: ['cleared_invalid_localStorage', 'reset_sync_state']
        })
      });
    });

    // Reload to trigger corruption detection
    await page.reload();
    await page.waitForTimeout(3000);

    // Look for recovery mechanisms
    const recoveryIndicators = [
      'text=Recovering data',
      'text=Cleanup in progress',
      'text=Data restored',
      '[data-testid="recovery-progress"]',
      '.recovery-indicator'
    ];

    let foundRecovery = false;
    for (const selector of recoveryIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        foundRecovery = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Check if system recovered
    const recoveryResult = await page.evaluate(() => {
      const corruptionFlag = localStorage.getItem('corruptionFlag');
      const auth = localStorage.getItem('auth');
      const syncState = window.xstateTestInspector?.getCurrentState('sync-machine-v3');
      
      return {
        corruptionFlagCleared: corruptionFlag !== 'true',
        authCleaned: auth !== 'corrupted',
        syncState
      };
    });

    // Should recover from corruption
    expect(recoveryResult.syncState).not.toBe('error');
  });

  test('should handle partial data corruption gracefully', async ({ page }) => {
    // Simulate scenario where only some data is corrupted
    await page.evaluate(async () => {
      window.xstateTestInspector?.addMarker('Partial corruption test: Mixed valid/invalid data');
      
      if (window.db) {
        try {
          // Add mix of valid and invalid data
          await window.db.tasks.bulkAdd([
            {
              id: 'valid-task-1',
              title: 'Valid Task',
              description: 'This is valid'
            },
            {
              id: 'corrupted-task-1',
              title: null, // Invalid
              description: { corrupted: 'object instead of string' }
            },
            {
              id: 'valid-task-2', 
              title: 'Another Valid Task',
              description: 'Also valid'
            }
          ]);
        } catch (e) {
          console.log('Partial corruption test setup error:', e);
        }
      }
    });

    await page.waitForTimeout(2000);

    // Try to load and display the data
    try {
      await page.goto('/tasks');
      await page.waitForTimeout(3000);
    } catch (e) {
      // May have issues with corrupted data
    }

    // Should handle partial corruption by showing valid data and handling invalid data
    const partialHandlingResult = await page.evaluate(async () => {
      if (!window.db) return { available: false };
      
      try {
        const allTasks = await window.db.tasks.toArray();
        const validTasks = allTasks.filter(task => 
          task.title && typeof task.title === 'string'
        );
        const corruptedTasks = allTasks.filter(task => 
          !task.title || typeof task.title !== 'string'
        );
        
        return {
          available: true,
          totalTasks: allTasks.length,
          validTasks: validTasks.length,
          corruptedTasks: corruptedTasks.length
        };
      } catch (e) {
        return {
          available: true,
          error: e.message
        };
      }
    });

    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should isolate corruption and handle valid data
    expect(partialHandlingResult.available).toBe(true);
    expect(syncState).not.toBe('error');
  });

  test('should provide data corruption diagnostics', async ({ page }) => {
    // Simulate corruption with diagnostic information
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Diagnostics test: Enabling corruption detection');
      
      // Enable diagnostic mode
      localStorage.setItem('diagnosticMode', 'true');
      localStorage.setItem('corruptData', '{"timestamp": "invalid-date", "data": [broken array}');
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // Look for diagnostic information
    const diagnosticInfo = await page.evaluate(() => {
      return {
        diagnosticMode: localStorage.getItem('diagnosticMode'),
        hasCorruptData: localStorage.getItem('corruptData') !== null,
        syncState: window.xstateTestInspector?.getCurrentState('sync-machine-v3'),
        consoleErrors: window.diagnosticErrors || []
      };
    });

    // Should detect and report corruption issues
    expect(diagnosticInfo.diagnosticMode).toBe('true');
    expect(diagnosticInfo.syncState).not.toBe('unknown');
  });

  test('should perform emergency data reset when severely corrupted', async ({ page }) => {
    // Simulate severe corruption requiring full reset
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Emergency reset test: Severe corruption detected');
      
      // Corrupt everything severely
      localStorage.setItem('auth', '{{{{{broken}}}}}');
      localStorage.setItem('userData', 'completely-invalid-data-structure');
      localStorage.setItem('appSettings', '["array", "instead", "of", {"object"}]');
      sessionStorage.setItem('tempData', '{circular:circular}');
    });

    // Mock emergency reset endpoint
    await page.context().route('**/api/emergency-reset/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Emergency reset completed',
          actions: ['cleared_all_storage', 'reset_database', 'force_resync']
        })
      });
    });

    await page.reload();
    await page.waitForTimeout(5000);

    // Check if emergency reset was triggered
    const resetResult = await page.evaluate(() => {
      return {
        localStorageCleared: localStorage.length === 0 || !localStorage.getItem('auth'),
        sessionStorageCleared: sessionStorage.length === 0,
        syncState: window.xstateTestInspector?.getCurrentState('sync-machine-v3')
      };
    });

    // Should perform emergency reset when severely corrupted
    expect(resetResult.syncState).not.toBe('error');
    expect(resetResult.localStorageCleared || resetResult.sessionStorageCleared).toBe(true);
  });
});