import type { Env, ExecutionContext } from '../types/env';
import { DurableObject } from 'cloudflare:workers';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { 
  DurableObjectState, 
  DurableObjectId,
  DurableObjectStorage,
  DurableObjectTransaction,
  WebSocket 
} from '../types/cloudflare';
import type { ReplicationConfig, ReplicationMetrics } from './types';
import { DEFAULT_REPLICATION_CONFIG } from './types';
import { replicationLogger } from '../middleware/logger';
import { PollingManager } from './polling';
import { getDBClient } from '../lib/db';
import { AppBindings, createMinimalContext, MinimalContext } from '../types/hono';
import { StateManager } from './state-manager';
import { getAllClientIds } from './process-changes';

const MODULE_NAME = 'DO';

export class ReplicationDO extends DurableObject {
  private durableObjectState: DurableObjectState;
  private env: Env;
  private pollingManager: PollingManager;
  private stateManager: StateManager;
  private metrics: ReplicationMetrics;
  private config: ReplicationConfig = DEFAULT_REPLICATION_CONFIG;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.durableObjectState = state;
    this.env = env;
    
    // Initialize managers
    this.stateManager = new StateManager(state, this.config);
    
    // Initialize metrics
    this.metrics = {
      changes: {
        processed: 0,
        failed: 0
      },
      errors: new Map(),
      notifications: {
        totalNotificationsSent: 0
      }
    };
    
    // Create initial context and polling manager
    const ctx = createMinimalContext(env, {
      waitUntil: (promise: Promise<any>) => this.durableObjectState.waitUntil(promise),
      passThroughOnException: () => {},
      props: undefined
    });
    
    this.pollingManager = new PollingManager(
      this.durableObjectState,
      this.config,
      ctx,
      this.env,
      this.stateManager
    );
    
    // Reset polling state on DO initialization to handle restarts/hibernation
    // The polling interval is always null when the DO starts up
    this.pollingManager.hasCompletedFirstPoll = false;
    
    // Auto-initialization removed - replication will only start when explicitly
    // requested through the API endpoint
    replicationLogger.info('ReplicationDO created - awaiting explicit initialization', {}, MODULE_NAME);
  }

  private getContext(): MinimalContext {
    return createMinimalContext(this.env, {
      waitUntil: (promise: Promise<any>) => this.durableObjectState.waitUntil(promise),
      passThroughOnException: () => {},
      props: undefined
    });
  }

  /**
   * Initialize replication and start polling immediately
   * This ensures polling is active as soon as the DO is created
   * Also performs the first WAL poll and returns the results
   */
  private async initializeAndStartPolling(): Promise<{
    success: boolean,
    slotStatus: any,
    firstWALPoll?: any,
    error?: string
  }> {
    try {
      replicationLogger.debug('Initializing replication system', {}, MODULE_NAME);

      const c = this.getContext();

      // Clean up abandoned dev slots before creating new ones
      await this.stateManager.cleanupAbandonedDevSlots(c);

      // Check if slot exists or create it
      const slotStatus = await this.stateManager.checkSlotStatus(c);
      
      // Use debug instead of info to reduce duplicate logs
      replicationLogger.debug('Replication slot check completed', {
        slotExists: slotStatus.exists
      }, MODULE_NAME);
      
      // Start polling immediately and capture the first poll results
      const firstWALPoll = await this.pollingManager.startPollingWithFirstPollResults();
      
              // Log successful initialization with first WAL poll results
        replicationLogger.debug('Initialization completed with first WAL poll', {
          changesFound: firstWALPoll.changesFound,
          changeCount: firstWALPoll.changeCount || 0,
          walEntries: firstWALPoll.walEntries || 0,
          filteredCount: firstWALPoll.filteredCount || 0,
          success: firstWALPoll.success
        }, MODULE_NAME);
      
      return {
        success: true,
        slotStatus,
        firstWALPoll
      };
    } catch (err) {
      // Properly serialize error objects
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorName = err instanceof Error ? err.constructor.name : typeof err;
      
      const errorDetails = {
        error: errorMessage,
        errorType: errorName,
        stack: errorStack,
        config: {
          slot: this.config.slot,
          publication: this.config.publication,
          pollingInterval: this.config.pollingInterval
        },
        environment: {
          databaseUrl: this.env.DATABASE_URL || 'undefined',
          environment: this.env.ENVIRONMENT || 'undefined'
        },
        // Add raw error for debugging if it has additional properties
        rawError: err && typeof err === 'object' ? Object.getOwnPropertyNames(err).reduce((acc, key) => {
          try {
            acc[key] = (err as any)[key];
          } catch (e) {
            acc[key] = '[Unserializable]';
          }
          return acc;
        }, {} as any) : String(err)
      };
      
      replicationLogger.error('Failed to initialize replication', errorDetails, MODULE_NAME);
      
      return {
        success: false,
        slotStatus: null,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Main fetch handler for the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Create execution context
    const executionCtx: ExecutionContext = {
      waitUntil: (promise: Promise<any>) => this.durableObjectState.waitUntil(promise),
      passThroughOnException: () => {},
      props: undefined
    };
    
    const ctx = createMinimalContext(this.env, executionCtx);

    replicationLogger.debug('Request received', {
      path,
      method: request.method
    }, MODULE_NAME);

    // Handle all replication endpoints
    if (path.startsWith('/api/replication')) {
      const endpoint = path.replace('/api/replication', '');
      
      switch (endpoint) {
        case '/init':
          return this.handleInit();
        case '/status':
          return this.handleStatus();
        case '/clients':
          return this.handleClients();
        case '/lsn':
          return this.handleLSN();
        case '/reset-lsn':
          return this.handleResetLSN();
      }
    }

    // Handle internal endpoints (accessed by other DOs)
    if (path.startsWith('/internal') || path === '/lsn') {
      const internalPath = path === '/lsn' ? '/lsn' : path.replace('/internal', '');
      
      switch (internalPath) {
        case '/lsn':
          return this.handleLSN();
      }
    }

    replicationLogger.warn('Unknown endpoint', { path }, MODULE_NAME);
    return new Response('Not found', { status: 404 });
  }

  /**
   * Core initialization logic for the replication system
   * Only checks if the slot exists, doesn't start polling
   */
  private async initializeReplication(): Promise<{success: boolean, error?: string, slotStatus?: any}> {
    try {
      // Check if slot exists or create it if needed
      replicationLogger.debug('Starting replication slot check', {}, MODULE_NAME);
      const c = this.getContext();
      const slotStatus = await this.stateManager.checkSlotStatus(c);
      
      replicationLogger.debug('Replication slot check completed', {
        slotExists: slotStatus.exists
      }, MODULE_NAME);

      return {
        success: true, 
        slotStatus
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      replicationLogger.error('Replication slot check failed', { error: errorMessage }, MODULE_NAME);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Initialize the replication system - HTTP endpoint handler
   * Always initializes and starts polling to ensure system is awake and running
   */
  private async handleInit(): Promise<Response> {
    try {
      replicationLogger.debug('API: Replication init called - always initializing', {}, MODULE_NAME);
      
      try {
        // Always initialize and start polling - this is idempotent and ensures wake-up
        const initResult = await this.initializeAndStartPolling();
        
        if (!initResult.success) {
          return new Response(JSON.stringify({
            success: false,
            error: initResult.error || 'Unknown initialization error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          slotStatus: initResult.slotStatus,
          pollingStarted: true,
          firstWALPoll: initResult.firstWALPoll
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        replicationLogger.error('API: Failed to initialize replication', { 
          error: errorMessage 
        }, MODULE_NAME);
        
        return new Response(JSON.stringify({
          success: false,
          error: errorMessage
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get replication status
   */
  private async handleStatus(): Promise<Response> {
    try {
      const c = this.getContext();
      const slotStatus = await this.stateManager.checkSlotStatus(c);
      const currentLSN = await this.stateManager.getLSN();
      
      // Get actual polling status information
      const hasCompletedFirstPoll = this.pollingManager.hasCompletedFirstPoll;
      const isPollingActive = this.pollingManager.isPollingActive();
      const pollCount = this.pollingManager.getPollCount ? this.pollingManager.getPollCount() : 0;
      const pollingDuration = hasCompletedFirstPoll && isPollingActive && pollCount > 0 
        ? `${Math.floor(pollCount / 60)} minutes (${pollCount} polls)` 
        : "inactive";
      
      return new Response(JSON.stringify({
        success: true,
        slotStatus,
        currentLSN,
        polling: {
          active: isPollingActive, // Use actual interval state, not just flag
          hasCompletedFirstPoll,   // Include both for debugging
          count: pollCount,
          duration: pollingDuration
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replicationLogger.error('Status error', { error: errorMessage }, MODULE_NAME);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle health check request
   */
  private async handleHealthCheck(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: true,
      message: 'Health check functionality removed'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Clean up resources before the Durable Object shuts down
   */
  private async cleanup(): Promise<void> {
    try {
      // Log clean shutdown
      replicationLogger.info('DO shutting down', {}, MODULE_NAME);

      // Stop the polling interval
      await this.pollingManager.stopPolling();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      replicationLogger.error('Cleanup failed', {
        error: error.message
      }, MODULE_NAME);
      throw err;
    }
  }

  private async handleTestNotify(): Promise<Response> {
    return new Response('Test notifications removed - clients manage their own state', { status: 200 });
  }

  private async handleWALConnection(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleSubscribeConnection(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleProcessChanges(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      await this.pollingManager.startPolling();
      return new Response('Changes processed', { status: 200 });
    } catch (error) {
      return new Response('Failed to process changes', { status: 500 });
    }
  }

  private async handleCleanup(): Promise<Response> {
    try {
      await this.cleanup();
      return new Response('Cleaned up', { status: 200 });
    } catch (error) {
      return new Response('Cleanup failed', { status: 500 });
    }
  }

  private async handleStartPolling(): Promise<Response> {
    try {
      await this.pollingManager.startPolling();
      return new Response('Polling started', { status: 200 });
    } catch (error) {
      return new Response('Failed to start polling', { status: 500 });
    }
  }

  private async handleStopPolling(): Promise<Response> {
    try {
      this.pollingManager.stopPolling();
      return new Response('Polling stopped', { status: 200 });
    } catch (error) {
      return new Response('Failed to stop polling', { status: 500 });
    }
  }

  /**
   * Handle client listing request
   */
  private async handleClients(): Promise<Response> {
    const c = this.getContext();
    
    try {
      const clientIds = await getAllClientIds(this.env);
      
      return new Response(JSON.stringify({
        success: true,
        clients: clientIds.map((id: string) => ({ clientId: id }))
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      replicationLogger.error('Failed to list clients', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  /**
   * Get current LSN - HTTP endpoint handler
   */
  private async handleLSN(): Promise<Response> {
    try {
      const currentLSN = await this.stateManager.getLSN();
      
      return new Response(JSON.stringify({
        success: true,
        lsn: currentLSN
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replicationLogger.error('LSN fetch error', { error: errorMessage }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        lsn: '0/0' // Default fallback
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Reset stored LSN to slot's confirmed_flush_lsn - HTTP endpoint handler
   */
  private async handleResetLSN(): Promise<Response> {
    try {
      const c = this.getContext();
      const slotStatus = await this.stateManager.checkSlotStatus(c);
      
      if (!slotStatus.exists || !slotStatus.lsn) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Replication slot does not exist or has no LSN'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const oldLSN = await this.stateManager.getLSN();
      await this.stateManager.setLSN(slotStatus.lsn);
      
      replicationLogger.info('LSN reset completed', {
        oldLSN,
        newLSN: slotStatus.lsn,
        slot: this.config.slot
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        success: true,
        oldLSN,
        newLSN: slotStatus.lsn,
        slot: this.config.slot
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replicationLogger.error('LSN reset error', { error: errorMessage }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
} 