import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase, Results } from '@/db/db';
// import { PGliteQueryBuilder } from '../typeorm/PGliteQueryBuilder'; // REMOVED - Use standard TypeORM QB
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm'; // Import standard SelectQueryBuilder & ObjectLiteral

// Performance monitoring removed - using localized tracking when needed

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

function toCamelCase(str: string): string {
  if (transformCache.has(str)) {
    return transformCache.get(str)!;
  }
  
  const result = str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  transformCache.set(str, result);
  return result;
}

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
 * Chunked transformation to avoid blocking the main thread for large datasets
 */
async function transformResultsChunked<T extends ObjectLiteral>(
  rows: any[],
  entityName: string,
  chunkSize: number = 10 // Reduced from 25 to 10 for better responsiveness
): Promise<T[]> {
  const result: T[] = [];
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    // Transform chunk with performance timing
    const chunkStartTime = performance.now();
    const transformedChunk = chunk.map((row: Record<string, any>) => 
      transformDatabaseResultToEntity<T>(row, entityName)
    );
    const chunkEndTime = performance.now();
    
    result.push(...transformedChunk);
    
    // Log slow chunks for debugging
    const chunkTime = chunkEndTime - chunkStartTime;
    if (chunkTime > 5) {
      console.warn(`[useLiveEntity] Slow chunk transformation: ${chunkTime}ms for ${chunk.length} rows`);
    }
    
    // Yield control back to the event loop every chunk with shorter delay
    if (i + chunkSize < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 1)); // Reduced from 0 to 1ms for better yielding
    }
  }
  
  return result;
}

/**
 * Debounced transformation function to reduce main thread blocking
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for executing a query using TypeORM's query builder and automatically
 * updating when underlying data changes.
 * Uses PGlite's live query functionality to handle real-time updates.
 * Optimized for performance with debouncing and efficient transformations.
 */
export function useLiveEntity<T extends ObjectLiteral & { id: string; updatedAt?: Date | string; createdAt?: Date | string }>(
  queryBuilder: SelectQueryBuilder<T> | null,
  options?: {
    enabled?: boolean;
    transform?: boolean; // Add option to control transformation
    debounceMs?: number; // Add debounce option
  }
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: options?.enabled !== false && !!queryBuilder,
    error: null
  });

  // Performance monitoring removed - using localized tracking when needed

  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const queryIdRef = useRef<string | null>(null);
  const queryStartTimeRef = useRef<number | null>(null);
  const enabled = !!queryBuilder && options?.enabled !== false;
  const shouldTransform = options?.transform !== false; // Default to true if not specified
  const debounceMs = options?.debounceMs || 16; // Default 16ms (one frame)

  // Extract entity name from query builder for transformation
  const entityName = queryBuilder?.expressionMap.mainAlias?.name || '';

  // Memoized transformation function
  const transformResults = useCallback((rows: any[]): T[] => {
    if (!shouldTransform || !entityName) return rows;
    
    const startTime = performance.now();
    const transformed = rows.map((row: Record<string, any>) => 
      transformDatabaseResultToEntity<T>(row, entityName)
    );
    const endTime = performance.now();
    
    if (endTime - startTime > 10) { // Log if transformation takes >10ms
      console.warn(`[useLiveEntity] Slow transformation: ${endTime - startTime}ms for ${rows.length} rows`);
    }
    
    return transformed;
  }, [shouldTransform, entityName]);

  // Effect to set up the live query
  useEffect(() => {
    if (!enabled || !queryBuilder) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let isMounted = true;
    console.log('[useLiveEntity] Setting up live query with PGlite...');

    // Simplified tracking without global performance monitoring
    const queryId = `live-query-${entityName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    queryIdRef.current = queryId;
    queryStartTimeRef.current = Date.now();

    const setupLiveQuery = async () => {
      try {
        // First set loading state
        if (isMounted) {
          setState(prev => ({ ...prev, loading: true, error: null }));
        }

        const db = await getDatabase();
        
        // Check if the live extension is available
        if (!db.live || !db.live.query) {
          throw new Error('PGlite live query extension is not available');
        }

        console.log('[useLiveEntity] Database instance obtained with live query support');
        
        // Get the SQL and parameters from the query builder
        const [sql, params] = queryBuilder.getQueryAndParameters();
        console.log('[useLiveEntity] Watching SQL:', sql, 'with params:', params);

        // Set up the live query with optimized callback
        const liveQueryResult = await db.live.query(sql, params, (results: Results<any>) => {
          const updateStartTime = performance.now();
          // Reduced logging - uncomment below for debugging if needed
          // console.log('[useLiveEntity] Live query update received:', results);
          
          if (isMounted) {
            // Use Web Worker or async chunking for heavy transformations
            const processUpdate = async () => {
              const transformStartTime = performance.now();
              
              // Format and transform the results
              let formattedResults = results.rows || [];
              
              // Apply transformation if enabled with performance optimization
              if (shouldTransform && entityName) {
                // Reduced logging - only log for large datasets
                // console.log('[useLiveEntity] Transforming snake_case to camelCase entities');
                
                // For large datasets, chunk the transformation to avoid blocking
                if (formattedResults.length > 100) {
                  console.log(`[useLiveEntity] Large dataset detected (${formattedResults.length} rows), using chunked transformation`);
                  formattedResults = await transformResultsChunked(formattedResults, entityName);
                } else {
                  formattedResults = transformResults(formattedResults);
                }
              }
              
              const transformEndTime = performance.now();
              const transformTime = transformEndTime - transformStartTime;
              
              // Only log transformation time for debugging - reduced noise
              // console.log(`[useLiveEntity] Transformation took ${transformTime}ms for ${formattedResults.length} rows`);
              
              // Warn about slow transformations
              if (transformTime > 10) {
                console.warn(`[useLiveEntity] Slow transformation detected: ${transformTime}ms for ${formattedResults.length} rows in ${entityName}`);
              }
              
              setState(prev => {
                // Only update if the data has actually changed
                const stringifiedNew = JSON.stringify(formattedResults);
                const stringifiedOld = JSON.stringify(prev.data);
                
                if (stringifiedNew !== stringifiedOld) {
                  // Reduced logging - uncomment below for debugging if needed
                  // console.log('[useLiveEntity] Data changed, updating state');
                  
                  // Simplified performance warning for slow updates
                  const totalTime = performance.now() - updateStartTime;
                  const isSlowUpdate = totalTime > 50; // Flag slow updates
                  
                  // Log performance warning for slow updates
                  if (isSlowUpdate) {
                    console.warn(`[useLiveEntity] Slow live query update: ${totalTime}ms for ${entityName} (${formattedResults.length} rows)`);
                  }
                  
                  return { data: formattedResults, loading: false, error: null };
                }
                // Reduced logging - uncomment below for debugging if needed
                // console.log('[useLiveEntity] No changes in data');
                return { ...prev, loading: false };
              });
            };

            // Use scheduler API for better performance, with fallbacks
            if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
              // Use modern scheduler API for optimal performance
              (window as any).scheduler.postTask(processUpdate, { priority: 'user-blocking' });
            } else if ('requestIdleCallback' in window) {
              // Fallback to requestIdleCallback with shorter timeout to avoid blocking
              requestIdleCallback(processUpdate, { timeout: 50 });
            } else {
              // Final fallback with immediate scheduling
              setTimeout(processUpdate, 0);
            }
          }
        });

        // Store the unsubscribe function
        unsubscribeRef.current = liveQueryResult.unsubscribe;
        
        // Set the initial results if we have them
        if (isMounted && liveQueryResult.initialResults?.rows) {
          // Reduced logging - only log when data count is significant or for debugging
          // console.log('[useLiveEntity] Setting initial results:', liveQueryResult.initialResults.rows.length, 'rows');
          
          // Apply transformation to initial results if enabled
          let initialResults = liveQueryResult.initialResults.rows;
          
          if (shouldTransform && entityName) {
            // Reduced logging - uncomment below for debugging if needed
            // console.log('[useLiveEntity] Transforming initial results from snake_case to camelCase');
            initialResults = transformResults(initialResults);
          }
          
          setState({ 
            data: initialResults, 
            loading: false, 
            error: null 
          });

          // Simple performance warning for slow setups
          const setupTime = performance.now() - (queryStartTimeRef.current || Date.now());
          const isSlowSetup = setupTime > 200; // Flag slow initial setups
          
          // Log performance warning for slow setups
          if (isSlowSetup) {
            console.warn(`[useLiveEntity] Slow live query setup: ${setupTime}ms for ${entityName} (${initialResults.length} rows)`);
          }
        }
        
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntity] Live query setup complete');
      } catch (error) {
        console.error('[useLiveEntity] Error setting up live query:', error);
        
        // Error logged for debugging
        
        if (isMounted) {
          setState({ 
            data: null, 
            loading: false, 
            error: error instanceof Error ? error : new Error(String(error)) 
          });
          
          // Fall back to a regular query if live query fails
          try {
            console.log('[useLiveEntity] Falling back to regular query');
            const entities = await queryBuilder.getMany();
            
            if (isMounted) {
              setState({ data: entities, loading: false, error: null });
            }
          } catch (fallbackError) {
            console.error('[useLiveEntity] Fallback query failed:', fallbackError);
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

    setupLiveQuery();

    // Cleanup: unsubscribe from live query
    return () => {
      isMounted = false;
      
      if (unsubscribeRef.current) {
        // Reduced logging - uncomment below for debugging if needed
        // console.log('[useLiveEntity] Unsubscribing from live query');
        unsubscribeRef.current().catch(console.error);
        unsubscribeRef.current = null;
      }
      
      // Cleanup query tracking
      queryIdRef.current = null;
    };
  }, [enabled, queryBuilder, entityName, shouldTransform, transformResults]);
  
  return state;
} 