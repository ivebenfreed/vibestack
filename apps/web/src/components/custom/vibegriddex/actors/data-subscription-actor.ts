import { fromCallback, sendParent } from 'xstate';
import { db } from '@repo/dataforge/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';

export interface DataSubscriptionInput {
  entityType: string;
  includeRelationships?: boolean;
}

/**
 * Actor that subscribes to Dexie table changes and sends updates to parent
 * Now handles both main entity data and relationship data for a unified subscription model
 */
export const dataSubscriptionActor = fromCallback<any, DataSubscriptionInput>(({ input, sendBack }) => {
  console.log('📊 DataSubscriptionActor: Starting subscription', {
    entityType: input.entityType,
    includeRelationships: input.includeRelationships
  });

  const subscriptions: Subscription[] = [];
  const debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  const lastDataMap: Map<string, any[]> = new Map();

  // Helper to create a subscription for a table
  const subscribeToTable = (tableName: string, tableKey: string, isMainEntity: boolean = false) => {
    const table = (db as any)[tableName];
    if (!table) {
      console.warn('⚠️ DataSubscriptionActor: No table found:', tableName);
      return;
    }

    let isFirstEmission = true; // Track first emission per subscription

    const subscription = liveQuery(() => table.toArray()).subscribe({
      next: (data) => {
        // For first emission, send data immediately without debounce
        if (isFirstEmission) {
          isFirstEmission = false;
          console.log('📊 DataSubscriptionActor: First emission for table:', tableKey, {
            entityCount: data.length,
            isMainEntity
          });
          
          // Send initial data immediately
          sendBack({ 
            type: isMainEntity ? 'DATA_UPDATE' : 'RELATIONSHIP_DATA_UPDATE',
            table: tableKey,
            data: data 
          });
          return;
        }
        // Store the latest data
        lastDataMap.set(tableKey, data);
        
        // Clear any existing timer for this table
        const existingTimer = debounceTimers.get(tableKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // Set a new timer to send the update after a short delay
        const timer = setTimeout(() => {
          const latestData = lastDataMap.get(tableKey);
          if (latestData) {
            console.log('📊 DataSubscriptionActor: Data update received (debounced)', {
              table: tableKey,
              entityCount: latestData.length,
              isMainEntity,
              eventType: isMainEntity ? 'DATA_UPDATE' : 'RELATIONSHIP_DATA_UPDATE',
              sampleData: latestData.length > 0 ? latestData[0] : null,
              firstThreeIds: latestData.slice(0, 3).map(item => item.id)
            });
            
            // Send update event to parent with table identifier
            sendBack({ 
              type: isMainEntity ? 'DATA_UPDATE' : 'RELATIONSHIP_DATA_UPDATE',
              table: tableKey,
              data: latestData 
            });
          }
        }, 100); // 100ms debounce
        
        debounceTimers.set(tableKey, timer);
      },
      error: (error) => {
        console.error('❌ DataSubscriptionActor: Subscription error:', error, 'for table:', tableKey);
        sendBack({ type: 'DATA_SUBSCRIPTION_ERROR', error, table: tableKey });
      }
    });

    subscriptions.push(subscription);
  };

  // Subscribe to main entity table
  const mainTableName = input.entityType + 's'; // e.g., 'task' -> 'tasks'
  subscribeToTable(mainTableName, mainTableName, true); // true = this is the main entity table

  // Subscribe to relationship tables if requested
  if (input.includeRelationships) {
    // Get relationship tables based on entity type
    const relationshipTables = getRelationshipTablesForEntity(input.entityType);
    
    relationshipTables.forEach(relTable => {
      // Skip if this is the main table (shouldn't happen but just in case)
      if (relTable === mainTableName) return;
      
      console.log('📊 DataSubscriptionActor: Subscribing to relationship table:', relTable);
      subscribeToTable(relTable, relTable, false); // false = relationship table
    });
  }

  // Return cleanup function
  return () => {
    console.log('🔄 DataSubscriptionActor: Cleaning up all subscriptions');
    
    // Clear all pending timers
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
    
    // Clear stored data
    lastDataMap.clear();
    
    // Unsubscribe from all tables
    subscriptions.forEach(sub => sub.unsubscribe());
  };
});

/**
 * Get relationship tables that should be subscribed to for a given entity type
 */
function getRelationshipTablesForEntity(entityType: string): string[] {
  // Common relationships across all entities
  const commonRelationships = ['users', 'status_definitions', 'tag_sets', 'tags'];
  
  // Entity-specific relationships
  switch (entityType) {
    case 'task':
      return [...commonRelationships, 'projects'];
    case 'project':
      return commonRelationships;
    case 'comment':
      return [...commonRelationships, 'tasks', 'projects'];
    case 'user':
      return ['status_definitions', 'tag_sets', 'tags']; // Users don't need to subscribe to themselves
    default:
      return commonRelationships;
  }
}