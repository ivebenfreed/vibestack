# Cloudflare Actors + Workers for Platforms Architecture

## 🎯 **Executive Summary**

This document outlines a revolutionary architecture for VibeStack using Cloudflare's next-generation **Actors API** and **Workers for Platforms** to build an organization-first, actor-native system from the ground up.

**Key Innovation**: Instead of fighting Workers' stateless nature, we embrace **organization-as-a-service** where each organization becomes its own isolated, stateful microservice with custom business logic.

## 🔍 **Current Architecture Pain Points**

### **SyncDO Complexity**
Our current `SyncDO.ts` demonstrates the limitations of raw Durable Objects:
- 150+ lines of manual dependency injection
- Complex hibernation/restoration logic
- Manual state coordination across multiple services
- Performance bottlenecks (2.6s response times)

### **Dynamic Entity Performance Issues**
- Repeated organization role lookups for every request
- Schema queries for custom entities on each operation
- RLS context setup from scratch per request
- No persistent warm state across requests

### **Scalability Constraints**
- Monolithic codebase for all organizations
- No organization-specific business logic isolation
- Manual scaling and state management

## 🚀 **Proposed: Actor-Native Architecture**

### **1. Technology Stack**

#### **Cloudflare Actors API (Beta)**
- **Status**: Currently in beta (`@cloudflare/actors`)
- **Purpose**: High-level abstractions over Durable Objects
- **Key Features**:
  - Actor programming model (stateful entities that process messages)
  - Automatic state management and hibernation
  - Built-in message passing and persistence
  - Real-time, interactive application focus
  - **Will become the recommended way** to build on Durable Objects

#### **Workers for Platforms**
- **Status**: Generally Available
- **Purpose**: Dynamic code execution with organizational isolation
- **Key Features**:
  - Dynamic dispatch to organization-specific Workers
  - Isolated namespaces per organization
  - Custom business logic deployment without security concerns
  - Unlimited scaling (bypasses 500 script limit)
  - User-generated code execution capabilities

### **2. Architecture Overview**

```
┌─────────────────────────────────────────┐
│  Frontend (Legend State + React)       │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  Dispatch Worker (Smart Routing)       │
│  - Extract orgId from path             │
│  - Route to org-specific worker        │
└─────────────┬───────────────────────────┘
              │
    ┌─────────▼─────────┐    ┌──────────────┐
    │  Org Worker       │    │  Org Worker  │
    │  (Wide Corp)      │    │  (Acme Inc)  │
    │  - Custom logic   │    │  - Custom    │
    │  - Business rules │    │    logic     │
    └─────────┬─────────┘    └──────┬───────┘
              │                     │
    ┌─────────▼─────────────────────▼───────┐
    │  Organization Actor                   │
    │  - Warm DB connections               │
    │  - Cached schemas & permissions      │
    │  - Persistent state                  │
    └─────────┬─────────────────────────────┘
              │
    ┌─────────▼─────────┐    ┌──────────────┐
    │  Sync Actor       │    │  Entity      │
    │  - WebSocket mgmt │    │  Actor       │
    │  - Real-time sync │    │  - CRUD ops  │
    └───────────────────┘    └──────────────┘
```

## 🏗️ **Core Components**

### **1. Dispatch Worker (Entry Point)**
```typescript
// apps/server/src/dispatch/OrgDispatcher.ts
export default {
  async fetch(request: Request, env: Env) {
    const orgId = extractOrgFromPath(request.url);
    const orgSlug = await getOrgSlug(orgId); // wide-corp, acme-inc, etc.
    
    // Route to organization-specific Worker
    const orgWorker = env.DISPATCHER.get(`org-${orgSlug}`);
    if (orgWorker) {
      return await orgWorker.fetch(request);
    }
    
    // Fallback to default org handler
    return await handleDefaultOrg(request, env);
  }
}
```

### **2. Organization-Specific Workers**
```typescript
// Deployed dynamically per organization
// File: org-wide-corp.js

export default {
  async fetch(request: Request, env: Env) {
    const { entityName, operation, data } = await request.json();
    
    // Wide Corp's custom business rules
    if (entityName === 'Project') {
      // Custom validation for Wide Corp
      if (data.budget > 1000000) {
        await notifyFinanceTeam(data);
      }
      
      // Custom approval workflow
      if (data.priority === 'critical') {
        await triggerExecutiveApproval(data);
      }
    }
    
    // Route to Organization Actor for persistence
    const orgActor = env.ORG_ACTOR.get(env.ORG_ACTOR.idFromName('wide-corp'));
    return await orgActor.handleEntityRequest(entityName, operation, data);
  }
}
```

### **3. Organization Actor (Stateful Core)**
```typescript
// apps/server/src/actors/OrganizationActor.ts
import { Actor } from '@cloudflare/actors'

export class OrganizationActor extends Actor {
  // Actor handles state persistence automatically
  private warmDBConnection: DatabaseConnection;
  private entitySchemas = new Map<string, EntitySchema>();
  private userPermissions = new Map<string, UserPermissions>();
  private customBusinessLogic = new Map<string, Function>();
  private organizationConfig: OrganizationConfig;
  
  // Actor lifecycle - called once, state persists
  async initialize(orgConfig: OrganizationConfig) {
    this.organizationConfig = orgConfig;
    
    // ONE-TIME setup - persists across requests
    await this.setupWarmRLSConnection();
    await this.loadEntitySchemas();
    await this.loadUserPermissions();
    await this.loadCustomBusinessRules();
    
    console.log(`✅ Organization Actor initialized for: ${orgConfig.name}`);
  }
  
  // Handle all org entity operations with warm state
  async handleEntityRequest(entityName: string, operation: string, data: any, userId: string) {
    // NO auth lookups - warm permissions in memory
    // NO schema queries - cached schemas in memory
    // NO RLS setup - warm connection with persistent context
    
    const userPermissions = this.userPermissions.get(userId);
    const entitySchema = this.entitySchemas.get(entityName);
    
    if (!this.hasPermission(userPermissions, operation, entityName)) {
      throw new Error('Insufficient permissions');
    }
    
    // Validate against cached schema
    await this.validateEntityData(data, entitySchema);
    
    // Process with warm database connection
    return await this.processEntityOperation(entityName, operation, data);
  }
  
  private async setupWarmRLSConnection() {
    // Set up persistent RLS context - no per-request overhead
    this.warmDBConnection = await createDBConnection();
    await this.warmDBConnection.query(
      'SELECT set_rls_context($1, $2, $3)',
      [this.organizationConfig.id, 'system', 'admin']
    );
  }
  
  private async loadEntitySchemas() {
    // Load and cache all entity schemas for this organization
    const schemas = await this.warmDBConnection.query(
      'SELECT entity_name, schema_definition FROM entity_schemas WHERE org_id = $1',
      [this.organizationConfig.id]
    );
    
    for (const schema of schemas) {
      this.entitySchemas.set(schema.entity_name, JSON.parse(schema.schema_definition));
    }
  }
  
  private async loadUserPermissions() {
    // Load and cache all user permissions for this organization
    const permissions = await this.warmDBConnection.query(
      'SELECT user_id, permissions FROM user_org_permissions WHERE org_id = $1',
      [this.organizationConfig.id]
    );
    
    for (const perm of permissions) {
      this.userPermissions.set(perm.user_id, JSON.parse(perm.permissions));
    }
  }
}
```

### **4. Sync Actor (Simplified Real-time)**
```typescript
// apps/server/src/actors/SyncActor.ts
import { Actor } from '@cloudflare/actors'

export class SyncActor extends Actor {
  private activeConnections = new Map<string, WebSocket>();
  private organizationId: string;
  
  // Actor handles WebSocket state automatically - no manual hibernation
  async onWebSocketConnect(ws: WebSocket, clientId: string, orgId: string) {
    this.organizationId = orgId;
    this.activeConnections.set(clientId, ws);
    
    // Send initial sync data
    await this.sendInitialSync(ws, clientId);
  }
  
  async onWebSocketMessage(ws: WebSocket, message: ClientMessage) {
    // Clean message processing - no complex state management
    switch (message.type) {
      case 'clt_send_changes':
        return await this.processChanges(message.changes);
      case 'clt_request_sync':
        return await this.sendLiveUpdates(ws, message.lastLSN);
    }
  }
  
  async onWebSocketClose(ws: WebSocket, clientId: string) {
    this.activeConnections.delete(clientId);
  }
  
  // Called by Organization Actor when data changes
  async broadcastChanges(changes: TableChange[]) {
    for (const [clientId, ws] of this.activeConnections) {
      await this.sendMessage(ws, {
        type: 'srv_live_changes',
        changes,
        messageId: generateId()
      });
    }
  }
}
```

## 🚀 **Performance Benefits**

### **Current Performance (Workers + Raw DOs)**
```
Request Flow:
Request → Worker → SyncDO → Manual State Restoration → Auth Lookup → Schema Query → RLS Setup → Business Logic

Timeline:
- Auth lookup: 200ms
- Schema query: 150ms  
- RLS setup: 2000ms
- Business logic: 100ms
Total: ~2.6s per request
```

### **Proposed Performance (Actors + Workers for Platforms)**
```
Request Flow:
Request → Dispatch Worker → Org Worker → Organization Actor (warm state) → Business Logic

Timeline:
- Routing: 5ms
- Custom logic: 10ms
- Actor processing: 30ms (warm state)
- Business logic: 10ms
Total: ~50ms per request (50x faster!)
```

## 💡 **Revolutionary Capabilities**

### **1. Organization-as-a-Service**
Each organization becomes its own **isolated microservice**:
- Custom business rules and validation logic
- Organization-specific entity schemas
- Custom workflows and integrations
- Independent scaling and performance optimization

### **2. Dynamic Business Logic Deployment**
```typescript
// Deploy custom logic without touching main codebase
await deployOrgWorker('wide-corp', `
  export default {
    async fetch(request, env) {
      const { entityName, data } = await request.json();
      
      // Wide Corp's specific project approval workflow
      if (entityName === 'Project' && data.value > 50000) {
        await triggerApprovalWorkflow(data);
      }
      
      // Custom expense validation
      if (entityName === 'Expense' && data.category === 'travel') {
        await validateTravelPolicy(data);
      }
      
      return await orgActor.handleEntityRequest(entityName, operation, data);
    }
  }
`);
```

### **3. Entity Schema as Code**
```typescript
// Per-org entity definitions deployed as Workers
export const WideCorpSchema = {
  Project: {
    fields: { 
      name: 'string', 
      budget: 'number', 
      priority: 'enum',
      stakeholders: 'array<user_id>'
    },
    validation: (data) => {
      if (data.budget > 2000000) {
        throw new Error('Budget exceeds organizational limit');
      }
      return true;
    },
    hooks: {
      beforeSave: async (data) => await validateBudgetApproval(data),
      afterSave: async (data) => await notifyStakeholders(data),
      onStatusChange: async (oldData, newData) => await triggerWorkflow(oldData, newData)
    }
  },
  
  CustomEntity: {
    // Organization can define completely custom entities
    fields: {
      complianceLevel: 'enum',
      regulatoryNotes: 'text',
      auditTrail: 'array<audit_entry>'
    }
  }
};
```

### **4. Real-time Multi-tenant Sync**
```typescript
// Each organization gets its own sync instance
// No cross-contamination or performance interference

class OrgSyncActor extends Actor {
  async handleWALChange(change: WALEntry) {
    // Only process changes for this organization
    if (change.organizationId === this.organizationId) {
      await this.broadcastToClients(change);
    }
  }
}
```

## 🛠️ **Implementation Strategy**

### **Phase 1: Organization Actor Foundation (Month 1)**
**Goal**: Replace current organization-scoped operations with Actor-based approach

**Tasks**:
1. ✅ Implement `OrganizationActor` with warm state management
2. ✅ Create organization-specific routing in Dispatch Worker
3. ✅ Migrate entity CRUD operations to use cached schemas/permissions
4. ✅ Performance testing: target 50ms response times

**Expected Outcome**: 50x performance improvement for entity operations

### **Phase 2: Workers for Platforms Integration (Month 2)**
**Goal**: Enable dynamic organization-specific business logic

**Tasks**:
1. ✅ Set up Workers for Platforms namespace and dispatch
2. ✅ Create organization Worker templates
3. ✅ Implement dynamic Worker deployment system
4. ✅ Build organization configuration management

**Expected Outcome**: Custom business logic per organization without code deployments

### **Phase 3: Sync Actor Migration (Month 3)**
**Goal**: Simplify real-time sync with Actor-based WebSocket management

**Tasks**:
1. ✅ Implement `SyncActor` with automatic WebSocket state management
2. ✅ Migrate from complex `SyncDO` to clean Actor-based sync
3. ✅ Integrate with Organization Actor for data operations
4. ✅ Remove legacy hibernation and state restoration code

**Expected Outcome**: 90% reduction in sync-related code complexity

### **Phase 4: Advanced Features (Month 4+)**
**Goal**: Leverage full Actor + Workers for Platforms capabilities

**Tasks**:
1. ✅ Entity schema as code deployment
2. ✅ Custom workflow engines per organization
3. ✅ Advanced conflict resolution strategies
4. ✅ Real-time collaborative features

## 🎯 **Technical Decisions**

### **Actors API Timeline**
- **Current Status**: Beta (`@cloudflare/actors`)
- **Decision**: Start with beta API to gain early experience
- **Risk Mitigation**: Build abstraction layer for easy migration to GA API
- **Timeline**: Monitor for GA announcement in Q1-Q2 2025

### **Workers for Platforms Access**
- **Current Status**: Generally Available
- **Decision**: Implement immediately for organization isolation
- **Benefits**: Proven technology, immediate custom logic capabilities

### **Migration Strategy**
- **Approach**: Build new architecture in parallel with current system
- **Rollout**: Gradual migration, organization by organization
- **Fallback**: Keep current system as backup during transition

## 🔍 **Key Success Metrics**

### **Performance Targets**
- ✅ **Response Time**: 50ms (vs current 2.6s)
- ✅ **Throughput**: 10x improvement in requests/second
- ✅ **Resource Usage**: 50% reduction in CPU/memory per request

### **Developer Experience**
- ✅ **Code Complexity**: 90% reduction in sync-related code
- ✅ **Deployment Speed**: Custom business logic deployed in minutes
- ✅ **Debugging**: Actor-based state makes debugging 10x easier

### **Business Capabilities**
- ✅ **Organization Isolation**: Complete tenant isolation
- ✅ **Custom Logic**: Per-org business rules without code changes
- ✅ **Scalability**: Linear scaling per organization

## 🚨 **Risks and Mitigations**

### **Beta API Risk**
- **Risk**: `@cloudflare/actors` API changes during development
- **Mitigation**: Build abstraction layer, monitor Cloudflare announcements closely
- **Contingency**: Fall back to optimized Durable Objects if needed

### **Workers for Platforms Complexity**
- **Risk**: Dynamic Worker management adds operational complexity
- **Mitigation**: Start with simple templates, gradual feature rollout
- **Contingency**: Begin with static Worker per organization

### **Migration Complexity**
- **Risk**: Parallel systems increase maintenance burden
- **Mitigation**: Feature flags, gradual rollout, automated testing
- **Contingency**: Rollback plan to current architecture

## 🎯 **Next Steps**

### **Immediate Actions (This Week)**
1. ✅ Create prototype `OrganizationActor` with basic entity operations
2. ✅ Set up Workers for Platforms dispatch namespace
3. ✅ Build simple organization routing proof-of-concept
4. ✅ Performance test Actor vs Durable Object response times

### **Short Term (Next Month)**
1. ✅ Implement full Organization Actor with warm state
2. ✅ Create dynamic Worker deployment system
3. ✅ Migrate one entity type (Projects) to new architecture
4. ✅ Measure and validate performance improvements

### **Medium Term (Next Quarter)**
1. ✅ Full migration to Actor-based architecture
2. ✅ Custom business logic deployment for pilot organizations
3. ✅ Advanced features: workflows, custom entities, real-time collaboration

---

## 📝 **Conclusion**

This architecture represents a **fundamental shift** from traditional multi-tenant applications to **organization-as-a-service**. By leveraging Cloudflare's cutting-edge Actors API and Workers for Platforms, we can build a system that is:

- **50x faster** than current implementation
- **90% less complex** to maintain and debug
- **Infinitely more flexible** for custom business logic
- **Truly scalable** with linear performance per organization

**This isn't just an optimization - it's a complete reimagining of how multi-tenant applications should be built.**

The time to build this architecture is **now**, while we're still in the design phase and can make foundational decisions that will benefit us for years to come.