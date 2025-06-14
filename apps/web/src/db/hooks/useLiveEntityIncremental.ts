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
 * Optimized helper function to transform snake_case database fields to camelCase TypeScript objects.
 * Uses memoization and optimized string operations for better performance.
 */
const transformCache = new Map<string, string>();

// Pre-compile regex for better performance
const UNDERSCORE_REGEX = /_([a-z])/g;

function transformDatabaseResultToEntity<T extends ObjectLiteral>(
  row: Record<string, any>,
  entityName: string
): T {
  const result: Record<string, any> = {};
  const entityPrefix = entityName.toLowerCase() + '_';
  const entityPrefixLength = entityPrefix.length;
  
  // Get all keys once to avoid repeated Object.keys() calls
  const keys = Object.keys(row);
  
  // Process each field in the row with optimized operations
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = row[key];
    
    // Handle prefixed fields (e.g., task_id -> id) - optimized string operations
    if (key.startsWith(entityPrefix)) {
      // Convert snake_case to camelCase and remove prefix - avoid substring allocation
      const unprefixedKey = key.slice(entityPrefixLength);
      let camelCaseKey = transformCache.get(unprefixedKey);
      if (!camelCaseKey) {
        camelCaseKey = unprefixedKey.replace(UNDERSCORE_REGEX, (_, letter) => letter.toUpperCase());
        transformCache.set(unprefixedKey, camelCaseKey);
      }
      result[camelCaseKey] = value;
    } else {
      // Handle non-prefixed fields (direct snake_case to camelCase) - use cached transformation
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
 * React hook for executing a query using TypeORM's query builder with PGlite's incremental live queries.
 * Uses PGlite's live.incrementalQuery functionality for better performance with large datasets.
 * 
 * The incremental query maintains a temporary table of the previous state inside Postgres.
 * When the tables it depends on change, the query is re-run and diffed with the last state.
 * Only the changes from the last version are copied from WASM into JS, providing better performance.
 */
export function useLiveEntityIncremental<T extends ObjectLiteral & { id: string; updatedAt?: Date | string; createdAt?: Date | string }>(
  queryBuilder: SelectQueryBuilder<T> | null,
  keyColumn: string = 'id', // ⚠️ IMPORTANT: Use SQL result column name (e.g., 'task_id' from TypeORM alias), NOT database column name
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
    // Reduced logging - uncomment below for debugging if needed
    // console.log('[useLiveEntityIncremental] useEffect triggered', { enabled, queryBuilder: !!queryBuilder });
    
    if (!enabled || !queryBuilder) {
      // Reduced logging - uncomment below for debugging if needed
      // console.log('[useLiveEntityIncremental] Early return - enabled:', enabled, 'queryBuilder:', !!queryBuilder);
      setState({ data: null, loading: false, error: null });
      return;
    }

    let isMounted = true;
    // Reduced logging - uncomment below for debugging if needed
    // console.log('[useLiveEntityIncremental] Setting up incremental live query with PGlite...');

    const setupIncrementalLiveQuery = async () => {
      try {
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Starting setup...');
        
        // First set loading state
        if (isMounted) {
          setState(prev => ({ ...prev, loading: true, error: null }));
        }

        const db = await getDatabase();
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Database obtained, checking live extension...', { hasLive: !!db.live, hasIncrementalQuery: !!(db.live && db.live.incrementalQuery) });
        
        // Get the SQL and parameters from the query builder first
        const [sql, params] = queryBuilder.getQueryAndParameters();
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Watching SQL:', sql, 'with params:', params, 'key column:', keyColumn);
        
        // Check if the live extension and incremental query are available
        if (!db.live || !db.live.incrementalQuery) {
          console.warn('[useLiveEntityIncremental] Incremental query not available, falling back to regular live query');
          
          // Fallback to regular live query
          const liveQueryResult = await db.live.query(sql, params, (results: Results<any>) => {
            // Reduced logging - uncomment below for debugging if needed
            // console.log('[useLiveEntityIncremental] Regular live query fallback update received:', results);
            
            if (isMounted) {
              // Format and transform the results
              let formattedResults = results.rows || [];
              
              // Apply transformation if enabled
              if (shouldTransform && entityName) {
                // Reduced logging - uncomment below for debugging if needed
                // console.log('[useLiveEntityIncremental] Transforming snake_case to camelCase entities (fallback)');
                const transformStartTime = performance.now();
                formattedResults = formattedResults.map((row: Record<string, any>) => 
                  transformDatabaseResultToEntity<T>(row, entityName)
                );
                const transformEndTime = performance.now();
                const transformTime = transformEndTime - transformStartTime;
                // Only log if transformation is slow
                if (transformTime > 10) {
                  console.warn(`[useLiveEntityIncremental] Slow fallback transformation: ${transformTime}ms for ${formattedResults.length} rows`);
                }
              }
              
              // Reduced logging - uncomment below for debugging if needed
              // console.log('[useLiveEntityIncremental] Processed fallback results:', formattedResults.length, 'rows');
              
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
            // Reduced logging - uncomment below for debugging if needed
            // console.log('[useLiveEntityIncremental] Setting initial fallback results:', liveQueryResult.initialResults.rows.length, 'rows');
            
            // Apply transformation to initial results if enabled
            let initialResults = liveQueryResult.initialResults.rows;
            
            if (shouldTransform && entityName) {
              // Reduced logging - uncomment below for debugging if needed
              // console.log('[useLiveEntityIncremental] Transforming initial fallback results from snake_case to camelCase');
              const transformStartTime = performance.now();
              initialResults = initialResults.map((row: Record<string, any>) => 
                transformDatabaseResultToEntity<T>(row, entityName)
              );
              const transformEndTime = performance.now();
              const transformTime = transformEndTime - transformStartTime;
              // Only log if transformation is slow
              if (transformTime > 10) {
                console.warn(`[useLiveEntityIncremental] Slow initial fallback transformation: ${transformTime}ms for ${initialResults.length} rows`);
              }
            }
            
            setState({ 
              data: initialResults, 
              loading: false, 
              error: null 
            });
          }
          
          // Reduced logging - uncomment below for debugging if needed
          // console.log('[useLiveEntityIncremental] Regular live query fallback setup complete');
          return;
        }

        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Database instance obtained with incremental live query support');
        
        // Set up the incremental live query
        const liveQueryResult = await db.live.incrementalQuery(
          sql, 
          params, 
          keyColumn, // The key column for diffing
          (results: Results<any>) => {
            // Reduced logging - uncomment below for debugging if needed
            // console.log(`[useLiveEntityIncremental] Incremental live query update received: {rows: Array(${results.rows?.length || 0})}`);
            // console.log(`[useLiveEntityIncremental] SQL was: ${sql}`);
            // console.log(`[useLiveEntityIncremental] Key column: ${keyColumn}`);
            
            if (isMounted) {
              // Format and transform the results
              let formattedResults = results.rows || [];
              
              // Apply transformation if enabled
              if (shouldTransform && entityName) {
                // Reduced logging - uncomment below for debugging if needed
                // console.log('[useLiveEntityIncremental] Transforming snake_case to camelCase entities');
                const transformStartTime = performance.now();
                formattedResults = formattedResults.map((row: Record<string, any>) => 
                  transformDatabaseResultToEntity<T>(row, entityName)
                );
                const transformEndTime = performance.now();
                const transformTime = transformEndTime - transformStartTime;
                // Only log if transformation is slow
                if (transformTime > 10) {
                  console.warn(`[useLiveEntityIncremental] Slow incremental transformation: ${transformTime}ms for ${formattedResults.length} rows`);
                }
              }
              
              // Reduced logging - uncomment below for debugging if needed
              // console.log('[useLiveEntityIncremental] Processed incremental results:', formattedResults.length, 'rows');
              
              // FIXED: incrementalQuery returns the FULL result set, not incremental changes
              // PGlite handles the incremental part internally - we just get the complete materialized view
              setState({
                data: formattedResults,
                loading: false,
                error: null
              });
              
              // Reduced logging - uncomment below for debugging if needed
              // console.log(`[useLiveEntityIncremental] Updated state with complete result set: ${formattedResults.length} rows`);
            }
          }
        );

        // Store the unsubscribe function
        unsubscribeRef.current = liveQueryResult.unsubscribe;
        
        // Set the initial results if we have them
        if (isMounted && liveQueryResult.initialResults?.rows) {
          // Reduced logging - uncomment below for debugging if needed
          // console.log('[useLiveEntityIncremental] Setting initial incremental results:', liveQueryResult.initialResults.rows.length, 'rows');
          
          // Apply transformation to initial results if enabled
          let initialResults = liveQueryResult.initialResults.rows;
          
          if (shouldTransform && entityName) {
            // Reduced logging - uncomment below for debugging if needed
            // console.log('[useLiveEntityIncremental] Transforming initial results from snake_case to camelCase');
            const transformStartTime = performance.now();
            initialResults = initialResults.map((row: Record<string, any>) => 
              transformDatabaseResultToEntity<T>(row, entityName)
            );
            const transformEndTime = performance.now();
            const transformTime = transformEndTime - transformStartTime;
            // Only log if transformation is slow
            if (transformTime > 10) {
              console.warn(`[useLiveEntityIncremental] Slow initial transformation: ${transformTime}ms for ${initialResults.length} rows`);
            }
          }
          
          setState({ 
            data: initialResults, 
            loading: false, 
            error: null 
          });
        }
        
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Incremental live query setup complete');
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
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntityIncremental] Unsubscribing from incremental live query');
        unsubscribeRef.current().catch(err => {
          console.error('[useLiveEntityIncremental] Error unsubscribing from incremental live query:', err);
        });
        unsubscribeRef.current = null;
      }
    };
  }, [enabled, shouldTransform, entityName, keyColumn, queryBuilder && queryBuilder.getSql(), JSON.stringify(queryBuilder?.getParameters())]);
  
  return state;
} 