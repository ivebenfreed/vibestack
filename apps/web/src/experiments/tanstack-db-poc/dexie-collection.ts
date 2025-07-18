import { createCollection } from '@tanstack/react-db';
import Dexie from 'dexie';
import type { StandardSchemaV1 } from '@standard-schema/spec';

interface DexieCollectionOptions<T extends { id: string }, TInsertInput = T> {
  dbName: string;
  tableName: string;
  schema?: StandardSchemaV1;
  getKey?: (item: T) => string;
}

// Create a Dexie-backed collection using TanStack DB's createCollection
export function createDexieCollection<T extends { id: string }, TInsertInput = T>(
  options: DexieCollectionOptions<T, TInsertInput>
) {
  const db = new Dexie(options.dbName);
  
  // Define schema - for POC, we'll use a simple id-based schema
  db.version(1).stores({
    [options.tableName]: 'id',
  });

  const table = db.table<T>(options.tableName);

  // Create collection with Dexie persistence
  const collection = createCollection<T, string, {}, StandardSchemaV1, TInsertInput>({
    id: options.tableName,
    getKey: options.getKey || ((item) => item.id),
    schema: options.schema,
    
    // Use onInsert/onUpdate/onDelete for persistence
    onInsert: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        if (mutation.type === 'insert') {
          await table.put(mutation.modified);
        }
      }
    },
    
    onUpdate: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        if (mutation.type === 'update') {
          await table.put(mutation.modified);
        }
      }
    },
    
    onDelete: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        if (mutation.type === 'delete') {
          await table.delete(mutation.key);
        }
      }
    },
    
    // Sync configuration - just mark as ready since we'll handle persistence differently
    sync: {
      sync: async (collection) => {
        try {
          console.log('Starting sync for collection:', options.tableName);
          
          // For now, just mark as ready - we'll load data after sync starts
          // This is because syncedData might not be available during initial sync
          collection.markReady();
          
          console.log('Sync completed for collection:', options.tableName);
        } catch (error) {
          console.error('Error during sync:', error);
        }
        
        // Return cleanup function
        return () => {
          // Cleanup if needed
        };
      },
    },
  });

  // Return the collection with additional helper methods
  // We need to be careful not to lose the prototype chain
  const enhancedCollection = Object.assign(collection, {
    // Clear all data
    async clear() {
      await table.clear();
      // Clear the collection data by deleting all items
      const keys = Array.from(collection.state.keys());
      for (const key of keys) {
        collection.delete(key);
      }
    },

    // Get table stats
    async getStats() {
      const count = await table.count();
      return {
        count,
        tableName: options.tableName,
      };
    },

    // Direct table access for debugging
    get dexieTable() {
      return table;
    },
  });

  // Add a method to load data from Dexie
  enhancedCollection.loadFromDexie = async () => {
    console.log('Loading data from Dexie...');
    const data = await table.toArray();
    console.log(`Found ${data.length} items in Dexie`);
    
    // Insert each item into the collection
    for (const item of data) {
      try {
        // Check if item already exists to avoid duplicates
        if (!enhancedCollection.state.has(item.id)) {
          enhancedCollection.insert(item);
        }
      } catch (error) {
        console.error('Error loading item:', item.id, error);
      }
    }
    
    console.log('Finished loading from Dexie');
  };

  // Start sync immediately if the method exists
  if (typeof enhancedCollection.startSyncImmediate === 'function') {
    enhancedCollection.startSyncImmediate();
    
    // Once ready, load data from Dexie
    enhancedCollection.onFirstReady(() => {
      enhancedCollection.loadFromDexie();
    });
  }

  return enhancedCollection;
}