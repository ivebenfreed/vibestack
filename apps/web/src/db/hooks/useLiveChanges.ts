import { useState, useEffect, useRef } from 'react';
import { getDatabase } from '@/db/db';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

// Define the Change types based on PGlite documentation
export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface Change<T = any> {
  __op__: ChangeOperation;
  __changed_columns__: string[];
  __after__: number | undefined;
  [key: string]: any; // The actual entity data
}

export interface ChangeInsert<T> extends Change<T> {
  __op__: 'INSERT';
  __after__: number;
}

export interface ChangeUpdate<T> extends Change<T> {
  __op__: 'UPDATE';
  __after__: number;
}

export interface ChangeDelete<T> extends Change<T> {
  __op__: 'DELETE';
  __after__: undefined;
}

export type EntityChange<T> = ChangeInsert<T> | ChangeUpdate<T> | ChangeDelete<T>;

// State interface for the hook
interface LiveChangesState<T> {
  initialChanges: EntityChange<T>[] | null;
  fields: { name: string; dataTypeID: number }[] | null;
  loading: boolean;
  error: Error | null;
}

// Options interface
interface UseLiveChangesOptions {
  enabled?: boolean;
  transform?: boolean;
  onChanges?: (changes: EntityChange<any>[]) => void;
  skipInitialState?: boolean; // Skip setting initial changes state (useful when data comes from elsewhere)
}

/**
 * Optimized helper function to transform snake_case database fields to camelCase TypeScript objects.
 * Reuses the same cache and regex as the other hooks for consistency.
 */
const transformCache = new Map<string, string>();
const UNDERSCORE_REGEX = /_([a-z])/g;

function transformDatabaseResultToEntity<T extends ObjectLiteral>(
  row: Record<string, any>,
  entityName: string
): T {
  const result: Record<string, any> = {};
  const entityPrefix = entityName.toLowerCase() + '_';
  const entityPrefixLength = entityPrefix.length;
  
  const keys = Object.keys(row);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = row[key];
    
    // Handle prefixed fields (e.g., task_id -> id)
    if (key.startsWith(entityPrefix)) {
      const unprefixedKey = key.slice(entityPrefixLength);
      let camelCaseKey = transformCache.get(unprefixedKey);
      if (!camelCaseKey) {
        camelCaseKey = unprefixedKey.replace(UNDERSCORE_REGEX, (_, letter) => letter.toUpperCase());
        transformCache.set(unprefixedKey, camelCaseKey);
      }
      result[camelCaseKey] = value;
    } else {
      // Handle non-prefixed fields (direct snake_case to camelCase)
      let camelCaseKey = transformCache.get(key);
      if (!camelCaseKey) {
        camelCaseKey = key.replace(UNDERSCORE_REGEX, (_, letter) => letter.toUpperCase());
        transformCache.set(key, camelCaseKey);
      }
      result[camelCaseKey] = value;
    }
  }
  
  return result as T;
}

/**
 * React hook for subscribing to live changes using PGlite's live.changes() API.
 * 
 * This hook provides granular change notifications - only the actual changed rows
 * are returned with operation metadata (INSERT/UPDATE/DELETE). Perfect for:
 * - Real-time collaboration features
 * - Activity streams and notifications  
 * - Custom state management where you want manual control over updates
 * - Building reactive UIs that need to handle individual changes
 * 
 * Unlike live.query() and live.incrementalQuery() which return complete result sets,
 * this hook returns only the changes that occurred since the last update.
 */
export function useLiveChanges<T extends ObjectLiteral & { id: string }>(
  queryBuilder: SelectQueryBuilder<T> | null,
  keyColumn: string = 'id',
  options?: UseLiveChangesOptions
): LiveChangesState<T> & {
  onChanges: (handler: (changes: EntityChange<T>[]) => void) => void;
} {
  const [state, setState] = useState<LiveChangesState<T>>({
    initialChanges: null,
    fields: null,
    loading: options?.enabled !== false && !!queryBuilder,
    error: null
  });

  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const changeHandlersRef = useRef<Set<(changes: EntityChange<T>[]) => void>>(new Set());
  
  const enabled = !!queryBuilder && options?.enabled !== false;
  const shouldTransform = options?.transform !== false;

  // Extract entity name from query builder for transformation
  const entityName = queryBuilder?.expressionMap.mainAlias?.name || '';

  // Method to register change handlers
  const onChanges = (handler: (changes: EntityChange<T>[]) => void) => {
    changeHandlersRef.current.add(handler);
    
    // Return cleanup function
    return () => {
      changeHandlersRef.current.delete(handler);
    };
  };

  // Effect to set up the live changes subscription
  useEffect(() => {
    console.log('[useLiveChanges] useEffect triggered', { enabled, queryBuilder: !!queryBuilder });
    
    if (!enabled || !queryBuilder) {
      console.log('[useLiveChanges] Early return - enabled:', enabled, 'queryBuilder:', !!queryBuilder);
      setState({ initialChanges: null, fields: null, loading: false, error: null });
      return;
    }

    let isMounted = true;
    console.log('[useLiveChanges] Setting up live changes with PGlite...');

    const setupLiveChanges = async () => {
      try {
        console.log('[useLiveChanges] Starting setup...');
        
        // First set loading state
        if (isMounted) {
          setState(prev => ({ ...prev, loading: true, error: null }));
        }

        const db = await getDatabase();
        console.log('[useLiveChanges] Database obtained, checking live extension...', { 
          hasLive: !!db.live, 
          hasChanges: !!(db.live && db.live.changes) 
        });
        
        // Get the SQL and parameters from the query builder
        const [sql, params] = queryBuilder.getQueryAndParameters();
        console.log('[useLiveChanges] Watching SQL:', sql, 'with params:', params, 'key column:', keyColumn);
        
        // Check if the live extension and changes API are available
        if (!db.live || !db.live.changes) {
          throw new Error('Live changes API not available in PGlite instance');
        }

        console.log('[useLiveChanges] Database instance obtained with live changes support');
        
        // Set up the live changes subscription
        const liveChangesResult = await db.live.changes(
          sql, 
          params, 
          keyColumn,
          (changes: EntityChange<any>[]) => {
            console.log(`[useLiveChanges] Live changes update received: {changes: Array(${changes.length})}`);
            console.log(`[useLiveChanges] SQL was: ${sql}`);
            console.log(`[useLiveChanges] Key column: ${keyColumn}`);
            console.log('[useLiveChanges] Changes:', changes.map(c => ({
              op: c.__op__,
              id: c[keyColumn],
              changedColumns: c.__changed_columns__
            })));
            
            if (isMounted) {
              // Transform the changes if enabled
              let transformedChanges = changes;
              
              if (shouldTransform && entityName) {
                console.log('[useLiveChanges] Transforming snake_case to camelCase entities');
                const transformStartTime = performance.now();
                transformedChanges = changes.map((change: any) => {
                  const { __op__, __changed_columns__, __after__, ...entityData } = change;
                  const transformedData = transformDatabaseResultToEntity<T>(entityData, entityName);
                  
                  return {
                    __op__,
                    __changed_columns__,
                    __after__,
                    ...transformedData
                  } as EntityChange<T>;
                });
                const transformEndTime = performance.now();
                console.log(`[useLiveChanges] Changes transformation took ${transformEndTime - transformStartTime}ms for ${transformedChanges.length} changes`);
              }
              
              console.log('[useLiveChanges] Processed changes:', transformedChanges.length);
              
              // Call registered change handlers
              changeHandlersRef.current.forEach(handler => {
                try {
                  handler(transformedChanges);
                } catch (error) {
                  console.error('[useLiveChanges] Error in change handler:', error);
                }
              });
              
              // Call the options callback if provided
              if (options?.onChanges) {
                try {
                  options.onChanges(transformedChanges);
                } catch (error) {
                  console.error('[useLiveChanges] Error in options.onChanges callback:', error);
                }
              }
            }
          }
        );

        // Store the unsubscribe function
        unsubscribeRef.current = liveChangesResult.unsubscribe;
        
        // Set the initial state with initial changes and fields
        if (isMounted) {
          // Skip setting initial state if requested (useful when initial data comes from elsewhere)
          if (options?.skipInitialState) {
            console.log('[useLiveChanges] Skipping initial state update (skipInitialState=true)');
            setState(prev => ({ 
              ...prev,
              loading: false, 
              error: null 
            }));
          } else {
          let initialChanges = liveChangesResult.initialChanges || [];
          
          // Transform initial changes if enabled
          if (shouldTransform && entityName && initialChanges.length > 0) {
            console.log('[useLiveChanges] Transforming initial changes from snake_case to camelCase');
            const transformStartTime = performance.now();
            initialChanges = initialChanges.map((change: any) => {
              const { __op__, __changed_columns__, __after__, ...entityData } = change;
              const transformedData = transformDatabaseResultToEntity<T>(entityData, entityName);
              
              return {
                __op__,
                __changed_columns__,
                __after__,
                ...transformedData
              } as EntityChange<T>;
            });
            const transformEndTime = performance.now();
            console.log(`[useLiveChanges] Initial changes transformation took ${transformEndTime - transformStartTime}ms for ${initialChanges.length} changes`);
          }
          
          console.log('[useLiveChanges] Setting initial changes state:', initialChanges.length, 'changes');
          setState({ 
            initialChanges: initialChanges as EntityChange<T>[],
            fields: liveChangesResult.fields || null,
            loading: false, 
            error: null 
          });
          }
        }
        
        console.log('[useLiveChanges] Live changes setup complete');
      } catch (error) {
        console.error('[useLiveChanges] Error setting up live changes:', error);
        
        if (isMounted) {
          setState({ 
            initialChanges: null,
            fields: null,
            loading: false, 
            error: error instanceof Error ? error : new Error(String(error)) 
          });
        }
      }
    };

    setupLiveChanges();

    // Cleanup: unsubscribe from live changes
    return () => {
      isMounted = false;
      
      if (unsubscribeRef.current) {
        console.log('[useLiveChanges] Unsubscribing from live changes');
        unsubscribeRef.current().catch(err => {
          console.error('[useLiveChanges] Error unsubscribing from live changes:', err);
        });
        unsubscribeRef.current = null;
      }
      
      // Clear change handlers
      changeHandlersRef.current.clear();
    };
  }, [enabled, shouldTransform, entityName, keyColumn, queryBuilder && queryBuilder.getSql(), JSON.stringify(queryBuilder?.getParameters())]);
  
  return {
    ...state,
    onChanges
  };
} 