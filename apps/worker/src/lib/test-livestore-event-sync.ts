/**
 * Test LiveStore Event Sync Implementation
 * 
 * This test validates the LiveStore native event streaming approach
 * and demonstrates how it replaces complex Dexie-based sync bridges.
 */

import { LiveStoreEventSyncService, createLiveStoreEventSync } from './livestore-event-sync-service';
import type { LiveStoreInstance } from './livestore-schema-client';
import type { TableChange } from '@repo/sync-types';
import { log } from '@/logger';
const fileLog = log('lib/test-livestore-event-sync.ts');

// Mock WebSocket sender for testing
class MockWebSocketSender {
  public sentMessages: TableChange[] = [];
  
  async send(message: TableChange): Promise<void> {
    fileLog.info('📤 [MockWebSocket] Sending:', message);
    this.sentMessages.push(message);
  }
  
  clear(): void {
    this.sentMessages = [];
  }
}

// Mock LiveStore event for testing
const createMockEvent = (type: string, data: any) => ({
  type,
  data,
  timestamp: new Date().toISOString(),
  sequenceNumber: Date.now(),
  clientId: 'test-client'
});

/**
 * Test the event sync service
 */
export async function testLiveStoreEventSync(): Promise<void> {
  fileLog.info('🧪 Testing LiveStore Event Sync...');
  
  try {
    // Test 1: Event Type Parsing
    fileLog.info('\n1. Testing event type parsing...');
    await testEventTypeParsing();
    
    // Test 2: Event to TableChange Conversion
    fileLog.info('\n2. Testing event conversion...');
    await testEventConversion();
    
    // Test 3: Integration Test (if LiveStore available)
    fileLog.info('\n3. Testing integration...');
    await testIntegration();
    
    fileLog.info('\n✅ All LiveStore Event Sync tests passed!');
    
  } catch (error) {
    fileLog.error('❌ LiveStore Event Sync test failed:', error);
    throw error;
  }
}

/**
 * Test event type parsing logic
 */
async function testEventTypeParsing(): Promise<void> {
  const mockWebSocket = new MockWebSocketSender();
  const eventSync = new LiveStoreEventSyncService(
    {} as LiveStoreInstance, // Mock
    mockWebSocket,
    'test-org',
    'test-client'
  );
  
  // Test various event type formats
  const testCases = [
    { eventType: 'ProjectCreated', expected: { table: 'projects', operation: 'insert' } },
    { eventType: 'TaskUpdated', expected: { table: 'tasks', operation: 'update' } },
    { eventType: 'ClientDeleted', expected: { table: 'clients', operation: 'delete' } },
    { eventType: 'project.created', expected: { table: 'projects', operation: 'insert' } },
    { eventType: 'CREATE_TASK', expected: { table: 'tasks', operation: 'insert' } },
  ];
  
  for (const testCase of testCases) {
    // Use reflection to test private method
    const result = (eventSync as any).parseEventType(testCase.eventType);
    
    fileLog.info(`  ${testCase.eventType} → ${result.table}:${result.operation}`);
    
    if (result.table !== testCase.expected.table || result.operation !== testCase.expected.operation) {
      throw new Error(`Event type parsing failed for ${testCase.eventType}`);
    }
  }
  
  fileLog.info('  ✅ Event type parsing works correctly');
}

/**
 * Test event to TableChange conversion
 */
async function testEventConversion(): Promise<void> {
  const mockWebSocket = new MockWebSocketSender();
  const eventSync = new LiveStoreEventSyncService(
    {} as LiveStoreInstance, // Mock
    mockWebSocket,
    'test-org-123',
    'test-client-456'
  );
  
  // Test event conversion
  const testEvent = createMockEvent('ProjectCreated', {
    id: 'project-123',
    name: 'Test Project',
    status: 'active'
  });
  
  const tableChange = (eventSync as any).convertToTableChange(testEvent);
  
  fileLog.info('  Input event:', testEvent);
  fileLog.info('  Output TableChange:', tableChange);
  
  // Validate conversion
  const expected = {
    table: 'projects',
    operation: 'insert',
    orgId: 'test-org-123',
    clientId: 'test-client-456'
  };
  
  if (!tableChange || 
      tableChange.table !== expected.table ||
      tableChange.operation !== expected.operation ||
      tableChange.orgId !== expected.orgId ||
      tableChange.clientId !== expected.clientId) {
    throw new Error('Event conversion failed');
  }
  
  if (!tableChange.data ||
      tableChange.data.id !== 'project-123' ||
      tableChange.data.name !== 'Test Project' ||
      tableChange.data.clientId !== 'test-client-456') {
    throw new Error('Event data conversion failed');
  }
  
  fileLog.info('  ✅ Event conversion works correctly');
}

/**
 * Test integration with mock LiveStore
 */
async function testIntegration(): Promise<void> {
  const mockWebSocket = new MockWebSocketSender();
  
  // Create mock LiveStore with event stream
  const mockLiveStore = {
    store: {
      async *events() {
        // Simulate event stream
        yield createMockEvent('ProjectCreated', { id: '1', name: 'Project 1' });
        yield createMockEvent('TaskUpdated', { id: '2', title: 'Task 2', status: 'done' });
        yield createMockEvent('ClientDeleted', { id: '3' });
      }
    }
  } as LiveStoreInstance;
  
  const eventSync = new LiveStoreEventSyncService(
    mockLiveStore,
    mockWebSocket,
    'test-org',
    'test-client'
  );
  
  // Start event sync (this will process the mock events)
  const syncPromise = eventSync.startEventSync();
  
  // Give it a moment to process events
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Stop the sync
  eventSync.stopEventSync();
  
  // Wait for sync to complete
  await syncPromise;
  
  // Validate results
  fileLog.info('  Processed events:', mockWebSocket.sentMessages);
  
  if (mockWebSocket.sentMessages.length !== 3) {
    throw new Error(`Expected 3 events, got ${mockWebSocket.sentMessages.length}`);
  }
  
  const [projectEvent, taskEvent, clientEvent] = mockWebSocket.sentMessages;
  
  // Validate project event
  if (projectEvent.table !== 'projects' || projectEvent.operation !== 'insert') {
    throw new Error('Project event conversion failed');
  }
  
  // Validate task event
  if (taskEvent.table !== 'tasks' || taskEvent.operation !== 'update') {
    throw new Error('Task event conversion failed');
  }
  
  // Validate client event
  if (clientEvent.table !== 'clients' || clientEvent.operation !== 'delete') {
    throw new Error('Client event conversion failed');
  }
  
  fileLog.info('  ✅ Integration test passed');
}

/**
 * Demonstrate usage with the factory function
 */
export async function demonstrateUsage(): Promise<void> {
  fileLog.info('\n🎯 Demonstrating LiveStore Event Sync usage...');
  
  const mockWebSocket = new MockWebSocketSender();
  
  // Example 1: Simple usage
  fileLog.info('\n📝 Example 1: Simple usage');
  const mockLiveStore = {
    store: {
      async *events() {
        yield createMockEvent('ProjectCreated', { id: '123', name: 'Demo Project' });
      }
    }
  } as LiveStoreInstance;
  
  const eventSync = await createLiveStoreEventSync({
    orgId: 'demo-org',
    liveStoreInstance: mockLiveStore,
    webSocketSender: mockWebSocket,
    clientId: 'demo-client',
    autoStart: false // Don't auto-start for demo
  });
  
  fileLog.info('  Event sync created:', eventSync.getStatus());
  
  // Example 2: Manual control
  fileLog.info('\n🎮 Example 2: Manual control');
  
  // Start manually
  const syncPromise = eventSync.startEventSync();
  
  // Check status
  fileLog.info('  Status after start:', eventSync.getStatus());
  
  // Stop after a moment
  setTimeout(() => eventSync.stopEventSync(), 50);
  
  await syncPromise;
  
  fileLog.info('  Final status:', eventSync.getStatus());
  fileLog.info('  Messages sent:', mockWebSocket.sentMessages.length);
  
  fileLog.info('\n✅ Usage demonstration complete!');
}

/**
 * Performance test
 */
export async function testPerformance(): Promise<void> {
  fileLog.info('\n⚡ Testing LiveStore Event Sync performance...');
  
  const mockWebSocket = new MockWebSocketSender();
  
  // Generate many events
  const eventCount = 1000;
  const mockLiveStore = {
    store: {
      async *events() {
        for (let i = 0; i < eventCount; i++) {
          yield createMockEvent('ProjectCreated', { id: `project-${i}`, name: `Project ${i}` });
        }
      }
    }
  } as LiveStoreInstance;
  
  const eventSync = new LiveStoreEventSyncService(
    mockLiveStore,
    mockWebSocket,
    'perf-test-org',
    'perf-test-client'
  );
  
  const startTime = Date.now();
  
  // Process events
  const syncPromise = eventSync.startEventSync();
  
  // Wait a bit then stop
  setTimeout(() => eventSync.stopEventSync(), 200);
  
  await syncPromise;
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const processed = mockWebSocket.sentMessages.length;
  const eventsPerSecond = Math.round((processed / duration) * 1000);
  
  fileLog.info(`  Processed ${processed}/${eventCount} events in ${duration}ms`);
  fileLog.info(`  Performance: ${eventsPerSecond} events/second`);
  
  if (processed === 0) {
    throw new Error('No events were processed');
  }
  
  fileLog.info('  ✅ Performance test completed');
}

// Export test runner
export async function runAllTests(): Promise<void> {
  fileLog.info('🚀 Running all LiveStore Event Sync tests...\n');
  
  await testLiveStoreEventSync();
  await demonstrateUsage();
  await testPerformance();
  
  fileLog.info('\n🎉 All tests completed successfully!');
  fileLog.info('\n📋 Summary:');
  fileLog.info('  ✅ Event type parsing');
  fileLog.info('  ✅ Event conversion');
  fileLog.info('  ✅ Integration test');
  fileLog.info('  ✅ Usage demonstration');
  fileLog.info('  ✅ Performance test');
  fileLog.info('\n🚀 Ready for production use!');
}

// Make it available globally for testing in browser
if (typeof window !== 'undefined') {
  (window as any).testLiveStoreEventSync = {
    runAllTests,
    testLiveStoreEventSync,
    demonstrateUsage,
    testPerformance
  };
}