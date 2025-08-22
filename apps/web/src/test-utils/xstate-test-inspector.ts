/**
 * XState Test Inspector
 * 
 * Provides test-specific inspection and monitoring of XState machines.
 * Tracks state transitions, events, and provides markers for testing.
 */

import type { InspectionEvent, Actor, AnyStateMachine } from 'xstate';

export interface StateTransition {
  timestamp: string;
  machineId: string;
  from: string;
  to: string;
  event: any;
  context?: any;
}

export interface EventLog {
  timestamp: string;
  machineId: string;
  event: any;
  state: string;
}

export interface TestMarker {
  timestamp: string;
  marker: string;
  data?: any;
}

class XStateTestInspector {
  private transitions: StateTransition[] = [];
  private events: EventLog[] = [];
  private markers: TestMarker[] = [];
  private actors: Map<string, Actor<any>> = new Map();
  private enabled = false;

  constructor() {
    // Only enable in test/development mode
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
      this.enabled = true;
      // Silent initialization - no console spam
    }
  }

  /**
   * Inspection callback for XState actors
   */
  inspect = (inspectionEvent: InspectionEvent) => {
    if (!this.enabled) return;

    const { type, actorRef, event: evt } = inspectionEvent;
    const timestamp = new Date().toISOString();

    switch (type) {
      case '@xstate.actor':
        // Actor created
        if (actorRef) {
          const id = actorRef.id || 'unknown';
          this.actors.set(id, actorRef);
          // Silent actor registration
        }
        break;

      case '@xstate.event':
        // Event sent to actor
        if (actorRef && evt) {
          const state = actorRef.getSnapshot?.()?.value;
          const eventLog: EventLog = {
            timestamp,
            machineId: actorRef.id || 'unknown',
            event: evt,
            state: typeof state === 'string' ? state : JSON.stringify(state)
          };
          this.events.push(eventLog);
          
          // Log significant events
          if (this.isSignificantEvent(evt.type)) {
            // Silent event tracking
          }
        }
        break;

      case '@xstate.snapshot':
        // State transition
        if (actorRef && (inspectionEvent as any).snapshot) {
          const snapshot = (inspectionEvent as any).snapshot;
          const prevSnapshot = (inspectionEvent as any).event?.snapshot;
          
          if (prevSnapshot && snapshot.value !== prevSnapshot.value) {
            const transition: StateTransition = {
              timestamp,
              machineId: actorRef.id || 'unknown',
              from: this.stateToString(prevSnapshot.value),
              to: this.stateToString(snapshot.value),
              event: (inspectionEvent as any).event,
              context: snapshot.context
            };
            this.transitions.push(transition);
            
            // Log state transitions
            console.log(`[XState Transition] ${actorRef.id}: ${transition.from} → ${transition.to}`);
            
            // Add automatic markers for key transitions
            this.addAutomaticMarkers(actorRef.id || '', transition);
          }
        }
        break;
    }
  };

  /**
   * Add a test marker
   */
  addMarker(marker: string, data?: any) {
    if (!this.enabled) return;
    
    const testMarker: TestMarker = {
      timestamp: new Date().toISOString(),
      marker,
      data
    };
    this.markers.push(testMarker);
    console.log(`[Test Marker] ${marker}`, data || '');
  }

  /**
   * Get all transitions for a specific machine
   */
  getTransitions(machineId?: string): StateTransition[] {
    if (machineId) {
      return this.transitions.filter(t => t.machineId === machineId);
    }
    return [...this.transitions];
  }

  /**
   * Get all events for a specific machine
   */
  getEvents(machineId?: string): EventLog[] {
    if (machineId) {
      return this.events.filter(e => e.machineId === machineId);
    }
    return [...this.events];
  }

  /**
   * Get markers
   */
  getMarkers(): TestMarker[] {
    return [...this.markers];
  }

  /**
   * Get current state of a machine
   */
  getCurrentState(machineId: string): string | null {
    const actor = this.actors.get(machineId);
    if (actor) {
      const snapshot = actor.getSnapshot?.();
      return snapshot ? this.stateToString(snapshot.value) : null;
    }
    return null;
  }

  /**
   * Wait for a specific state
   */
  async waitForState(machineId: string, targetState: string, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentState = this.getCurrentState(machineId);
      if (currentState === targetState) {
        this.addMarker(`State reached: ${machineId} → ${targetState}`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.addMarker(`State timeout: ${machineId} waiting for ${targetState}`);
    return false;
  }

  /**
   * Wait for an event to be sent
   */
  async waitForEvent(machineId: string, eventType: string, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();
    const initialCount = this.events.filter(
      e => e.machineId === machineId && e.event.type === eventType
    ).length;
    
    while (Date.now() - startTime < timeout) {
      const currentCount = this.events.filter(
        e => e.machineId === machineId && e.event.type === eventType
      ).length;
      
      if (currentCount > initialCount) {
        this.addMarker(`Event received: ${machineId} → ${eventType}`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.addMarker(`Event timeout: ${machineId} waiting for ${eventType}`);
    return false;
  }

  /**
   * Clear all recorded data
   */
  clear() {
    this.transitions = [];
    this.events = [];
    this.markers = [];
    // Data cleared silently
  }

  /**
   * Get a summary of all activity
   */
  getSummary() {
    const machineIds = Array.from(this.actors.keys());
    const summary: any = {};
    
    for (const id of machineIds) {
      const transitions = this.getTransitions(id);
      const events = this.getEvents(id);
      const currentState = this.getCurrentState(id);
      
      summary[id] = {
        currentState,
        transitionCount: transitions.length,
        eventCount: events.length,
        lastTransition: transitions[transitions.length - 1],
        lastEvent: events[events.length - 1]
      };
    }
    
    return {
      machines: summary,
      totalTransitions: this.transitions.length,
      totalEvents: this.events.length,
      totalMarkers: this.markers.length,
      markers: this.markers
    };
  }

  /**
   * Helper to convert state value to string
   */
  private stateToString(state: any): string {
    if (typeof state === 'string') return state;
    if (typeof state === 'object') return JSON.stringify(state);
    return String(state);
  }

  /**
   * Check if an event is significant for logging
   */
  private isSignificantEvent(eventType: string): boolean {
    const significantEvents = [
      'CONNECT',
      'DISCONNECT',
      'INCOMING_CHANGES',
      'SEND_CHANGES',
      'ACK_RECEIVED',
      'ERROR',
      'RETRY',
      'SYNC_LIVE',
      'SYNC_COMPLETE'
    ];
    
    return significantEvents.some(e => eventType.includes(e));
  }

  /**
   * Add automatic markers for key transitions
   */
  private addAutomaticMarkers(machineId: string, transition: StateTransition) {
    // Mark sync phase transitions
    if (machineId.includes('sync')) {
      if (transition.to === 'live_sync') {
        this.addMarker('LIVE_SYNC_ENTERED', { machineId, from: transition.from });
      } else if (transition.to === 'catchup_sync') {
        this.addMarker('CATCHUP_SYNC_ENTERED', { machineId, from: transition.from });
      } else if (transition.to === 'initial_sync') {
        this.addMarker('INITIAL_SYNC_ENTERED', { machineId, from: transition.from });
      }
    }
    
    // Mark error states
    if (transition.to.includes('error')) {
      this.addMarker('ERROR_STATE_ENTERED', { 
        machineId, 
        state: transition.to,
        context: transition.context 
      });
    }
  }
}

// Create singleton instance
export const xstateTestInspector = new XStateTestInspector();

// Expose to window for testing
if (typeof window !== 'undefined') {
  (window as any).xstateTestInspector = xstateTestInspector;
  
  // XState Test Inspector available at window.xstateTestInspector in dev/test mode
}

// Helper function to attach inspector to an actor
export function attachInspector(actor: Actor<any>) {
  // XState v5 uses inspect option during creation
  // Actor must be created with inspect option
  console.warn('Use: createActor(machine, { inspect: xstateTestInspector.inspect })');
}