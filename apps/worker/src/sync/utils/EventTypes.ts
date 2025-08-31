/**
 * EventTypes - Clean Event Type Organization
 * 
 * Extracted from the massive SyncMachineEvent union type in V2 
 * and organized into logical categories for better maintainability.
 * 
 * Part of Phase 2: Logging Infrastructure and Event Types cleanup
 */

// ============================================================================
// Connection Events - WebSocket and network-related events
// ============================================================================

export type ConnectionEvents =
  | { type: 'CONNECT'; organizationId?: string }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'WS_CONNECTED'; serverLSN: string }
  | { type: 'WS_DISCONNECTED'; reason: string }
  | { type: 'WS_ERROR'; error: Error }
  | { type: 'WS_MESSAGE'; message: any }
  | { type: 'CONNECTION_ONLINE' }
  | { type: 'CONNECTION_OFFLINE' }
  | { type: 'HEARTBEAT_RECEIVED' }
  | { type: 'HEARTBEAT_TIMEOUT' };

// ============================================================================
// Sync Phase Events - Lifecycle and phase transitions
// ============================================================================

export type SyncPhaseEvents = 
  | { type: 'START_INITIAL_SYNC' }
  | { type: 'START_CATCHUP_SYNC' }
  | { type: 'START_LIVE_SYNC' }
  | { type: 'INITIAL_SYNC_COMPLETE' }
  | { type: 'CATCHUP_SYNC_COMPLETE' }
  | { type: 'SYNC_PHASE_DETERMINED'; phase: 'initial' | 'catchup' | 'live' }
  | { type: 'SYNC_READY' }
  | { type: 'SYNC_PAUSED' }
  | { type: 'SYNC_RESUMED' };

// ============================================================================
// Change Processing Events - Data synchronization
// ============================================================================

export type ChangeProcessingEvents =
  | { type: 'INCOMING_CHANGES'; changes: any[]; messageType: string }
  | { type: 'INCOMING_CHANGES_PROCESSED'; results: any[] }
  | { type: 'INCOMING_CHANGES_ERROR'; error: Error; context?: string }
  | { type: 'OUTGOING_CHANGES_QUEUED'; count: number }
  | { type: 'OUTGOING_CHANGES_SENT'; count: number }
  | { type: 'OUTGOING_CHANGES_ACKNOWLEDGED'; changeIds: string[] }
  | { type: 'OUTGOING_CHANGES_ERROR'; error: Error; context?: string }
  | { type: 'CHANGES_CONFLICT_DETECTED'; conflicts: any[] }
  | { type: 'CHANGES_BATCH_COMPLETED'; batchId: string; changeCount: number }
  | { type: 'TABLE_UPDATE_NOTIFICATION'; tables: string[]; source: 'websocket' | 'manual' };

// ============================================================================
// LSN Events - Log Sequence Number management
// ============================================================================

export type LSNEvents =
  | { type: 'LSN_UPDATE'; lsn: string; source: string }
  | { type: 'LSN_SYNC_REQUIRED'; localLSN: string; serverLSN: string }
  | { type: 'LSN_CONFLICT_DETECTED'; localLSN: string; serverLSN: string }
  | { type: 'LSN_RESET'; newLSN: string; reason: string };

// ============================================================================
// Integrity Events - Data validation and consistency
// ============================================================================

export type IntegrityEvents =
  | { type: 'INTEGRITY_VALIDATE'; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_SUCCESS'; result: any }
  | { type: 'INTEGRITY_VALIDATION_COMPLETED'; result: any }
  | { type: 'INTEGRITY_VALIDATION_ERROR'; error: Error; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_FAILED'; error: Error }
  | { type: 'INTEGRITY_VALIDATION_STARTED'; reason: string }
  | { type: 'INTEGRITY_RESET_REQUIRED'; reason: string }
  | { type: 'INTEGRITY_RESET_START'; reason: string; resetType?: 'full_reset' | 'table_reset' }
  | { type: 'INTEGRITY_RESET_STARTED'; reason: string; resetType: string }
  | { type: 'INTEGRITY_RESET_COMPLETE'; result: any }
  | { type: 'INTEGRITY_RESET_COMPLETED'; result: any }
  | { type: 'INTEGRITY_RESET_ERROR'; error: Error }
  | { type: 'INTEGRITY_BASELINE_ESTABLISHED'; timestamp: number }
  | { type: 'INTEGRITY_BASELINE_EXPIRED'; reason: string }
  | { type: 'RESET_INTEGRITY_BASELINE' }
  | { type: 'SERVER_INTEGRITY_RESET_COMMAND'; command: any; reason: string }
  | { type: 'SERVER_INTEGRITY_RESET_COMPLETED'; result: any; command: any }
  | { type: 'INTEGRITY_RESET_DISCONNECTION_COMPLETE'; timestamp: number };

// ============================================================================
// Service Events - Service coordination and errors
// ============================================================================

export type ServiceEvents =
  | { type: 'SERVICE_INITIALIZED'; service: string; config?: any }
  | { type: 'SERVICE_ERROR'; service: string; error: Error; context?: string }
  | { type: 'SERVICE_DESTROYED'; service: string }
  | { type: 'SERVICES_READY'; services: string[] }
  | { type: 'SERVICES_CLEANUP_REQUIRED'; reason: string }
  | { type: 'SERVICE_CALLBACK_CONFIGURED'; service: string; callbackType: string }
  | { type: 'SERVICE_HEALTH_CHECK'; service: string; healthy: boolean };

// ============================================================================
// Error Events - Error handling and recovery
// ============================================================================

export type ErrorEvents =
  | { type: 'ERROR_OCCURRED'; error: Error; context?: string }
  | { type: 'ERROR_RECOVERED'; fromError: string; recovery: string }
  | { type: 'FATAL_ERROR'; error: Error; requiresReset: boolean }
  | { type: 'RETRY'; attempt: number; maxAttempts: number }
  | { type: 'RETRY_EXHAUSTED'; lastError: Error }
  | { type: 'RESET'; reason: string; type?: 'soft' | 'hard' };

// ============================================================================
// State Management Events - Internal state control
// ============================================================================

export type StateManagementEvents =
  | { type: 'STATE_PERSISTED'; state: any }
  | { type: 'STATE_LOADED'; state: any; source: string }
  | { type: 'STATE_RESET'; reason: string }
  | { type: 'CONTEXT_UPDATED'; updates: any }
  | { type: 'MACHINE_STARTED'; machineId: string }
  | { type: 'MACHINE_STOPPED'; machineId: string; reason?: string };

// ============================================================================
// Performance Events - Monitoring and metrics
// ============================================================================

export type PerformanceEvents =
  | { type: 'PERFORMANCE_METRIC'; operation: string; duration: number; metadata?: any }
  | { type: 'THROUGHPUT_UPDATE'; messagesPerSecond: number; changesPerSecond: number }
  | { type: 'MEMORY_USAGE'; usage: number; limit?: number }
  | { type: 'BATCH_PERFORMANCE'; batchSize: number; processingTime: number }
  | { type: 'CONNECTION_LATENCY'; latency: number; timestamp: number };

// ============================================================================
// Combined Event Type - Union of all event categories
// ============================================================================

export type SyncMachineEvent =
  | ConnectionEvents
  | SyncPhaseEvents
  | ChangeProcessingEvents
  | LSNEvents
  | IntegrityEvents
  | ServiceEvents
  | ErrorEvents
  | StateManagementEvents
  | PerformanceEvents;

// ============================================================================
// Event Categories for Filtering and Logging
// ============================================================================

export const EVENT_CATEGORIES = {
  CONNECTION: [
    'CONNECT', 'DISCONNECT', 'RECONNECT', 'WS_CONNECTED', 'WS_DISCONNECTED', 
    'WS_ERROR', 'WS_MESSAGE', 'CONNECTION_ONLINE', 'CONNECTION_OFFLINE',
    'HEARTBEAT_RECEIVED', 'HEARTBEAT_TIMEOUT'
  ],
  SYNC_PHASE: [
    'START_INITIAL_SYNC', 'START_CATCHUP_SYNC', 'START_LIVE_SYNC',
    'INITIAL_SYNC_COMPLETE', 'CATCHUP_SYNC_COMPLETE', 'SYNC_PHASE_DETERMINED',
    'SYNC_READY', 'SYNC_PAUSED', 'SYNC_RESUMED'
  ],
  CHANGES: [
    'INCOMING_CHANGES', 'INCOMING_CHANGES_PROCESSED', 'INCOMING_CHANGES_ERROR',
    'OUTGOING_CHANGES_QUEUED', 'OUTGOING_CHANGES_SENT', 'OUTGOING_CHANGES_ACKNOWLEDGED',
    'OUTGOING_CHANGES_ERROR', 'CHANGES_CONFLICT_DETECTED', 'CHANGES_BATCH_COMPLETED',
    'TABLE_UPDATE_NOTIFICATION'
  ],
  LSN: [
    'LSN_UPDATE', 'LSN_SYNC_REQUIRED', 'LSN_CONFLICT_DETECTED', 'LSN_RESET'
  ],
  INTEGRITY: [
    'INTEGRITY_VALIDATE', 'INTEGRITY_VALIDATION_SUCCESS', 'INTEGRITY_VALIDATION_COMPLETED', 
    'INTEGRITY_VALIDATION_ERROR', 'INTEGRITY_VALIDATION_FAILED', 'INTEGRITY_VALIDATION_STARTED',
    'INTEGRITY_RESET_REQUIRED', 'INTEGRITY_RESET_START', 'INTEGRITY_RESET_STARTED',
    'INTEGRITY_RESET_COMPLETE', 'INTEGRITY_RESET_COMPLETED', 'INTEGRITY_RESET_ERROR',
    'INTEGRITY_BASELINE_ESTABLISHED', 'INTEGRITY_BASELINE_EXPIRED', 'RESET_INTEGRITY_BASELINE',
    'SERVER_INTEGRITY_RESET_COMMAND', 'SERVER_INTEGRITY_RESET_COMPLETED', 'INTEGRITY_RESET_DISCONNECTION_COMPLETE'
  ],
  SERVICE: [
    'SERVICE_INITIALIZED', 'SERVICE_ERROR', 'SERVICE_DESTROYED', 'SERVICES_READY',
    'SERVICES_CLEANUP_REQUIRED', 'SERVICE_CALLBACK_CONFIGURED', 'SERVICE_HEALTH_CHECK'
  ],
  ERROR: [
    'ERROR_OCCURRED', 'ERROR_RECOVERED', 'FATAL_ERROR', 'RETRY', 'RETRY_EXHAUSTED', 'RESET'
  ],
  STATE: [
    'STATE_PERSISTED', 'STATE_LOADED', 'STATE_RESET', 'CONTEXT_UPDATED',
    'MACHINE_STARTED', 'MACHINE_STOPPED'
  ],
  PERFORMANCE: [
    'PERFORMANCE_METRIC', 'THROUGHPUT_UPDATE', 'MEMORY_USAGE', 
    'BATCH_PERFORMANCE', 'CONNECTION_LATENCY'
  ]
} as const;

// ============================================================================
// Utility Functions for Event Management
// ============================================================================

export function getEventCategory(eventType: string): keyof typeof EVENT_CATEGORIES | null {
  for (const [category, events] of Object.entries(EVENT_CATEGORIES)) {
    if (events.includes(eventType as any)) {
      return category as keyof typeof EVENT_CATEGORIES;
    }
  }
  return null;
}

export function isConnectionEvent(event: SyncMachineEvent): event is ConnectionEvents {
  return EVENT_CATEGORIES.CONNECTION.includes(event.type as any);
}

export function isSyncPhaseEvent(event: SyncMachineEvent): event is SyncPhaseEvents {
  return EVENT_CATEGORIES.SYNC_PHASE.includes(event.type as any);
}

export function isChangeProcessingEvent(event: SyncMachineEvent): event is ChangeProcessingEvents {
  return EVENT_CATEGORIES.CHANGES.includes(event.type as any);
}

export function isIntegrityEvent(event: SyncMachineEvent): event is IntegrityEvents {
  return EVENT_CATEGORIES.INTEGRITY.includes(event.type as any);
}

export function isServiceEvent(event: SyncMachineEvent): event is ServiceEvents {
  return EVENT_CATEGORIES.SERVICE.includes(event.type as any);
}

export function isErrorEvent(event: SyncMachineEvent): event is ErrorEvents {
  return EVENT_CATEGORIES.ERROR.includes(event.type as any);
}

export function isNoiseEvent(eventType: string, message?: any): boolean {
  // Events that should be filtered out from normal logging
  const noiseEvents = ['HEARTBEAT_RECEIVED'];
  
  // Filter heartbeat WS_MESSAGE events specifically
  if (eventType === 'WS_MESSAGE' && message?.type === 'srv_heartbeat') {
    return true;
  }
  
  return noiseEvents.includes(eventType);
}

export function shouldLogEvent(eventType: string, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info', message?: any): boolean {
  if (logLevel === 'debug') return true;
  
  // Filter noise events for higher log levels
  if (isNoiseEvent(eventType, message)) return false;
  
  // Always log errors and warnings
  const category = getEventCategory(eventType);
  if (category === 'ERROR') return true;
  
  return true;
}