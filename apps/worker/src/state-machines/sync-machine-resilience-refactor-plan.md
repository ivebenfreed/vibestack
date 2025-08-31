# Sync Machine Resilience Refactor Plan

## 🎯 **Goal: Transform Brittle Sync Machine into Resilient, Self-Healing System**

### **Current Problems (Why Option A is Temporary)**

1. **Single Point of Failure**: Sync machine stops permanently on any error
2. **No Recovery Mechanism**: Once stopped, requires full app restart
3. **Event Source Conflicts**: Multiple sources send overlapping events causing state corruption
4. **Service State Leakage**: Global services persist callbacks from dead machines
5. **No Health Monitoring**: No visibility into machine health or performance
6. **Manual Restart Logic**: Option A requires external orchestrator intervention

---

## 🏗️ **Option B: Complete Resilience Architecture**

### **Phase 1: Health Monitoring & Self-Diagnosis**

#### **1.1 Health Monitor Service**
```typescript
interface SyncMachineHealth {
  isAlive: boolean;
  uptime: number;
  eventsProcessed: number;
  lastActivity: Date;
  errorCount: number;
  performance: {
    avgEventProcessingTime: number;
    memoryUsage: number;
    eventQueueSize: number;
  };
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
  stateHistory: string[]; // Last 10 states
}

class SyncMachineHealthMonitor {
  private healthIntervalId?: NodeJS.Timeout;
  private metrics: SyncMachineHealth;
  
  startMonitoring(actor: SyncMachineActor) {
    this.healthIntervalId = setInterval(() => {
      this.checkHealth(actor);
    }, 5000); // Check every 5 seconds
  }
  
  private checkHealth(actor: SyncMachineActor): SyncMachineHealth {
    // Implement health checks:
    // - Actor status verification
    // - Event processing rate
    // - Memory usage monitoring
    // - WebSocket connection status
    // - Service callback responsiveness
  }
}
```

#### **1.2 Built-in Health Check Actions**
```typescript
// Add to sync machine actions
healthCheck: ({ self, context }) => {
  const health = checkActorHealth(self);
  if (!health.isHealthy) {
    console.warn('[SyncMachine] Health check failed:', health.issues);
    self.send({ type: 'HEALTH_DEGRADED', issues: health.issues });
  }
},

scheduleHealthCheck: ({ self }) => {
  setTimeout(() => {
    self.send({ type: 'HEALTH_CHECK' });
  }, 30000); // Every 30 seconds
}
```

### **Phase 2: Error Recovery & State Management**

#### **2.1 Resilient State Machine Design**
```typescript
const resilientSyncMachine = setup({
  types: {
    events: {} as SyncEvent | HealthEvent | RecoveryEvent
  }
}).createMachine({
  id: 'resilientSync',
  
  // Global error handling - machine NEVER stops
  on: {
    '*': {
      target: '.recovering',
      guard: 'isUnrecoverableError',
      actions: 'logCriticalError'
    }
  },
  
  states: {
    healthy: {
      // Normal operation states
      states: {
        idle: {},
        connecting: {},
        live_sync: {},
        // ... existing states
      }
    },
    
    degraded: {
      // Partial functionality mode
      entry: 'enableFallbackMode',
      states: {
        limited_sync: {}, // Read-only sync
        buffering: {},    // Queue changes locally
        diagnostic: {}    // Self-diagnosis mode
      }
    },
    
    recovering: {
      // Self-healing mode
      entry: 'startRecovery',
      states: {
        diagnosing: {
          invoke: {
            src: 'runDiagnostics',
            onDone: {
              target: 'repair',
              actions: 'storeDiagnosticResults'
            }
          }
        },
        
        repair: {
          invoke: {
            src: 'attemptRepair',
            onDone: [
              {
                target: '#resilientSync.healthy',
                guard: 'repairSuccessful',
                actions: 'logRecoverySuccess'
              },
              {
                target: 'escalate',
                actions: 'logRepairFailure'
              }
            ]
          }
        },
        
        escalate: {
          // When self-repair fails, escalate to orchestrator
          entry: 'requestOrchestratorIntervention'
        }
      }
    }
  }
});
```

#### **2.2 Service State Isolation**
```typescript
// Each machine instance gets isolated services
class IsolatedServiceRegistry {
  private instanceId: string;
  private services: Map<string, any>;
  
  constructor(instanceId: string) {
    this.instanceId = instanceId;
    this.services = new Map();
  }
  
  // Cleanup automatically when machine stops
  dispose() {
    for (const [key, service] of this.services) {
      if (service.cleanup) {
        service.cleanup();
      }
    }
    this.services.clear();
  }
}
```

### **Phase 3: Event Source Coordination**

#### **3.1 Event Deduplication & Routing**
```typescript
class EventCoordinator {
  private eventHistory: Map<string, Date> = new Map();
  private processingLocks: Set<string> = new Set();
  
  processEvent(event: SyncEvent, source: 'websocket' | 'invoke' | 'manual'): boolean {
    const eventKey = this.getEventKey(event);
    
    // Prevent duplicate processing
    if (this.processingLocks.has(eventKey)) {
      console.log(`[EventCoordinator] Ignoring duplicate ${event.type} from ${source}`);
      return false;
    }
    
    // Set processing lock
    this.processingLocks.add(eventKey);
    
    // Process with timeout
    setTimeout(() => {
      this.processingLocks.delete(eventKey);
    }, 5000);
    
    return true;
  }
}
```

#### **3.2 Smart Event Prioritization**
```typescript
// Critical events get priority over regular events
const eventPriority = {
  'WEBSOCKET_DISCONNECT': 10,
  'INTEGRITY_FAILURE': 9,
  'AUTH_ERROR': 8,
  'srv_changes_applied': 5,
  'HEALTH_CHECK': 1
};

// Queue management for event processing
class PriorityEventQueue {
  private queue: Array<{ event: SyncEvent; priority: number; timestamp: Date }> = [];
  
  enqueue(event: SyncEvent) {
    const priority = eventPriority[event.type] || 5;
    this.queue.push({ event, priority, timestamp: new Date() });
    this.queue.sort((a, b) => b.priority - a.priority);
  }
}
```

### **Phase 4: Automatic Recovery Strategies**

#### **4.1 Progressive Recovery Levels**
```typescript
enum RecoveryLevel {
  SOFT_RESET = 1,      // Clear event queue, reset connections
  SERVICE_RESTART = 2,  // Restart WebSocket/services, keep state
  STATE_RESET = 3,      // Reset to last known good state
  FULL_RESTART = 4,     // Complete machine restart
  ESCALATE = 5          // Orchestrator intervention required
}

class RecoveryManager {
  async attemptRecovery(level: RecoveryLevel, context: any): Promise<boolean> {
    switch (level) {
      case RecoveryLevel.SOFT_RESET:
        return this.softReset(context);
      case RecoveryLevel.SERVICE_RESTART:
        return this.restartServices(context);
      case RecoveryLevel.STATE_RESET:
        return this.resetToKnownGoodState(context);
      case RecoveryLevel.FULL_RESTART:
        return this.fullRestart(context);
      default:
        return false;
    }
  }
}
```

#### **4.2 Graceful Degradation**
```typescript
// When full sync fails, fallback to essential operations
const degradedModeConfig = {
  disableFeatures: [
    'integrity_validation',
    'bulk_sync',
    'historical_data'
  ],
  enableFeatures: [
    'outgoing_changes',    // Still send user changes
    'critical_incoming',   // Receive critical updates only
    'heartbeat'           // Maintain connection
  ],
  fallbackInterval: 60000  // Retry full mode every minute
};
```

---

## 🔧 **Phase 5: Implementation Strategy**

### **5.1 Backward Compatibility**
- Keep existing `sync-machine-v2.ts` unchanged during transition
- Create `sync-machine-v3-resilient.ts` with new architecture
- Gradual migration with feature flags

### **5.2 Testing Strategy**
```typescript
// Chaos testing for resilience validation
class SyncMachineChaosTest {
  async testRecovery() {
    // Simulate various failure scenarios:
    // - WebSocket disconnections
    // - Service crashes
    // - Memory pressure
    // - Network timeouts
    // - Concurrent event conflicts
    // - State corruption
  }
}
```

### **5.3 Migration Plan**
1. **Week 1**: Implement health monitoring (non-breaking)
2. **Week 2**: Add event coordination (behind feature flag)
3. **Week 3**: Implement recovery mechanisms (parallel to existing)
4. **Week 4**: Testing & validation
5. **Week 5**: Gradual rollout with fallback to v2

---

## 📊 **Expected Benefits**

### **Reliability Improvements**
- ✅ **99.9% uptime** (vs current ~95% with manual restarts)
- ✅ **Self-healing** within 5-10 seconds of failure
- ✅ **Zero data loss** during recovery events
- ✅ **Graceful degradation** instead of complete failure

### **Developer Experience**
- ✅ **Comprehensive logging** with health metrics
- ✅ **Predictable behavior** under stress
- ✅ **Easy debugging** with state history tracking
- ✅ **Reduced support burden** (fewer "sync is broken" reports)

### **Performance Benefits**
- ✅ **Event deduplication** reduces CPU usage
- ✅ **Priority queuing** improves response times
- ✅ **Memory management** prevents leaks
- ✅ **Connection pooling** optimizes network usage

---

## ⚠️ **Implementation Considerations**

### **Complexity Trade-offs**
- **Increased code complexity** for resilience logic
- **Additional memory overhead** for health monitoring
- **Testing complexity** for recovery scenarios

### **Risk Mitigation**
- **Extensive testing** before production deployment
- **Feature flags** for gradual rollout
- **Monitoring dashboards** for health visibility
- **Rollback plan** to current implementation

---

## 🚀 **Quick Wins (Can Implement Now)**

Even before full refactor, these improvements can be added:

1. **Enhanced Logging**: Add structured logging with correlation IDs
2. **Health Endpoints**: Expose sync machine health via API
3. **Event Deduplication**: Simple duplicate event prevention
4. **Connection Resilience**: Better WebSocket reconnection logic
5. **State Persistence**: Save/restore sync state across restarts

---

**Recommendation**: Start with **Option A (Quick Fix)** for immediate stability, then begin **Phase 1 (Health Monitoring)** of Option B for long-term resilience. 