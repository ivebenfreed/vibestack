/**
 * LiveStore Provider - Organization-aware LiveStore initialization
 * Integrates with app init machine and auth state management
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/state-machines';
import { liveStoreSchemaClient } from '@/lib/livestore-schema-client';

interface LiveStoreProviderProps {
  children: React.ReactNode;
}

/**
 * LiveStore Provider
 * 
 * Responsibilities:
 * 1. Listen for database:check events from app init machine
 * 2. Initialize LiveStore (client database) when organization is selected
 * 3. Handle organization switching
 * 4. Send database:ready/error events back to app init machine
 */
export function LiveStoreProvider({ children }: LiveStoreProviderProps) {
  const { user, currentOrganization } = useAuth();
  const initializationRef = useRef<boolean>(false);
  
  useEffect(() => {
    console.log('[LiveStoreProvider] Setting up event listeners');
    
    const handleDatabaseCheck = async () => {
      console.log('[LiveStoreProvider] Received database:check event - initializing LiveStore');
      
      if (!user || !currentOrganization) {
        console.log('[LiveStoreProvider] No user or organization selected, skipping LiveStore init');
        // Send ready anyway since LiveStore is optional
        window.dispatchEvent(new CustomEvent('database:ready'));
        return;
      }
      
      // Prevent duplicate initialization
      if (initializationRef.current) {
        console.log('[LiveStoreProvider] LiveStore already initializing, skipping');
        return;
      }
      
      try {
        initializationRef.current = true;
        
        console.log(`[LiveStoreProvider] Initializing LiveStore for organization: ${currentOrganization.id}`);
        
        // Generate client ID for this session
        const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize LiveStore for the current organization
        const instance = await liveStoreSchemaClient.initializeLiveStore(
          currentOrganization.id,
          clientId
        );
        
        if (instance) {
          console.log('[LiveStoreProvider] ✅ LiveStore initialized successfully');
          
          // Notify app init machine that database (LiveStore) is ready
          window.dispatchEvent(new CustomEvent('database:ready', {
            detail: { 
              orgId: currentOrganization.id,
              clientId,
              instance
            }
          }));
          
          // Also fire livestore:ready for any components that might need it
          window.dispatchEvent(new CustomEvent('livestore:ready', {
            detail: { 
              orgId: currentOrganization.id,
              clientId,
              instance
            }
          }));
        } else {
          throw new Error('Failed to create LiveStore instance');
        }
        
      } catch (error) {
        console.error('[LiveStoreProvider] ❌ LiveStore initialization failed:', error);
        
        // Notify app init machine of database (LiveStore) error
        window.dispatchEvent(new CustomEvent('database:error', {
          detail: { 
            error: error instanceof Error ? error.message : 'LiveStore initialization failed',
            orgId: currentOrganization?.id
          }
        }));
        
        // Also fire livestore:error for any components that might need it
        window.dispatchEvent(new CustomEvent('livestore:error', {
          detail: { 
            error: error instanceof Error ? error.message : 'LiveStore initialization failed',
            orgId: currentOrganization?.id
          }
        }));
      } finally {
        initializationRef.current = false;
      }
    };
    
    // Listen for database check events from app init machine
    window.addEventListener('database:check', handleDatabaseCheck);
    
    // Cleanup
    return () => {
      window.removeEventListener('database:check', handleDatabaseCheck);
    };
  }, [user, currentOrganization]);
  
  // Handle organization switching
  useEffect(() => {
    if (!user || !currentOrganization) {
      return;
    }
    
    console.log(`[LiveStoreProvider] Organization changed to: ${currentOrganization.id}`);
    
    // If LiveStore was already initialized for a different org, switch
    const existingInstance = liveStoreSchemaClient.getLiveStoreInstance(currentOrganization.id);
    if (!existingInstance) {
      console.log('[LiveStoreProvider] Organization switched - will reinitialize on next init event');
    }
  }, [user, currentOrganization]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[LiveStoreProvider] Cleaning up all LiveStore instances');
      liveStoreSchemaClient.cleanup().catch(error => {
        console.error('[LiveStoreProvider] Error during cleanup:', error);
      });
    };
  }, []);
  
  return <>{children}</>;
}