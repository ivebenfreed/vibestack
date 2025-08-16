/**
 * Dexie React Provider
 * 
 * This file provides a React context provider for the Dexie database.
 * Replaces PGLite provider with Dexie-based implementation.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDexieDatabase, setupDexieDatabaseListeners } from './dexie-init';
import { db } from './dexie-schema';

// Create context with Dexie database access
interface DexieContextValue {
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  db: typeof db;
}

const DexieContext = createContext<DexieContextValue>({
  isLoading: true,
  isReady: false,
  error: null,
  db
});

// Hook to access Dexie context
export function useDexieContext() {
  return useContext(DexieContext);
}

interface DexieProviderProps {
  children: React.ReactNode;
}

/**
 * Vibestack Dexie Provider Component
 * 
 * This provider initializes Dexie database and provides context
 * about its status to the application.
 */
export function VibestackDexieProvider({ children }: DexieProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Initialize states
    setIsLoading(true);
    setIsReady(false);
    setError(null);

    async function fullInitialize() {
      try {
        const initStartTime = performance.now();
        console.log('Dexie Provider: Starting database initialization...');

        // Initialize Dexie database
        await initializeDexieDatabase();

        if (!isMounted) return;

        // Set final ready state
        setIsReady(true);
        setIsLoading(false);
        setError(null);
        
        const totalTime = performance.now() - initStartTime;
        console.log(`Dexie Provider: Initialization successful in ${totalTime}ms. isReady: true`);

      } catch (err) {
        if (isMounted) {
          console.error('Dexie Provider: Initialization failed:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(false);
          setIsLoading(false);
        }
      }
    }

    fullInitialize();

    // Set up database event listeners for XState coordination
    const cleanupListeners = setupDexieDatabaseListeners();

    // Handle database check events from XState
    const handleDatabaseCheck = () => {
      if (isReady && isMounted) {
        console.log('[Dexie Provider] XState database check - already ready, notifying');
        window.dispatchEvent(new CustomEvent('database:ready', { 
          detail: { 
            success: true, 
            alreadyReady: true,
            version: db.verno
          } 
        }));
      }
    };
    
    window.addEventListener('database:check', handleDatabaseCheck);

    return () => {
      isMounted = false;
      window.removeEventListener('database:check', handleDatabaseCheck);
      cleanupListeners();
    };
  }, []);

  // Context value
  const contextValue: DexieContextValue = {
    isLoading,
    isReady,
    error,
    db
  };

  return (
    <DexieContext.Provider value={contextValue}>
      {children}
    </DexieContext.Provider>
  );
}