/**
 * SyncActors - Extracted actor implementations from sync-machine-v3.ts
 * 
 * Contains all complex actor logic to reduce sync machine size.
 * Provides clean, testable actor implementations for async operations.
 */

import { fromPromise } from 'xstate';
import { ServiceCoordinator, Services } from './ServiceCoordinator';
import { syncLogger } from './SyncLogger';
import { getSyncWebSocketUrl } from '../config';

export const syncActors = {
  /**
   * Initialize services using ServiceCoordinator
   */
  initializeServices: fromPromise(async ({ input }: {
    input: { serverUrl: string; clientId: string; currentLSN: string }
  }): Promise<{ serviceCoordinator: ServiceCoordinator; services: Services }> => {
    syncLogger.info('service', 'Phase 3: Initializing services with ServiceCoordinator...', input);
    
    const serviceCoordinator = new ServiceCoordinator();
    
    const coordinatorConfig = {
      clientId: input.clientId,
      currentLSN: input.currentLSN,
      serverUrl: input.serverUrl,
      autoResetOnFailure: true, // Enable auto-reset for integrity failures
      enableDexieSync: true // Enable parallel Dexie sync
    };
    
    await serviceCoordinator.initialize(coordinatorConfig);
    
    const services = serviceCoordinator.getServices();
    if (!services) {
      throw new Error('ServiceCoordinator failed to initialize services');
    }
    
    syncLogger.serviceInitialized('ServiceCoordinator', {
      webSocket: !!services.webSocket,
      incoming: !!services.incoming,
      outgoing: !!services.outgoing,
      dexieOutgoing: !!services.dexieOutgoing,
      integrity: !!services.integrity
    });
    
    return { serviceCoordinator, services };
  }),

  /**
   * Connect WebSocket and wait for ready state
   */
  connectWebSocket: fromPromise(async ({ input }: {
    input: { serverUrl: string; serviceCoordinator: ServiceCoordinator }
  }): Promise<{ serverLSN: string }> => {
    const services = input.serviceCoordinator.getServices();
    if (!services?.webSocket) {
      throw new Error('WebSocket service not available for connection');
    }
    
    syncLogger.info('connection', 'Starting WebSocket connection...', { url: input.serverUrl });
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket connection timeout (10 seconds)'));
      }, 10000);
      
      // Set up connection status monitoring
      services.webSocket.setCallbacks({
        onStatusChange: (status: string, data: any) => {
          syncLogger.debug('connection', `WebSocket status: ${status}`, data);
          
          if (status === 'connected') {
            clearTimeout(timeoutId);
            resolve({
              serverLSN: data?.serverLSN || '0/0'
            });
          } else if (status === 'error') {
            clearTimeout(timeoutId);
            reject(new Error('WebSocket connection failed'));
          }
        },
        onError: (error: any) => {
          clearTimeout(timeoutId);
          syncLogger.serviceError('WebSocket', error as Error, 'connection');
          reject(error);
        }
      });
      
      services.webSocket.connect(input.serverUrl);
    });
  }),

  /**
   * Perform pre-live validation with outgoing changes and integrity checks
   */
  performPreLiveValidation: fromPromise(async ({ input }: {
    input: { serviceCoordinator: ServiceCoordinator; clientId: string }
  }): Promise<{ success: boolean }> => {
    const { serviceCoordinator, clientId } = input;
    const services = serviceCoordinator?.getServices();
    
    if (!services) {
      throw new Error('Services not available for pre-live validation');
    }
    
    syncLogger.info('validation', 'Starting pre-live validation...');
    
    // Step 1: Check and send pending outgoing changes
    try {
      // Handle both old TypeORM system and new Dexie system
      if (services.outgoing) {
        // Old system
        const pendingCount = services.outgoing.getPendingChangesCount();
        if (pendingCount > 0) {
          syncLogger.info('validation', `Sending ${pendingCount} pending outgoing changes`);
          await services.outgoing.sendQueuedChanges();
          syncLogger.info('validation', 'Pending changes sent successfully');
        } else {
          syncLogger.info('validation', 'No pending outgoing changes to send');
        }
      } else if (services.dexieOutgoing) {
        // Dexie system - Skip processing during pre-live validation
        // Changes will be processed after transitioning to live mode
        const status = await services.dexieOutgoing.getStatus();
        if (status.pendingCount > 0) {
          syncLogger.info('validation', `Found ${status.pendingCount} pending Dexie changes - will process after transitioning to live mode`);
        } else {
          syncLogger.info('validation', 'No pending Dexie changes found');
        }
      } else {
        syncLogger.warn('validation', 'No outgoing change service available');
      }
    } catch (error) {
      syncLogger.serviceError('OutgoingChanges', error as Error, 'pre-live validation');
      throw new Error(`Failed to send pending changes: ${error}`);
    }
    
    // Step 2: Run integrity validation
    try {
      syncLogger.info('validation', 'Running integrity validation...');
      const integrityResult = await services.integrity.validateIntegrity('pre-live-sync-check');
      
      if (!integrityResult.isValid) {
        const issueCount = integrityResult.issues?.length || 0;
        const action = integrityResult.recommendedAction;
        
        if (action === 'none') {
          // Minor issues that don't require action - log warning but continue
          syncLogger.warn('validation', `Integrity validation found ${issueCount} minor issues but recommends no action - continuing`, {
            issues: issueCount,
            recommendedAction: action
          });
        } else {
          // Critical issues that require action - fail validation
          const errorMsg = `Integrity validation failed with critical issues: ${action} recommended`;
          syncLogger.warn('validation', errorMsg, {
            issues: issueCount,
            recommendedAction: action
          });
          throw new Error(errorMsg);
        }
      }
      
      syncLogger.info('validation', 'Integrity validation passed');
    } catch (error) {
      syncLogger.serviceError('IntegrityService', error as Error, 'pre-live validation');
      throw error;
    }
    
    syncLogger.info('validation', 'Pre-live validation completed successfully');
    return { success: true };
  }),

  /**
   * Simple delay actor for testing
   */
  simulateDelay: fromPromise(async () => {
    console.log('[SyncActors] 🕐 Starting simulation delay...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('[SyncActors] ✅ Simulation delay complete');
    return { success: true };
  }),

  /**
   * Validate LSN format (PostgreSQL WAL LSN format: hex/hex)
   */
  validateLSN: (lsn: string): void => {
    // Valid LSN format: hex/hex (e.g., "0/0", "16/B374D848")
    const lsnRegex = /^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/;
    
    // Check if it looks like a timestamp (13 digits)
    if (/^\d{13}$/.test(lsn)) {
      throw new Error(`Invalid LSN format: "${lsn}" appears to be a timestamp. LSN must be in hex/hex format (e.g., "0/0" or "16/B374D848")`);
    }
    
    // Check general format
    if (!lsnRegex.test(lsn)) {
      throw new Error(`Invalid LSN format: "${lsn}". LSN must be in hex/hex format (e.g., "0/0" or "16/B374D848")`);
    }
  },

  /**
   * Clean LSN by removing any suffixes like "(resuming)"
   */
  cleanLSN: (lsn: string): string => {
    // Remove any text after the LSN format (hex/hex), including "(resuming)" and similar suffixes
    const cleanMatch = lsn.match(/^[0-9A-Fa-f]+\/[0-9A-Fa-f]+/);
    return cleanMatch ? cleanMatch[0] : lsn;
  },

  /**
   * Load persisted state from localStorage
   */
  loadPersistedState: fromPromise(async (): Promise<{
    clientId: string;
    currentLSN: string;
  }> => {
    const SYNC_STATE_KEY = 'sync-machine-state';
    let persistedClientId: string | null = null;
    let persistedLSN = '0/0';
    
    try {
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        if (parsedState.clientId && parsedState.currentLSN) {
          persistedClientId = parsedState.clientId;
          
          // Validate and clean the LSN
          try {
            // First try to clean it
            const cleanedLSN = syncActors.cleanLSN(parsedState.currentLSN);
            // Then validate it
            syncActors.validateLSN(cleanedLSN);
            persistedLSN = cleanedLSN;
            
            syncLogger.info('persistence', 'Loaded persisted sync state', {
              clientId: persistedClientId,
              currentLSN: persistedLSN
            });
          } catch (error) {
            syncLogger.warn('persistence', 'Invalid LSN in persisted state, resetting to 0/0', {
              invalidLSN: parsedState.currentLSN,
              error: error instanceof Error ? error.message : String(error)
            });
            // Reset to default if invalid
            persistedLSN = '0/0';
          }
        }
      }
    } catch (error) {
      syncLogger.warn('persistence', 'Failed to load persisted state, starting fresh', error);
      localStorage.removeItem(SYNC_STATE_KEY);
    }
    
    // Generate client ID if none persisted
    if (!persistedClientId) {
      persistedClientId = crypto.randomUUID();
      syncLogger.info('persistence', 'Generated new client ID', { clientId: persistedClientId });
    }
    
    return {
      clientId: persistedClientId,
      currentLSN: persistedLSN
    };
  }),

  /**
   * Save current state to localStorage
   */
  saveState: fromPromise(async ({ input }: {
    input: { clientId: string; currentLSN: string }
  }): Promise<{ success: boolean }> => {
    const SYNC_STATE_KEY = 'sync-machine-state';
    
    try {
      // Validate LSN format before saving
      syncActors.validateLSN(input.currentLSN);
      
      const stateToSave = {
        clientId: input.clientId,
        currentLSN: input.currentLSN,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(stateToSave));
      syncLogger.debug('persistence', 'State saved successfully', stateToSave);
      
      return { success: true };
    } catch (error) {
      syncLogger.error('persistence', 'Failed to save state', { 
        error: error instanceof Error ? error.message : String(error),
        currentLSN: input.currentLSN,
        clientId: input.clientId
      });
      // Re-throw to ensure the error is handled by the state machine
      throw error;
    }
  }),

  /**
   * Clean up services on shutdown
   */
  cleanupServices: fromPromise(async ({ input }: {
    input: { serviceCoordinator: ServiceCoordinator | null }
  }): Promise<{ success: boolean }> => {
    try {
      if (input.serviceCoordinator) {
        syncLogger.info('cleanup', 'Cleaning up services...');
        input.serviceCoordinator.destroy();
        syncLogger.info('cleanup', 'Services cleaned up successfully');
      }
      return { success: true };
    } catch (error) {
      syncLogger.serviceError('ServiceCoordinator', error as Error, 'cleanup');
      return { success: false };
    }
  }),

  /**
   * Establish baseline after initial sync (no validation needed)
   */
  establishBaseline: fromPromise(async ({ input }: {
    input: { 
      serviceCoordinator: ServiceCoordinator;
      clientId: string;
    }
  }): Promise<{ baselineEstablished: boolean }> => {
    syncLogger.info('validation', 'Establishing baseline after initial sync completion');
    
    const services = input.serviceCoordinator.getServices();
    if (!services) {
      throw new Error('Services not available from ServiceCoordinator');
    }
    
    try {
      // Call the establishBaseline method on IntegrityService
      await services.integrity.establishBaseline('post-initial-sync');
      
      syncLogger.info('validation', 'Baseline successfully established after initial sync');
      return { baselineEstablished: true };
      
    } catch (error) {
      syncLogger.serviceError('IntegrityService', error as Error, 'baseline establishment');
      throw error;
    }
  })
};