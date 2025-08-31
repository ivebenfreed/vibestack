# XState-Native Resilience Approach

## 🎯 **Problem with Current Approaches**

### **Why External Monitoring is Fragile:**
- ❌ **Race conditions** between orchestrator and sync machine
- ❌ **Event timing issues** (onSnapshot may not fire on crashes)
- ❌ **State inconsistencies** between parent and child machines
- ❌ **Complex debugging** across multiple state machines

### **Why External Restart Logic Fails:**
- ❌ **Service state leakage** between machine instances
- ❌ **Event source conflicts** during transitions
- ❌ **Manual intervention required** for recovery
- ❌ **No guarantee of clean state** after restart

---

## 🏗️ **XState-Native Solution**

### **Core Principle: Machine Never Stops**
Instead of detecting failures and restarting, design the machine to **never fail permanently**.

### **1. Event Sourcing for Complete Recovery**

```typescript
interface SyncEvent {
  type: string;
  timestamp: number;
  actorId: string;
  data?: any;
}

class SyncEventStore {
  private events: SyncEvent[] = [];
  private readonly maxEvents = 1000;
  
  recordEvent(event: SyncEvent) {
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Persist to localStorage
    this.persist();
  }
  
  async replayEvents(actor: Actor): Promise<void> {
    console.log(`[EventStore] Replaying ${this.events.length} events`);
    
    for (const event of this.events) {
      try {
        // Replay with original timestamp context
        actor.send({
          ...event,
          meta: { isReplay: true, originalTimestamp: event.timestamp }
        });
      } catch (error) {
        console.warn(`[EventStore] Failed to replay event ${event.type}:`, error);
      }
    }
  }
  
  private persist() {
    try {
      localStorage.setItem('sync-events', JSON.stringify(this.events));
    } catch (error) {
      console.warn('[EventStore] Failed to persist events:', error);
    }
  }
}
```

### **2. Self-Healing Machine Architecture**

```typescript
const selfHealingSyncMachine = createMachine({
  id: 'selfHealingSync',
  type: 'parallel', // Never stops - parallel states handle different concerns
  
  context: {
    healthScore: 100,
    lastActivity: Date.now(),
    errorCount: 0,
    recoveryAttempts: 0
  },
  
  states: {
    // Main sync operations
    sync: {
      initial: 'initializing',
      
      states: {
        initializing: {
          invoke: {
            src: 'initializeServices',
            onDone: 'connecting',
            onError: {
              target: 'recovery',
              actions: 'incrementErrorCount'
            }
          }
        },
        
        connecting: {
          invoke: {
            src: 'connectWebSocket',
            onDone: 'live_sync',
            onError: {
              target: 'recovery',
              actions: 'incrementErrorCount'
            }
          }
        },
        
        live_sync: {
          entry: 'resetErrorCount',
          
          // Handle all WebSocket messages here
          on: {
            WS_MESSAGE: {
              actions: ['processMessage', 'updateActivity']
            },
            WS_ERROR: {
              target: 'recovery',
              actions: 'incrementErrorCount'
            }
          },
          
          // Periodic health check
          after: {
            30000: {
              target: 'live_sync',
              actions: 'performHealthCheck'
            }
          }
        },
        
        recovery: {
          entry: 'incrementRecoveryAttempts',
          
          // Progressive recovery strategy
          always: [
            {
              target: 'connecting',
              guard: 'canRetryConnection',
              actions: 'logRetryAttempt'
            },
            {
              target: 'initializing',
              guard: 'needsFullReset',
              actions: 'resetServices'
            },
            {
              target: 'degraded',
              actions: 'enableDegradedMode'
            }
          ]
        },
        
        degraded: {
          // Limited functionality mode
          entry: 'enableLimitedMode',
          
          on: {
            // Still handle critical operations
            OUTGOING_CHANGES: {
              actions: 'queueChangesLocally'
            }
          },
          
          // Attempt recovery every minute
          after: {
            60000: {
              target: 'recovery',
              actions: 'attemptRecovery'
            }
          }
        }
      }
    },
    
    // Health monitoring (parallel state)
    health: {
      initial: 'monitoring',
      
      states: {
        monitoring: {
          entry: 'startHealthMonitoring',
          
          // Continuous health checks
          after: {
            5000: {
              target: 'checking',
              actions: 'scheduleHealthCheck'
            }
          }
        },
        
        checking: {
          invoke: {
            src: 'performHealthCheck',
            onDone: {
              target: 'monitoring',
              actions: 'updateHealthScore'
            },
            onError: {
              target: 'degraded',
              actions: 'decreaseHealthScore'
            }
          }
        },
        
        degraded: {
          // Health is poor - signal to sync state
          entry: sendTo('sync', { type: 'HEALTH_DEGRADED' }),
          
          after: {
            10000: 'monitoring' // Retry health check
          }
        }
      }
    },
    
    // Persistence (parallel state)
    persistence: {
      initial: 'idle',
      
      states: {
        idle: {
          on: {
            PERSIST_STATE: 'persisting'
          },
          
          // Auto-persist every 30 seconds
          after: {
            30000: {
              target: 'persisting',
              actions: 'triggerPersistence'
            }
          }
        },
        
        persisting: {
          invoke: {
            src: 'persistState',
            onDone: 'idle',
            onError: {
              target: 'idle',
              actions: 'logPersistenceError'
            }
          }
        }
      }
    }
  },
  
  // Global event handlers (always active)
  on: {
    // Critical system events
    SYSTEM_SHUTDOWN: {
      actions: 'gracefulShutdown'
    },
    
    // Manual recovery trigger
    FORCE_RECOVERY: {
      actions: sendTo('sync', { type: 'WS_ERROR' })
    }
  }
});
```

### **3. Service Isolation Pattern**

```typescript
class IsolatedSyncServices {
  private instanceId: string;
  private cleanup: (() => void)[] = [];
  
  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }
  
  initialize() {
    // Create isolated service instances
    const webSocketService = new WebSocketService({
      instanceId: this.instanceId
    });
    
    const outgoingService = new OutgoingChangeService({
      instanceId: this.instanceId
    });
    
    // Track cleanup functions
    this.cleanup.push(
      () => webSocketService.disconnect(),
      () => outgoingService.dispose()
    );
    
    return { webSocketService, outgoingService };
  }
  
  dispose() {
    console.log(`[Services] Disposing services for instance ${this.instanceId}`);
    this.cleanup.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('[Services] Cleanup error:', error);
      }
    });
    this.cleanup = [];
  }
}
```

### **4. Actor Factory with Recovery**

```typescript
class ResilientSyncActorFactory {
  private currentActor: Actor | null = null;
  private eventStore = new SyncEventStore();
  
  async createActor(): Promise<Actor> {
    // Try to restore from persistence first
    const persistedState = this.getPersistedState();
    
    const actor = createActor(selfHealingSyncMachine, {
      snapshot: persistedState,
      inspect: (event) => {
        // Record all events for replay
        if (event.type === '@xstate.event') {
          this.eventStore.recordEvent({
            type: event.event.type,
            timestamp: Date.now(),
            actorId: actor.id,
            data: event.event
          });
        }
      }
    });
    
    // Start actor
    actor.start();
    
    // If we're recovering, replay recent events
    if (persistedState) {
      await this.eventStore.replayEvents(actor);
    }
    
    this.currentActor = actor;
    return actor;
  }
  
  private getPersistedState() {
    try {
      const state = localStorage.getItem('sync-actor-state');
      return state ? JSON.parse(state) : null;
    } catch {
      return null;
    }
  }
}
```

---

## 🎯 **Benefits of XState-Native Approach**

### **Reliability**
- ✅ **Never stops** - machine always recovers internally
- ✅ **Event sourcing** provides complete recovery capability  
- ✅ **Deep persistence** handles all invoked actors automatically
- ✅ **Progressive recovery** from soft errors to full resets

### **Maintainability**
- ✅ **Single source of truth** - all logic in one machine
- ✅ **Declarative recovery** - states and transitions are explicit
- ✅ **Easy testing** - can test recovery scenarios directly
- ✅ **Visual debugging** - XState dev tools show entire flow

### **Performance**
- ✅ **No external polling** - machine manages its own health
- ✅ **Efficient state management** - XState optimized for this
- ✅ **Minimal overhead** - parallel states share resources
- ✅ **Smart persistence** - only persists when necessary

---

## 🚀 **Implementation Strategy**

### **Phase 1: Convert to Self-Healing**
1. Convert current sync machine to parallel architecture
2. Add health monitoring parallel state
3. Implement recovery states with progressive strategies

### **Phase 2: Add Event Sourcing**  
1. Implement event recording during normal operation
2. Add replay capability for recovery scenarios
3. Test recovery under various failure conditions

### **Phase 3: Service Isolation**
1. Create isolated service instances per machine
2. Implement proper cleanup on machine transitions
3. Eliminate global service state leakage

### **Phase 4: Deep Persistence**
1. Implement periodic state persistence
2. Add restoration logic for app startup
3. Validate recovery scenarios with real data

---

## ⚠️ **Migration Considerations**

### **Backward Compatibility**
- Keep existing sync machine during transition
- Feature flag new resilient machine
- Gradual migration with fallback capability

### **Testing Strategy**
- Chaos engineering tests for various failure modes
- Recovery time measurement and optimization
- Load testing under degraded conditions

### **Monitoring**
- Health score metrics exposed to application
- Recovery attempt logging and alerting
- Performance impact monitoring

---

**Conclusion**: This XState-native approach eliminates the fragility of external monitoring by making resilience a **core machine capability** rather than an afterthought. The machine becomes **inherently reliable** rather than relying on external systems to detect and fix problems. 