/**
 * LiveStore Integration Test - Browser Environment
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('LiveStore Integration', () => {
  test('LiveStore schema generation and instance creation', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 30000 }
    );

    console.log('✅ App loaded and ready');

    // Test LiveStore browser integration
    const testResult = await page.evaluate(async () => {
      try {
        // Check if our test functions are available
        if (typeof window.testLiveStoreInBrowser !== 'function') {
          return { 
            success: false, 
            error: 'LiveStore test functions not available. Check if test-livestore-browser.ts is loaded.' 
          };
        }

        console.log('🧪 Starting LiveStore integration test...');
        
        // Run the browser test
        await window.testLiveStoreInBrowser();
        
        return { 
          success: true, 
          message: 'LiveStore integration test completed successfully' 
        };
        
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          stack: error.stack 
        };
      }
    });

    // Assert the test result
    if (!testResult.success) {
      console.error('❌ LiveStore integration test failed:', testResult.error);
      if (testResult.stack) {
        console.error('Stack trace:', testResult.stack);
      }
      throw new Error(`LiveStore integration test failed: ${testResult.error}`);
    }

    console.log('✅ LiveStore integration test passed:', testResult.message);
  });

  test('LiveStore schema validation with real organization data', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 30000 }
    );

    // Test with more complex schema
    const complexTestResult = await page.evaluate(async () => {
      try {
        // Import the required modules
        const { liveStoreSchemaManager } = await import('./src/lib/livestore-dynamic-schema.js');
        const { liveStoreSchemaClient } = await import('./src/lib/livestore-schema-client.js');
        
        console.log('🧪 Testing complex organization schema...');

        // Create a more realistic organization schema
        const complexOrgSchema = {
          orgId: 'realistic-test-org',
          entities: {
            SoftwareProject: {
              extends: 'base_projects',
              customFields: {
                repositoryUrl: { type: 'url', syncable: true },
                techStack: { type: 'array', syncable: true },
                budget: { type: 'number', syncable: true },
                timeline: { type: 'date', syncable: true },
                clientNotes: { type: 'text', syncable: false } // Server-only field
              }
            },
            Sprint: {
              extends: 'base_tasks',
              customFields: {
                sprintNumber: { type: 'number', syncable: true },
                velocity: { type: 'number', syncable: true },
                burndownData: { type: 'object', syncable: true }
              }
            },
            TeamMember: {
              extends: 'base_contacts',
              customFields: {
                role: { type: 'enum', enum: ['developer', 'designer', 'manager'], syncable: true },
                hourlyRate: { type: 'number', syncable: false }, // Server-only field
                skills: { type: 'array', syncable: true }
              }
            }
          },
          version: '2.0.0'
        };

        // Generate schema
        const { schema, events } = await liveStoreSchemaManager.loadOrgLiveStoreSchema(
          'realistic-test-org',
          complexOrgSchema
        );

        console.log(`✅ Complex schema generated - Tables: ${Object.keys(schema).length}, Events: ${Object.keys(events).length}`);

        // Validate schema
        const validation = liveStoreSchemaManager.validateSchema(schema);
        if (!validation.valid) {
          throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
        }

        console.log('✅ Complex schema validation passed');

        // Create instance with complex schema
        const instance = await liveStoreSchemaClient.initializeLiveStore(
          'realistic-test-org',
          'complex-test-client'
        );

        if (!instance) {
          throw new Error('Failed to create LiveStore instance with complex schema');
        }

        console.log('✅ LiveStore instance created with complex schema');

        // Test the instance
        await instance.ready();
        console.log('✅ Complex LiveStore instance ready');

        // Query the schema
        const tables = await instance.query('SELECT name FROM sqlite_master WHERE type=? AND name LIKE ?', ['table', 'realistic_test_org_%']);
        console.log(`✅ Found ${tables.length} organization tables`);

        // Clean up
        await instance.close();
        console.log('✅ Complex test cleanup completed');

        return {
          success: true,
          tablesCount: Object.keys(schema).length,
          eventsCount: Object.keys(events).length,
          databaseTables: tables.length
        };

      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });

    // Assert the complex test result
    if (!complexTestResult.success) {
      console.error('❌ Complex LiveStore test failed:', complexTestResult.error);
      if (complexTestResult.stack) {
        console.error('Stack trace:', complexTestResult.stack);
      }
      throw new Error(`Complex LiveStore test failed: ${complexTestResult.error}`);
    }

    console.log('✅ Complex LiveStore test passed');
    console.log(`   - Tables generated: ${complexTestResult.tablesCount}`);
    console.log(`   - Events generated: ${complexTestResult.eventsCount}`);
    console.log(`   - Database tables found: ${complexTestResult.databaseTables}`);
  });

  test('LiveStore real-time schema sync integration', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 30000 }
    );

    // Test real-time schema sync
    const schemaSyncResult = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing real-time schema sync integration...');

        // Check if schema sync is available
        const { LiveStoreSchemaSync } = await import('./src/lib/livestore-schema-sync.js');
        
        // Create a mock WebSocket service for testing
        const mockWebSocket = {
          handlers: new Map(),
          onMessage(type, handler) {
            this.handlers.set(type, handler);
          },
          async send(message) {
            console.log('📡 Mock WebSocket send:', message);
          },
          getClientId() {
            return 'test-client-schema-sync';
          },
          simulateMessage(type, message) {
            const handler = this.handlers.get(type);
            if (handler) {
              handler(message);
            }
          }
        };

        // Initialize schema sync
        const schemaSync = new LiveStoreSchemaSync(mockWebSocket);
        await schemaSync.initialize('test-schema-sync-org', 'test-client');

        console.log('✅ Schema sync initialized');

        // Test schema update message handling
        let updateReceived = false;
        schemaSync.addListener((event) => {
          if (event.type === 'schema:updated') {
            updateReceived = true;
            console.log('✅ Schema update event received');
          }
        });

        // Simulate a schema update message
        const mockSchemaUpdate = {
          type: 'srv_schema_updated',
          messageId: 'test-schema-update',
          timestamp: Date.now(),
          clientId: 'server',
          orgId: 'test-schema-sync-org',
          payload: {
            orgId: 'test-schema-sync-org',
            changeType: 'entity_created',
            timestamp: Date.now(),
            version: '1.1.0',
            entityChanges: [{
              entityName: 'NewTestEntity',
              changeType: 'entity_created',
              tableName: 'test_schema_sync_org_new_test_entities'
            }]
          },
          broadcastToOrg: true
        };

        mockWebSocket.simulateMessage('srv_schema_updated', mockSchemaUpdate);

        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!updateReceived) {
          throw new Error('Schema update event not received');
        }

        console.log('✅ Real-time schema sync working');

        // Cleanup
        schemaSync.cleanup();

        return {
          success: true,
          message: 'Real-time schema sync integration working correctly'
        };

      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });

    // Assert the schema sync test result
    if (!schemaSyncResult.success) {
      console.error('❌ Schema sync test failed:', schemaSyncResult.error);
      throw new Error(`Schema sync test failed: ${schemaSyncResult.error}`);
    }

    console.log('✅ Real-time schema sync test passed:', schemaSyncResult.message);
  });
});