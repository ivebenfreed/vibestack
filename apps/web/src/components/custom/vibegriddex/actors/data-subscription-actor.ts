import { fromCallback, sendParent } from 'xstate';
import { db } from '@repo/dataforge/dexie-schema';
import { liveQuery } from 'dexie';

export interface DataSubscriptionInput {
  entityType: string;
}

/**
 * Actor that subscribes to Dexie table changes and sends updates to parent
 * This follows the established actor pattern in our XState architecture
 */
export const dataSubscriptionActor = fromCallback<any, DataSubscriptionInput>(({ input, sendBack }) => {
  console.log('📊 DataSubscriptionActor: Starting subscription', {
    entityType: input.entityType
  });

  // Get the table name from entity type
  let tableName = input.entityType + 's'; // e.g., 'task' -> 'tasks'
  
  // Handle manual mode where entityType might be 'unknown'
  // In this case, try to detect from the data or default to tasks for testing
  if (input.entityType === 'unknown') {
    console.log('📊 DataSubscriptionActor: Manual mode detected, defaulting to tasks table');
    tableName = 'tasks'; // Default to tasks for now
  }
  
  const table = (db as any)[tableName];

  if (!table) {
    console.warn('⚠️ DataSubscriptionActor: No table found for entity type:', input.entityType, 'tableName:', tableName);
    return () => {};
  }

  // Debounce timer to prevent multiple rapid updates
  let debounceTimer: NodeJS.Timeout | null = null;
  let lastData: any[] | null = null;

  // Subscribe to table changes
  const subscription = liveQuery(() => table.toArray()).subscribe({
    next: (data) => {
      // Store the latest data
      lastData = data;
      
      // Clear any existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set a new timer to send the update after a short delay
      debounceTimer = setTimeout(() => {
        if (lastData) {
          console.log('📊 DataSubscriptionActor: Data update received (debounced)', {
            entityType: input.entityType,
            entityCount: lastData.length
          });
          
          // Send update event to parent
          sendBack({ type: 'DATA_UPDATE', data: lastData });
        }
      }, 100); // 100ms debounce
    },
    error: (error) => {
      console.error('❌ DataSubscriptionActor: Subscription error:', error);
      sendBack({ type: 'DATA_SUBSCRIPTION_ERROR', error });
    }
  });

  // Return cleanup function
  return () => {
    console.log('🔄 DataSubscriptionActor: Cleaning up subscription');
    
    // Clear any pending timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    subscription.unsubscribe();
  };
});