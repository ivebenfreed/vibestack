/**
 * PGlite React Provider
 * 
 * This file provides a React context provider for the PGlite database.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDatabase, getDatabase, dbMessageBus } from './db.ts';
import { getNewPGliteDataSource } from './newtypeorm/NewDataSource';
import { createRepositories } from './repositories';
import { createServices } from './services';
import { SyncManager } from '../sync/SyncManager';

// Create context with repositories and services
interface PGliteContextValue {
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  repositories?: any;
  services?: any;
}

const PGliteContext = createContext<PGliteContextValue>({
  isLoading: true,
  isReady: false,
  error: null,
  repositories: null,
  services: null
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
  // const [typeormInitialized, setTypeormInitialized] = useState(false); // No longer strictly needed at this level

  useEffect(() => {
    let isMounted = true;

    // Initialize states
    setIsLoading(true);
    setIsReady(false);
    setError(null);

    // Initialize TypeORM repositories and services (can be defined outside fullInitialize if preferred)
    async function initializeTypeormInternal() {
      // Get DataSource
      const dataSource = await getNewPGliteDataSource(); // eslint-disable-line @typescript-eslint/no-unused-vars
      // Create repositories
      const repos = await createRepositories();
      // Get SyncChangeManager
      const syncManager = SyncManager.getInstance();
      // Ensure SyncManager's own initialization is complete before accessing OutgoingChangeProcessor
      await syncManager.initialize();
      const outgoingChangeProcessor = syncManager.getOutgoingChangeProcessor();
      // Create services
      const svcs = createServices(repos, outgoingChangeProcessor);
      
      if (isMounted) {
        setRepositories(repos);
        setServices(svcs);
        // setTypeormInitialized(true); // Not needed here, fullInitialize handles overall readiness
      }
    }

    async function fullInitialize() {
      try {
        console.log('PGlite Provider: Starting full initialization...');

        // Step 1: Await PGlite worker & migration readiness
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

        // Step 2: Await TypeORM layer initialization
        console.log('PGlite Provider: Initializing TypeORM layer...');
        await initializeTypeormInternal();

        if (!isMounted) return;
        console.log('PGlite Provider: TypeORM layer initialized.');
        
        // Set final ready state
        if (isMounted) {
          setIsReady(true);
          setIsLoading(false);
          setError(null);
          console.log('PGlite Provider: Full initialization successful. isReady: true');
        }

      } catch (err) {
        if (isMounted) {
          console.error('PGlite Provider: Full initialization failed:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(false);
          setIsLoading(false);
        }
      }
    }

    fullInitialize();

    return () => {
      isMounted = false;
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
      services 
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