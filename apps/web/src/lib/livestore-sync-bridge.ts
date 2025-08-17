/**
 * LiveStore to Sync Protocol Bridge
 * 
 * Captures LiveStore mutations and feeds them into the existing sync protocol
 * by creating LocalChanges records that trigger outgoing sync messages.
 */

import { getLiveStoreClient } from './livestore-client';
import { trackOutgoingChange } from '../db/dexie-change-tracking';
import { db } from '../domain';
import { nanoid } from 'nanoid';

// Track if bridge is active to prevent loops
let bridgeActive = false;
let liveStoreEventListeners: Array<() => void> = [];

/**
 * Interface for LiveStore mutation events
 */
interface LiveStoreMutation {
  operation: 'insert' | 'update' | 'delete';
  tableName: string;
  recordId: string;
  data: any;
  organizationId: string;
  timestamp: Date;
}

/**
 * Map LiveStore table names to Dexie table names
 */
function mapLiveStoreTableToDexie(liveStoreTable: string): string | null {
  // LiveStore tables: org_01920000_1000_7000_8000_000000000001_project
  // Dexie tables: project
  
  const match = liveStoreTable.match(/^org_[a-f0-9_]+_(.+)$/);
  if (!match) return null;
  
  const entityType = match[1];
  
  // Map to standard Dexie table names
  const mapping: Record<string, string> = {
    'project': 'project',
    'client': 'client', 
    'timesheet': 'timesheet',
    'skill': 'skill',
    'task': 'task',
    'user': 'user',
    'comment': 'comment'
  };
  
  return mapping[entityType] || null;
}

/**
 * Convert LiveStore mutation to LocalChanges record format
 */
function createLocalChangeRecord(mutation: LiveStoreMutation): any {
  const dexieTable = mapLiveStoreTableToDexie(mutation.tableName);
  if (!dexieTable) {
    console.warn(`[LiveStore Bridge] Cannot map table: ${mutation.tableName}`);
    return null;
  }

  return {
    id: nanoid(),
    table: dexieTable,
    operation: mutation.operation,
    recordId: mutation.recordId,
    data: mutation.data,
    timestamp: mutation.timestamp.toISOString(),
    clientId: 'livestore-bridge',
    status: 'pending',
    clientSequence: `livestore-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    retryCount: 0
  };
}

/**
 * Handle LiveStore mutation by creating sync record
 */
async function handleLiveStoreMutation(mutation: LiveStoreMutation): Promise<void> {
  if (!bridgeActive) return;
  
  try {
    console.log(`[LiveStore Bridge] Processing ${mutation.operation} on ${mutation.tableName}:${mutation.recordId}`);
    
    // Create LocalChanges record
    const changeRecord = createLocalChangeRecord(mutation);
    if (!changeRecord) return;
    
    // Insert into Dexie LocalChanges table to trigger sync
    await db.local_changes.add(changeRecord);
    
    console.log(`[LiveStore Bridge] ✅ Created sync record for ${mutation.operation} on ${mutation.tableName}:${mutation.recordId}`);
    
    // Also update the actual Dexie table to keep data in sync
    const dexieTable = mapLiveStoreTableToDexie(mutation.tableName);
    if (dexieTable && (db as any)[dexieTable]) {
      const table = (db as any)[dexieTable];
      
      switch (mutation.operation) {
        case 'insert':
          await table.put(mutation.data);
          break;
        case 'update':
          await table.update(mutation.recordId, mutation.data);
          break;
        case 'delete':
          await table.delete(mutation.recordId);
          break;
      }
      
      console.log(`[LiveStore Bridge] ✅ Updated Dexie table ${dexieTable}`);
    }
    
    // Emit bridge event for monitoring
    window.dispatchEvent(new CustomEvent('livestore:bridge:synced', {
      detail: {
        mutation,
        changeRecord,
        success: true
      }
    }));
    
  } catch (error) {
    console.error(`[LiveStore Bridge] ❌ Failed to handle mutation:`, error);
    
    window.dispatchEvent(new CustomEvent('livestore:bridge:error', {
      detail: {
        mutation,
        error: error instanceof Error ? error.message : String(error)
      }
    }));
  }
}

/**
 * Monkey patch LiveStore client to intercept mutations
 */
function setupLiveStoreMutationHooks(): void {
  const liveStoreClient = getLiveStoreClient();
  if (!liveStoreClient) {
    console.warn('[LiveStore Bridge] No LiveStore client available for hooking');
    return;
  }

  // Store original methods
  const originalInsert = liveStoreClient.insert.bind(liveStoreClient);
  const originalUpdate = liveStoreClient.update.bind(liveStoreClient);
  const originalDelete = liveStoreClient.delete.bind(liveStoreClient);

  // Hook insert method
  liveStoreClient.insert = async function(tableName: string, data: any): Promise<void> {
    // Execute original operation
    await originalInsert(tableName, data);
    
    // Extract organization ID from table name or data
    const orgIdMatch = tableName.match(/^org_([a-f0-9_]+)_/);
    const organizationId = orgIdMatch ? orgIdMatch[1].replace(/_/g, '-') : data.organizationId || data.organization_id;
    
    // Create mutation record
    const mutation: LiveStoreMutation = {
      operation: 'insert',
      tableName,
      recordId: data.id,
      data,
      organizationId,
      timestamp: new Date()
    };
    
    // Handle via bridge
    await handleLiveStoreMutation(mutation);
  };

  // Hook update method  
  liveStoreClient.update = async function(tableName: string, id: string, data: any): Promise<void> {
    // Execute original operation
    await originalUpdate(tableName, id, data);
    
    // Extract organization ID from table name or data
    const orgIdMatch = tableName.match(/^org_([a-f0-9_]+)_/);
    const organizationId = orgIdMatch ? orgIdMatch[1].replace(/_/g, '-') : data.organizationId || data.organization_id;
    
    // Create mutation record
    const mutation: LiveStoreMutation = {
      operation: 'update',
      tableName,
      recordId: id,
      data: { ...data, id }, // Ensure ID is included
      organizationId,
      timestamp: new Date()
    };
    
    // Handle via bridge
    await handleLiveStoreMutation(mutation);
  };

  // Hook delete method
  liveStoreClient.delete = async function(tableName: string, id: string): Promise<void> {
    // Execute original operation
    await originalDelete(tableName, id);
    
    // Extract organization ID from table name
    const orgIdMatch = tableName.match(/^org_([a-f0-9_]+)_/);
    const organizationId = orgIdMatch ? orgIdMatch[1].replace(/_/g, '-') : 'unknown';
    
    // Create mutation record
    const mutation: LiveStoreMutation = {
      operation: 'delete',
      tableName,
      recordId: id,
      data: { id }, // Minimal data for delete
      organizationId,
      timestamp: new Date()
    };
    
    // Handle via bridge
    await handleLiveStoreMutation(mutation);
  };

  console.log('[LiveStore Bridge] ✅ Mutation hooks installed');
}

/**
 * Initialize the LiveStore to Sync bridge
 */
export async function initializeLiveStoreSyncBridge(): Promise<void> {
  if (bridgeActive) {
    console.log('[LiveStore Bridge] Already active');
    return;
  }

  try {
    // Wait for LiveStore to be ready
    const liveStoreClient = getLiveStoreClient();
    if (!liveStoreClient) {
      throw new Error('LiveStore client not available');
    }

    // Set up mutation hooks
    setupLiveStoreMutationHooks();
    
    bridgeActive = true;
    console.log('[LiveStore Bridge] ✅ Initialized - LiveStore mutations will now trigger sync');
    
    // Emit initialization event
    window.dispatchEvent(new CustomEvent('livestore:bridge:initialized'));
    
  } catch (error) {
    console.error('[LiveStore Bridge] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Shutdown the bridge
 */
export function shutdownLiveStoreSyncBridge(): void {
  bridgeActive = false;
  
  // Clean up event listeners
  liveStoreEventListeners.forEach(cleanup => cleanup());
  liveStoreEventListeners = [];
  
  console.log('[LiveStore Bridge] 🔌 Shutdown complete');
  
  window.dispatchEvent(new CustomEvent('livestore:bridge:shutdown'));
}

/**
 * Get bridge status
 */
export function getLiveStoreSyncBridgeStatus() {
  return {
    active: bridgeActive,
    hooksInstalled: bridgeActive,
    lastActivity: new Date()
  };
}

/**
 * Manually trigger a mutation (for testing)
 */
export async function triggerTestMutation(): Promise<void> {
  const liveStoreClient = getLiveStoreClient();
  if (!liveStoreClient) {
    throw new Error('LiveStore client not available');
  }

  const timestamp = Date.now();
  const testProject = {
    id: `bridge-test-${timestamp}`,
    name: `Bridge Test Project ${timestamp}`,
    description: `Created to test LiveStore→Sync bridge at ${new Date().toISOString()}`,
    organization_id: '01920000-1000-7000-8000-000000000001',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const tableName = 'org_01920000_1000_7000_8000_000000000001_project';
  
  console.log('[LiveStore Bridge] 🧪 Triggering test mutation...');
  await liveStoreClient.insert(tableName, testProject);
  
  return testProject;
}

// Auto-initialize when LiveStore becomes ready
if (typeof window !== 'undefined') {
  window.addEventListener('livestore:ready', () => {
    console.log('[LiveStore Bridge] LiveStore ready, initializing bridge...');
    initializeLiveStoreSyncBridge().catch(error => {
      console.error('[LiveStore Bridge] Failed to auto-initialize:', error);
    });
  });
}

export default {
  initialize: initializeLiveStoreSyncBridge,
  shutdown: shutdownLiveStoreSyncBridge,
  getStatus: getLiveStoreSyncBridgeStatus,
  triggerTestMutation
};