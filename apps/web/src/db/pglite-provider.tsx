/**
 * PGlite React Provider
 * 
 * This file provides a React context provider for the PGlite database.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initializeDatabase, getDatabase, dbMessageBus } from './db.ts';
import { getNewPGliteDataSource, NewPGliteDataSource } from './newtypeorm/NewDataSource';
import { EntityTarget, Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { createAllDomains } from '../domain/lib';

// Create context with repositories and services
interface PGliteContextValue {
  // Existing properties
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  repositories?: any;
  services?: any;
  
  // New DataSource centralization properties
  dataSource?: NewPGliteDataSource | null;
  isDataSourceReady: boolean;
  
  // Helper methods for safe DataSource access
  getRepository?: <T extends ObjectLiteral>(target: EntityTarget<T>) => Repository<T>;
  createQueryBuilder?: <T extends ObjectLiteral>(entityTarget?: EntityTarget<T>, alias?: string) => SelectQueryBuilder<T>;
  query?: (sql: string, parameters?: any[]) => Promise<any>;
  waitForDataSource?: () => Promise<NewPGliteDataSource>;
}

const PGliteContext = createContext<PGliteContextValue>({
  isLoading: true,
  isReady: false,
  error: null,
  repositories: null,
  services: null,
  dataSource: null,
  isDataSourceReady: false
});

// Hook to access PGlite context
export function usePGliteContext() {
  return useContext(PGliteContext);
}

interface PGliteProviderProps {
  children: React.ReactNode;
}

/**
 * Vibestack PGlite Provider Component
 * 
 * This provider initializes both legacy PGlite and TypeORM and provides context
 * about its status to the application.
 */
export function VibestackPGliteProvider({ children }: PGliteProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [repositories, setRepositories] = useState<any>(null);
  const [services, setServices] = useState<any>(null);
  const [dataSource, setDataSource] = useState<NewPGliteDataSource | null>(null);
  const [isDataSourceReady, setIsDataSourceReady] = useState(false);
  // const [typeormInitialized, setTypeormInitialized] = useState(false); // No longer strictly needed at this level

  // Helper methods for safe DataSource access
  const getRepository = useCallback(<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not ready. Use waitForDataSource() first or check isDataSourceReady.');
    }
    return dataSource.getRepository(target);
  }, [dataSource]);

  const createQueryBuilder = useCallback(<T extends ObjectLiteral>(
    entityTarget?: EntityTarget<T>, 
    alias?: string
  ): SelectQueryBuilder<T> => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not ready. Use waitForDataSource() first or check isDataSourceReady.');
    }
    return dataSource.createQueryBuilder(entityTarget, alias);
  }, [dataSource]);

  const query = useCallback(async (sql: string, parameters?: any[]): Promise<any> => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not ready. Use waitForDataSource() first or check isDataSourceReady.');
    }
    return dataSource.query(sql, parameters);
  }, [dataSource]);

  const waitForDataSource = useCallback((): Promise<NewPGliteDataSource> => {
    return new Promise((resolve, reject) => {
      if (dataSource && dataSource.isInitialized) {
        resolve(dataSource);
        return;
      }
      
      // Set up a listener for when DataSource becomes ready
      const checkInterval = setInterval(() => {
        if (dataSource && dataSource.isInitialized) {
          clearInterval(checkInterval);
          resolve(dataSource);
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('DataSource initialization timeout after 30 seconds'));
      }, 30000);
    });
  }, [dataSource]);

  useEffect(() => {
    let isMounted = true;

    // Initialize states
    setIsLoading(true);
    setIsReady(false);
    setError(null);

    // Initialize TypeORM repositories and services (can be defined outside fullInitialize if preferred)
    async function initializeTypeormInternal() {
      // ✅ FIXED: Use global datasource singleton to prevent race conditions
      const { getGlobalDataSource } = await import('./global-datasource');
      
      const dsStartTime = performance.now();
      const ds = await getGlobalDataSource();
      const dsEndTime = performance.now();
      console.log(`PGlite Provider: DataSource obtained in ${dsEndTime - dsStartTime}ms, initialized:`, ds.isInitialized);
      
      // ✅ ARCHITECTURAL IMPROVEMENT: Remove sync initialization from database layer
      // The database layer should not know about sync. Sync should be handled separately by the orchestrator.
      // For now, we pass null to domain factory which will create a no-op sync manager
      console.log('PGlite Provider: Using no-op sync tracking (sync handled by orchestrator)');
      
      // Create all domains using the new factory with null sync manager (creates no-op)
      const domains = createAllDomains(ds, null);
      
      // Extract repositories and services for backward compatibility
      const repos = {
        users: domains.user.repository,
        projects: domains.project.repository,
        tasks: domains.task.repository,
        comments: domains.comment.repository
      };
      
      const svcs = {
        users: domains.user.service,
        projects: domains.project.service,
        tasks: domains.task.service,
        comments: domains.comment.service
      };
      
      if (isMounted) {
        setDataSource(ds);
        setIsDataSourceReady(ds.isInitialized);
        setRepositories(repos);
        setServices(svcs);
        console.log('PGlite Provider: DataSource and services set in state');
        // setTypeormInitialized(true); // Not needed here, fullInitialize handles overall readiness
      }
    }

    async function fullInitialize() {
      try {
        const initStartTime = performance.now();
        console.log('PGlite Provider: Starting full initialization...');

        // Step 1: Await PGlite worker & migration readiness
        const pgliteStartTime = performance.now();
        console.log('PGlite Provider: Starting PGlite worker initialization...');
        await new Promise<void>((resolve, reject) => {
          const unsubInitialized = dbMessageBus.subscribe('initialized', () => {
            if (isMounted) {
              console.log('PGlite Provider: PGlite worker and migrations complete.');
              cleanupSubscriptions();
              resolve();
            }
          });

          const unsubError = dbMessageBus.subscribe('error', (data) => {
            if (isMounted) {
              console.error('PGlite Provider: PGlite worker initialization error.', data.error);
              cleanupSubscriptions();
              reject(data.error || new Error('Unknown PGlite database error'));
            }
          });

          const cleanupSubscriptions = () => {
            unsubInitialized();
            unsubError();
          };

          // Check if database is already initialized, otherwise initialize
          getDatabase()
            .then(() => {
              if (isMounted) {
                // Already initialized by a previous instance or faster path
                console.log('PGlite Provider: PGlite worker was already initialized.');
                cleanupSubscriptions();
                resolve();
              }
            })
            .catch(async () => {
              // Not initialized, start initialization
              if (isMounted) {
                console.log('PGlite Provider: PGlite worker not initialized, starting initialization...');
                try {
                  await initializeDatabase();
                  // Success will be handled by the 'initialized' event listener
                } catch (initDbError) {
                  if (isMounted) {
                    console.error('PGlite Provider: initializeDatabase() call failed.', initDbError);
                    cleanupSubscriptions();
                    reject(initDbError);
                  }
                }
              }
            });
        });

        if (!isMounted) return;

        const pgliteEndTime = performance.now();
        console.log(`PGlite Provider: PGlite initialization took ${pgliteEndTime - pgliteStartTime}ms`);

        // Step 2: Await TypeORM layer initialization
        const typeormStartTime = performance.now();
        console.log('PGlite Provider: Initializing TypeORM layer...');
        await initializeTypeormInternal();

        if (!isMounted) return;
        
        const typeormEndTime = performance.now();
        console.log(`PGlite Provider: TypeORM initialization took ${typeormEndTime - typeormStartTime}ms`);
        console.log('PGlite Provider: TypeORM layer initialized.');
        
        // 🔥 XSTATE COORDINATION: Live changes initialization is now handled by LiveChangesProvider
        // This ensures proper coordination through XState rather than racing initialization paths
        console.log('PGlite Provider: Live changes will be initialized by XState LiveChangesProvider');
        
        // Set final ready state
        if (isMounted) {
          setIsReady(true);
          setIsLoading(false);
          setError(null);
          const totalTime = performance.now() - initStartTime;
          console.log(`PGlite Provider: Full initialization successful in ${totalTime}ms. isReady: true`);
          
          // 🔥 XSTATE INTEGRATION: Notify XState machine that database is ready
          console.log('[PGlite Provider] 🔥 Dispatching database:ready event to XState');
          window.dispatchEvent(new CustomEvent('database:ready', { 
            detail: { 
              success: true, 
              initTime: totalTime 
            } 
          }));
        }

      } catch (err) {
        if (isMounted) {
          console.error('PGlite Provider: Full initialization failed:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(false);
          setIsLoading(false);
          
          // 🔥 XSTATE INTEGRATION: Notify XState machine of database error
          window.dispatchEvent(new CustomEvent('database:error', { 
            detail: { 
              error: err instanceof Error ? err.message : String(err)
            } 
          }));
        }
      }
    }

    fullInitialize();

    // 🔥 XSTATE INTEGRATION: Listen for database check events
    const handleDatabaseCheck = () => {
      if (isReady && isMounted) {
        console.log('[PGlite Provider] XState database check - already ready, notifying');
        window.dispatchEvent(new CustomEvent('database:ready', { 
          detail: { 
            success: true, 
            alreadyReady: true 
          } 
        }));
      }
    };
    
    window.addEventListener('database:check', handleDatabaseCheck);

    return () => {
      isMounted = false;
      window.removeEventListener('database:check', handleDatabaseCheck);
      // Note: dbMessageBus subscriptions are cleaned up within the Promise logic
      // or if fullInitialize completes/errors before unmount.
      // If there's a desire for a more robust global unsubscription,
      // dbMessageBus would need to support returning unsubscribe functions
      // that can be called here regardless of the promise state.
      // For now, the local cleanup in the promise should cover most cases.
      console.log('PGlite Provider: Unmounted.');
    };
  }, []);

  // Provide context to children with repositories and services
  return (
    <PGliteContext.Provider value={{
      isLoading, 
      isReady, 
      error,
      repositories,
      services,
      dataSource,
      isDataSourceReady,
      getRepository,
      createQueryBuilder,
      query,
      waitForDataSource
    }}>
      {children}
    </PGliteContext.Provider>
  );
}

/**
 * Minimal PGlite Provider for testing and specific use cases
 */
export function MinimalPGliteProvider({ children }: PGliteProviderProps) {
  return <>{children}</>;
} 