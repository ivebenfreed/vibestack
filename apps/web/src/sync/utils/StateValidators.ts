/**
 * StateValidators - Extracted state validation logic from sync-machine-v3.ts
 * 
 * Contains all guard functions and state validation logic to reduce sync machine size.
 * Provides clean, testable validation functions for state transitions.
 */

import type { SyncMachineV3Context } from '../../state-machines/machines/sync-machine-v3';

export class StateValidators {
  /**
   * Check if auto-reconnection is allowed
   */
  static canAutoReconnect(context: SyncMachineV3Context): boolean {
    return context.reconnectAttempts < 5;
  }

  /**
   * Check if services are ready for operation
   */
  static servicesReady(context: SyncMachineV3Context): boolean {
    return context.servicesInitialized && 
           !!context.serviceCoordinator && 
           !!context.services;
  }

  /**
   * Check if WebSocket is connected
   */
  static isWebSocketConnected(context: SyncMachineV3Context): boolean {
    return context.isConnected;
  }

  /**
   * Check if integrity validation passed
   */
  static isIntegrityValid(result: any): boolean {
    return result?.isValid === true;
  }

  /**
   * Check if integrity validation recommends reset
   */
  static shouldResetIntegrity(result: any): boolean {
    return !result?.isValid && result?.recommendedAction === 'reset';
  }

  /**
   * Check if integrity validation recommends retry
   */
  static shouldRetryIntegrity(result: any): boolean {
    return !result?.isValid && result?.recommendedAction === 'retry';
  }

  /**
   * Check if maximum reconnection attempts reached
   */
  static maxReconnectAttemptsReached(context: SyncMachineV3Context): boolean {
    return context.reconnectAttempts >= 5;
  }

  /**
   * Check reconnection delay based on attempt number
   */
  static getReconnectDelay(context: SyncMachineV3Context): number {
    const attempt = context.reconnectAttempts;
    if (attempt === 1) return 1000;
    if (attempt === 2) return 2000;
    if (attempt === 3) return 4000;
    if (attempt === 4) return 8000;
    return 16000; // Max delay
  }

  /**
   * Check if specific reconnect attempt should proceed
   */
  static shouldReconnectForAttempt(context: SyncMachineV3Context, attemptNumber: number): boolean {
    return context.reconnectAttempts === attemptNumber;
  }

  /**
   * Validate sync phase transition
   */
  static canTransitionToPhase(context: SyncMachineV3Context, phase: string): boolean {
    const currentPhase = context.syncPhase;
    
    // Define valid phase transitions
    const validTransitions: Record<string, string[]> = {
      'initial': ['validating', 'live'],
      'catchup': ['validating', 'live'],
      'validating': ['live', 'initial', 'catchup'],
      'live': ['validating', 'initial', 'catchup']
    };

    if (!currentPhase) return true; // Allow any transition from null
    
    return validTransitions[currentPhase]?.includes(phase) || false;
  }

  /**
   * Check if client LSN is behind server LSN
   */
  static needsCatchupSync(context: SyncMachineV3Context): boolean {
    if (!context.serverLSN || !context.currentLSN) return false;
    
    // Simple LSN comparison - in practice this would need proper LSN parsing
    return context.currentLSN !== context.serverLSN && context.currentLSN !== '0/0';
  }

  /**
   * Check if client needs initial sync
   */
  static needsInitialSync(context: SyncMachineV3Context): boolean {
    return context.currentLSN === '0/0';
  }

  /**
   * Validate service health
   */
  static validateServiceHealth(context: SyncMachineV3Context): {
    healthy: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const services = context.serviceCoordinator?.getServices();

    if (!services) {
      issues.push('ServiceCoordinator not available');
      return { healthy: false, issues };
    }

    if (!services.webSocket) issues.push('WebSocket service missing');
    if (!services.incoming) issues.push('Incoming changes service missing');
    if (!services.outgoing) issues.push('Outgoing changes service missing');
    if (!services.integrity) issues.push('Integrity service missing');

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Check if context has required fields
   */
  static validateContext(context: SyncMachineV3Context): {
    valid: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    if (!context.clientId) missing.push('clientId');
    if (!context.currentLSN) missing.push('currentLSN');

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Determine if error is recoverable
   */
  static isRecoverableError(error: any): boolean {
    if (!error) return false;

    const recoverableErrors = [
      'WebSocket disconnected',
      'Connection timeout',
      'Network error',
      'Service temporarily unavailable'
    ];

    const errorMessage = typeof error === 'string' ? error : error.message || '';
    
    return recoverableErrors.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if sync machine can safely transition to idle
   */
  static canTransitionToIdle(context: SyncMachineV3Context): boolean {
    // Can always transition to idle, but may want to check for pending operations
    return true;
  }

  /**
   * Validate that required services are initialized
   */
  static hasRequiredServices(context: SyncMachineV3Context): boolean {
    const services = context.serviceCoordinator?.getServices();
    return !!(services?.webSocket && services?.incoming && services?.outgoing);
  }
}

/**
 * Guard function factories for XState guards
 */
export const Guards = {
  canAutoReconnect: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.canAutoReconnect(context),

  servicesReady: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.servicesReady(context),

  maxReconnectAttemptsReached: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.maxReconnectAttemptsReached(context),

  isIntegrityValid: ({ event }: { event: any }) => 
    StateValidators.isIntegrityValid(event.result),

  shouldResetIntegrity: ({ event }: { event: any }) => 
    StateValidators.shouldResetIntegrity(event.result),

  shouldRetryIntegrity: ({ event }: { event: any }) => 
    StateValidators.shouldRetryIntegrity(event.result),

  shouldReconnectAttempt1: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.shouldReconnectForAttempt(context, 1),

  shouldReconnectAttempt2: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.shouldReconnectForAttempt(context, 2),

  shouldReconnectAttempt3: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.shouldReconnectForAttempt(context, 3),

  shouldReconnectAttempt4: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.shouldReconnectForAttempt(context, 4),

  hasRequiredServices: ({ context }: { context: SyncMachineV3Context }) => 
    StateValidators.hasRequiredServices(context),
};