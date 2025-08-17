/**
 * Test LiveStore Change Tracking Integration
 * 
 * Tests the integration between LiveStore operations and our existing
 * change tracking system (local_changes table).
 */

import { 
  LiveStoreChangeTrackingService,
  initializeLiveStoreChangeTracking 
} from './livestore-change-tracking';
import { 
  LiveStoreSyncService 
} from './livestore-sync-integration';
import { createLiveStoreOperations } from './livestore-operations';

/**
 * Mock LiveStore instance for testing
 */
class MockLiveStoreInstance {
  private data = new Map<string, Map<string, any>>();
  
  async ready(): Promise<void> {
    // Mock ready
  }
  
  async query(sql: string, params?: any[]): Promise<any[]> {
    console.log(`🗄️ Mock query: ${sql}`, params);
    
    // Simple mock for table queries
    if (sql.includes('SELECT') && sql.includes('sqlite_master')) {
      return [
        { name: 'test_org_projects' },
        { name: 'test_org_tasks' }
      ];
    }
    
    // Mock data queries
    if (sql.includes('SELECT')) {
      return Array.from(this.data.values()).flat();
    }
    
    return [];
  }
  
  async apply(event: any): Promise<void> {
    console.log(`📨 Mock apply:`, event);
    // Mock event application
  }
  
  async close(): Promise<void> {
    console.log(`🔌 Mock close`);
  }
  
  // Mock methods for testing
  mockInsert(tableName: string, record: any): void {
    if (!this.data.has(tableName)) {
      this.data.set(tableName, new Map());
    }
    this.data.get(tableName)!.set(record.id, record);
  }
  
  mockUpdate(tableName: string, id: string, updates: any): void {
    const table = this.data.get(tableName);
    if (table && table.has(id)) {
      const existing = table.get(id);
      table.set(id, { ...existing, ...updates });
    }
  }
  
  mockDelete(tableName: string, id: string): void {
    const table = this.data.get(tableName);
    if (table) {
      table.delete(id);
    }
  }
}

/**
 * Mock Dexie db for testing
 */
class MockDexieDB {
  local_changes = {
    data: new Map<string, any>(),
    
    async add(change: any) {
      this.data.set(change.id, change);
      console.log(`💾 Mock local_changes.add:`, change);
      return change.id;
    },
    
    where(field: string) {
      return {
        equals: (value: any) => ({
          and: (filter: Function) => ({
            toArray: async () => {
              const results = Array.from(this.data.values())
                .filter(item => item[field] === value)
                .filter(filter);
              console.log(`🔍 Mock query results:`, results.length);
              return results;
            }
          })
        }),
        anyOf: (values: any[]) => ({
          modify: async (updates: any) => {
            for (const [id, item] of this.data.entries()) {
              if (values.includes(item.id)) {
                this.data.set(id, { ...item, ...updates });
              }
            }
            console.log(`✏️ Mock modify: ${values.length} items`);
            return values.length;
          }
        })
      };
    },
    
    clear() {
      this.data.clear();
    },
    
    toArray() {
      return Array.from(this.data.values());
    }
  };
}

/**
 * Test LiveStore Change Tracking Integration
 */
export class LiveStoreChangeTrackingTester {
  private mockInstance: MockLiveStoreInstance;
  private mockDb: MockDexieDB;
  private changeTracker: LiveStoreChangeTrackingService;
  private testResults: Array<{ test: string; passed: boolean; error?: string }> = [];

  constructor() {
    this.mockInstance = new MockLiveStoreInstance();
    this.mockDb = new MockDexieDB();
    this.changeTracker = initializeLiveStoreChangeTracking('test-client', 'test-user');
    
    // Mock the Dexie import
    this.mockDexieImport();
  }

  /**
   * Mock the Dexie import for testing
   */
  private mockDexieImport(): void {
    // Override the dynamic import for testing
    const originalImport = (globalThis as any).__originalImport;
    (globalThis as any).__originalImport = originalImport || import;
    
    // Mock dynamic import
    global.import = async (path: string) => {
      if (path.includes('dexie-schema')) {
        return { db: this.mockDb };
      }
      if (path.includes('dexie-change-tracking')) {
        return { 
          getChangeProcessor: () => null 
        };
      }
      return (globalThis as any).__originalImport(path);
    };
  }

  /**
   * Run all change tracking tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Testing LiveStore Change Tracking Integration...');

    await this.testBasicChangeTracking();
    await this.testOperationsIntegration();
    await this.testSyncIntegration();
    await this.testChangeTrackingDisabling();
    await this.testDuplicatePrevention();

    this.printResults();
  }

  /**
   * Test 1: Basic change tracking functionality
   */
  async testBasicChangeTracking(): Promise<void> {
    const testName = 'Basic Change Tracking';
    console.log(`🧪 Testing: ${testName}`);

    try {
      // Register instance
      await this.changeTracker.registerInstance('test-org', this.mockInstance as any);

      // Track a change
      await this.changeTracker.trackChange({
        operation: 'insert',
        tableName: 'test_org_projects',
        entityId: 'project-1',
        data: { name: 'Test Project', budget: 1000 },
        organizationId: 'test-org',
        timestamp: Date.now()
      });

      // Check if change was stored
      const changes = this.mockDb.local_changes.toArray();
      if (changes.length > 0) {
        const change = changes[0];
        if (change.operation === 'insert' && change.entity_id === 'project-1') {
          this.testResults.push({ test: testName, passed: true });
          console.log(`✅ ${testName} passed`);
        } else {
          throw new Error('Change data incorrect');
        }
      } else {
        throw new Error('No change was tracked');
      }

    } catch (error) {
      this.testResults.push({ test: testName, passed: false, error: String(error) });
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Test 2: Operations integration
   */
  async testOperationsIntegration(): Promise<void> {
    const testName = 'Operations Integration';
    console.log(`🧪 Testing: ${testName}`);

    try {
      // Clear previous data
      this.mockDb.local_changes.clear();

      // Create operations manager
      const operations = createLiveStoreOperations(this.mockInstance as any, 'test-org');

      // Test insert operation
      const insertResult = await operations.insert({
        organizationId: 'test-org',
        tableName: 'test_org_tasks',
        data: { title: 'Test Task', status: 'todo' }
      });

      if (!insertResult.success) {
        throw new Error('Insert operation failed');
      }

      // Check if change was tracked
      const changes = this.mockDb.local_changes.toArray();
      const insertChange = changes.find(c => c.operation === 'insert');
      
      if (insertChange && insertChange.table_name === 'test_org_tasks') {
        this.testResults.push({ test: testName, passed: true });
        console.log(`✅ ${testName} passed`);
      } else {
        throw new Error('Insert change not tracked correctly');
      }

    } catch (error) {
      this.testResults.push({ test: testName, passed: false, error: String(error) });
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Test 3: Sync integration
   */
  async testSyncIntegration(): Promise<void> {
    const testName = 'Sync Integration';
    console.log(`🧪 Testing: ${testName}`);

    try {
      // Clear previous data
      this.mockDb.local_changes.clear();

      // Create sync service
      const syncService = new LiveStoreSyncService({
        orgId: 'test-org',
        clientId: 'test-client',
        userId: 'test-user',
        instance: this.mockInstance as any
      });

      // Test applying incoming changes
      const incomingChanges = [{
        id: 'change-1',
        table_name: 'test_org_projects',
        entity_id: 'project-2',
        operation: 'insert' as const,
        data: { name: 'Incoming Project', budget: 2000 },
        organization_id: 'test-org',
        created_at: new Date().toISOString(),
        lsn: '1000'
      }];

      await syncService.applyIncomingChanges(incomingChanges);

      // Test getting pending changes
      // First, create a local change
      await this.changeTracker.trackChange({
        operation: 'update',
        tableName: 'test_org_projects',
        entityId: 'project-2',
        data: { name: 'Updated Project' },
        organizationId: 'test-org',
        timestamp: Date.now()
      });

      const pendingChanges = await syncService.getPendingOutgoingChanges();
      
      if (pendingChanges.length > 0) {
        this.testResults.push({ test: testName, passed: true });
        console.log(`✅ ${testName} passed`);
      } else {
        throw new Error('No pending changes found');
      }

    } catch (error) {
      this.testResults.push({ test: testName, passed: false, error: String(error) });
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Test 4: Change tracking disabling
   */
  async testChangeTrackingDisabling(): Promise<void> {
    const testName = 'Change Tracking Disabling';
    console.log(`🧪 Testing: ${testName}`);

    try {
      // Clear previous data
      this.mockDb.local_changes.clear();

      // Disable tracking
      this.changeTracker.disableTracking();

      // Try to track a change
      await this.changeTracker.trackChange({
        operation: 'insert',
        tableName: 'test_org_tasks',
        entityId: 'task-disabled',
        data: { title: 'Should not be tracked' },
        organizationId: 'test-org',
        timestamp: Date.now()
      });

      // Check that no change was tracked
      const changes = this.mockDb.local_changes.toArray();
      
      if (changes.length === 0) {
        // Re-enable tracking
        this.changeTracker.enableTracking();
        
        // Try tracking again
        await this.changeTracker.trackChange({
          operation: 'insert',
          tableName: 'test_org_tasks',
          entityId: 'task-enabled',
          data: { title: 'Should be tracked' },
          organizationId: 'test-org',
          timestamp: Date.now()
        });

        const changesAfterEnable = this.mockDb.local_changes.toArray();
        
        if (changesAfterEnable.length === 1) {
          this.testResults.push({ test: testName, passed: true });
          console.log(`✅ ${testName} passed`);
        } else {
          throw new Error('Change tracking not properly re-enabled');
        }
      } else {
        throw new Error('Change was tracked when disabled');
      }

    } catch (error) {
      this.testResults.push({ test: testName, passed: false, error: String(error) });
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Test 5: Duplicate prevention
   */
  async testDuplicatePrevention(): Promise<void> {
    const testName = 'Duplicate Prevention';
    console.log(`🧪 Testing: ${testName}`);

    try {
      // Clear previous data
      this.mockDb.local_changes.clear();

      const changeData = {
        operation: 'update' as const,
        tableName: 'test_org_projects',
        entityId: 'project-duplicate',
        data: { name: 'Duplicate Test' },
        organizationId: 'test-org',
        timestamp: Date.now()
      };

      // Track the same change multiple times quickly
      await this.changeTracker.trackChange(changeData);
      await this.changeTracker.trackChange(changeData);
      await this.changeTracker.trackChange(changeData);

      // Check that only one change was tracked
      const changes = this.mockDb.local_changes.toArray();
      
      if (changes.length === 1) {
        this.testResults.push({ test: testName, passed: true });
        console.log(`✅ ${testName} passed`);
      } else {
        throw new Error(`Expected 1 change, got ${changes.length}`);
      }

    } catch (error) {
      this.testResults.push({ test: testName, passed: false, error: String(error) });
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n🧪 LiveStore Change Tracking Test Results:');
    console.log('═'.repeat(60));

    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      if (result.passed) {
        console.log(`✅ ${result.test}`);
        passed++;
      } else {
        console.log(`❌ ${result.test}: ${result.error}`);
        failed++;
      }
    });

    console.log('═'.repeat(60));
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All change tracking tests passed!');
      console.log('\n✅ Integration Status:');
      console.log('- LiveStore operations → local_changes: WORKING');
      console.log('- Change tracking enable/disable: WORKING');
      console.log('- Sync integration: WORKING');
      console.log('- Duplicate prevention: WORKING');
      console.log('- Operations manager: WORKING');
    } else {
      console.log('⚠️ Some tests failed. Check the implementation.');
    }
  }

  /**
   * Get test results
   */
  getResults(): Array<{ test: string; passed: boolean; error?: string }> {
    return [...this.testResults];
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.mockDb.local_changes.clear();
    this.testResults = [];
  }
}

/**
 * Run change tracking tests
 */
export async function testLiveStoreChangeTracking(): Promise<void> {
  const tester = new LiveStoreChangeTrackingTester();
  
  try {
    await tester.runAllTests();
  } finally {
    tester.cleanup();
  }
}

// Export for global usage
if (typeof window !== 'undefined') {
  (window as any).testLiveStoreChangeTracking = testLiveStoreChangeTracking;
  console.log('🧪 LiveStore change tracking test available as window.testLiveStoreChangeTracking()');
}