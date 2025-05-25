import { useState, useEffect, useRef } from 'react';
import { getDatabase, Results } from '@/db/db';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

// Define the QueryState interface locally
interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Helper function to transform snake_case database fields to camelCase TypeScript objects.
 * This handles both direct fields and prefixed fields (like task_id -> id).
 */
function transformDatabaseResultToEntity<T extends ObjectLiteral>(
  row: Record<string, any>,
  entityName: string
): T {
  const result: Record<string, any> = {};
  const entityPrefix = entityName.toLowerCase() + '_';
  
  // Process each field in the row
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      
      // Handle prefixed fields (e.g., task_id -> id)
      if (key.startsWith(entityPrefix)) {
        // Convert snake_case to camelCase and remove prefix
        const unprefixedKey = key.substring(entityPrefix.length);
        const camelCaseKey = unprefixedKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelCaseKey] = value;
      } else {
        // Handle non-prefixed fields (direct snake_case to camelCase)
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelCaseKey] = value;
      }
    }
  }
  
  return result as T;
}

/**
 * React hook for executing a query using TypeORM's query builder with PGlite's incremental live queries.
 * Uses PGlite's live.incrementalQuery functionality for better performance with large datasets.
 * 
 * The incremental query maintains a temporary table of the previous state inside Postgres.
 * When the tables it depends on change, the query is re-run and diffed with the last state.
 * Only the changes from the last version are copied from WASM into JS, providing better performance.
 */
export function useLiveEntityIncremental<T extends ObjectLiteral & { id: string; updatedAt?: Date | string; createdAt?: Date | string }>(
  queryBuilder: SelectQueryBuilder<T> | null,
  keyColumn: string = 'id', // The column to key the diff algorithm on (usually primary key)
  options?: {
    enabled?: boolean;
    transform?: boolean; // Add option to control transformation
  }
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: options?.enabled !== false && !!queryBuilder,
    error: null
  });

  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const enabled = !!queryBuilder && options?.enabled !== false;
  const shouldTransform = options?.transform !== false; // Default to true if not specified

  // Extract entity name from query builder for transformation
  const entityName = queryBuilder?.expressionMap.mainAlias?.name || '';

  // Effect to set up the incremental live query
  useEffect(() => {
    console.log('[useLiveEntityIncremental] useEffect triggered', { enabled, queryBuilder: !!queryBuilder });
    
    if (!enabled || !queryBuilder) {
      console.log('[useLiveEntityIncremental] Early return - enabled:', enabled, 'queryBuilder:', !!queryBuilder);
      setState({ data: null, loading: false, error: null });
      return;
    }

    let isMounted = true;
    console.log('[useLiveEntityIncremental] Setting up incremental live query with PGlite...');

    const setupIncrementalLiveQuery = async () => {
      try {
        console.log('[useLiveEntityIncremental] Starting setup...');
        
        // First set loading state
        if (isMounted) {
          setState(prev => ({ ...prev, loading: true, error: null }));
        }

        const db = await getDatabase();
        console.log('[useLiveEntityIncremental] Database obtained, checking live extension...', { hasLive: !!db.live, hasIncrementalQuery: !!(db.live && db.live.incrementalQuery) });
        
        // Get the SQL and parameters from the query builder first
        const [sql, params] = queryBuilder.getQueryAndParameters();
        console.log('[useLiveEntityIncremental] Watching SQL:', sql, 'with params:', params, 'key column:', keyColumn);
        
        // Check if the live extension and incremental query are available
        if (!db.live || !db.live.incrementalQuery) {
          console.warn('[useLiveEntityIncremental] Incremental query not available, falling back to regular live query');
          
          // Fallback to regular live query
          const liveQueryResult = await db.live.query(sql, params, (results: Results<any>) => {
            console.log('[useLiveEntityIncremental] Regular live query fallback update received:', results);
            
            if (isMounted) {
              // Format and transform the results
              let formattedResults = results.rows || [];
              
              // Apply transformation if enabled
              if (shouldTransform && entityName) {
                console.log('[useLiveEntityIncremental] Transforming snake_case to camelCase entities (fallback)');
                formattedResults = formattedResults.map((row: Record<string, any>) => 
                  transformDatabaseResultToEntity<T>(row, entityName)
                );
              }
              
              console.log('[useLiveEntityIncremental] Processed fallback results:', formattedResults.length, 'rows');
              
              setState({
                data: formattedResults,
                loading: false,
                error: null
              });
            }
          });

          // Store the unsubscribe function
          unsubscribeRef.current = liveQueryResult.unsubscribe;
          
          // Set the initial results if we have them
          if (isMounted && liveQueryResult.initialResults?.rows) {
            console.log('[useLiveEntityIncremental] Setting initial fallback results:', liveQueryResult.initialResults.rows.length, 'rows');
            
            // Apply transformation to initial results if enabled
            let initialResults = liveQueryResult.initialResults.rows;
            
            if (shouldTransform && entityName) {
              console.log('[useLiveEntityIncremental] Transforming initial fallback results from snake_case to camelCase');
              initialResults = initialResults.map((row: Record<string, any>) => 
                transformDatabaseResultToEntity<T>(row, entityName)
              );
            }
            
            setState({ 
              data: initialResults, 
              loading: false, 
              error: null 
            });
          }
          
          console.log('[useLiveEntityIncremental] Regular live query fallback setup complete');
          return;
        }

        console.log('[useLiveEntityIncremental] Database instance obtained with incremental live query support');
        
        // Set up the incremental live query
        const liveQueryResult = await db.live.incrementalQuery(
          sql, 
          params, 
          keyColumn, // The key column for diffing
          (results: Results<any>) => {
            console.log('[useLiveEntityIncremental] Incremental live query update received:', results);
            
            if (isMounted) {
              // Format and transform the results
              let formattedResults = results.rows || [];
              
              // Apply transformation if enabled
              if (shouldTransform && entityName) {
                console.log('[useLiveEntityIncremental] Transforming snake_case to camelCase entities');
                formattedResults = formattedResults.map((row: Record<string, any>) => 
                  transformDatabaseResultToEntity<T>(row, entityName)
                );
              }
              
              console.log('[useLiveEntityIncremental] Processed incremental results:', formattedResults.length, 'rows');
              
              setState(prev => {
                // Check if data actually changed using JSON comparison
                const prevDataJson = JSON.stringify(prev.data);
                const newDataJson = JSON.stringify(formattedResults);
                
                if (prevDataJson === newDataJson) {
                  console.log('[useLiveEntityIncremental] No changes in incremental data');
                  return prev; // Don't update state if data is the same
                }
                
                console.log('[useLiveEntityIncremental] Incremental data changed, updating state');
                return { data: formattedResults, loading: false, error: null };
              });
            }
          }
        );

        // Store the unsubscribe function
        unsubscribeRef.current = liveQueryResult.unsubscribe;
        
        // Set the initial results if we have them
        if (isMounted && liveQueryResult.initialResults?.rows) {
          console.log('[useLiveEntityIncremental] Setting initial incremental results:', liveQueryResult.initialResults.rows.length, 'rows');
          
          // Apply transformation to initial results if enabled
          let initialResults = liveQueryResult.initialResults.rows;
          
          if (shouldTransform && entityName) {
            console.log('[useLiveEntityIncremental] Transforming initial results from snake_case to camelCase');
            initialResults = initialResults.map((row: Record<string, any>) => 
              transformDatabaseResultToEntity<T>(row, entityName)
            );
          }
          
          setState({ 
            data: initialResults, 
            loading: false, 
            error: null 
          });
        }
        
        console.log('[useLiveEntityIncremental] Incremental live query setup complete');
      } catch (error) {
        console.error('[useLiveEntityIncremental] Error setting up incremental live query:', error);
        
        if (isMounted) {
          setState({ 
            data: null, 
            loading: false, 
            error: error instanceof Error ? error : new Error(String(error)) 
          });
          
          // Fall back to a regular query if incremental live query fails
          try {
            console.log('[useLiveEntityIncremental] Falling back to regular query');
            const entities = await queryBuilder.getMany();
            
            if (isMounted) {
              setState({ data: entities, loading: false, error: null });
            }
          } catch (fallbackError) {
            console.error('[useLiveEntityIncremental] Fallback query failed:', fallbackError);
            if (isMounted) {
              setState({ 
                data: null, 
                loading: false, 
                error: fallbackError instanceof Error 
                  ? fallbackError 
                  : new Error(String(fallbackError)) 
              });
            }
          }
        }
      }
    };

    setupIncrementalLiveQuery();

    // Cleanup: unsubscribe from incremental live query
    return () => {
      isMounted = false;
      
      if (unsubscribeRef.current) {
        console.log('[useLiveEntityIncremental] Unsubscribing from incremental live query');
        unsubscribeRef.current().catch(err => {
          console.error('[useLiveEntityIncremental] Error unsubscribing from incremental live query:', err);
        });
        unsubscribeRef.current = null;
      }
    };
  }, [enabled, shouldTransform, entityName, keyColumn, queryBuilder && queryBuilder.getSql(), JSON.stringify(queryBuilder?.getParameters())]);
  
  return state;
} 