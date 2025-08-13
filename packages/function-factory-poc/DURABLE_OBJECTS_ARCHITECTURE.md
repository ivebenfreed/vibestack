# Durable Objects Architecture for Function Factory

**Vision**: Leverage Cloudflare Durable Objects for **per-organization** and **per-entity** isolation with persistent storage and dynamic spawning capabilities.

---

## 🏗️ **Durable Objects Architecture Overview**

### **Current State**: Shared Worker + D1 Database
```
Single Worker → D1 SQLite (shared tables)
├── acme_corp_projects
├── techflow_solutions_campaigns  
└── startup_inc_userstories
```

### **Enhanced State**: Durable Objects + Persistent Storage
```
Main Worker (Router)
├── OrgDurableObject[acme-corp] → Persistent Storage
├── OrgDurableObject[techflow-solutions] → Persistent Storage
├── EntityDurableObject[acme-corp:SoftwareProject] → Persistent Storage
└── EntityDurableObject[techflow-solutions:Campaign] → Persistent Storage
```

---

## 🎯 **Durable Objects Design Patterns**

### **Pattern 1: Organization-Level Isolation**
```typescript
export class OrganizationDurableObject extends DurableObject {
  private orgId: string;
  private entities: Map<string, EntityConfig> = new Map();
  private storage: DurableObjectStorage;

  constructor(env: Env, ctx: DurableObjectState) {
    super(env, ctx);
    this.storage = ctx.storage;
  }

  // Organization-wide operations
  async deployEntity(entityConfig: EntityConfig) {
    // Store entity configuration in persistent storage
    await this.storage.put(`entity:${entityConfig.name}`, entityConfig);
    
    // Optionally spawn dedicated EntityDurableObject
    if (entityConfig.isolation === 'entity-level') {
      const entityId = this.env.ENTITY_OBJECTS.idFromName(
        `${this.orgId}:${entityConfig.name}`
      );
      const entityStub = this.env.ENTITY_OBJECTS.get(entityId);
      await entityStub.fetch('/initialize', {
        method: 'POST',
        body: JSON.stringify(entityConfig)
      });
    }
  }

  async executeOperation(entityName: string, operation: string, data: any) {
    const entityConfig = await this.storage.get(`entity:${entityName}`);
    
    switch (operation) {
      case 'validate':
        return this.validateData(entityConfig, data);
      case 'save':
        return this.saveData(entityConfig, data);
      case 'query':
        return this.queryData(entityConfig, data);
    }
  }

  private async saveData(entityConfig: EntityConfig, data: any) {
    // Save to persistent storage with automatic indexing
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...data,
      createdAt: new Date().toISOString(),
      orgId: this.orgId,
      entityType: entityConfig.name
    };
    
    await this.storage.put(`record:${entityConfig.name}:${recordId}`, record);
    
    // Update indexes for querying
    await this.updateIndexes(entityConfig.name, record);
    
    return record;
  }

  private async queryData(entityConfig: EntityConfig, filters: any) {
    // Use persistent storage list operations with prefixes
    const prefix = `record:${entityConfig.name}:`;
    const records = await this.storage.list({ prefix });
    
    // Apply filters and return results
    return Array.from(records.values()).filter(record => 
      this.matchesFilters(record, filters)
    );
  }
}
```

### **Pattern 2: Entity-Level Ultra Isolation**
```typescript
export class EntityDurableObject extends DurableObject {
  private orgId: string;
  private entityName: string;
  private config: EntityConfig;
  private storage: DurableObjectStorage;
  private rulesEngine: JsonRulesEngine;

  constructor(env: Env, ctx: DurableObjectState) {
    super(env, ctx);
    this.storage = ctx.storage;
    this.rulesEngine = new JsonRulesEngine();
  }

  async initialize(config: EntityConfig) {
    this.orgId = config.orgId;
    this.entityName = config.name;
    this.config = config;
    
    await this.storage.put('config', config);
    await this.storage.put('metadata', {
      createdAt: new Date().toISOString(),
      version: 1,
      recordCount: 0
    });
  }

  // Ultra-isolated operations per entity
  async validate(data: any): Promise<ValidationResult> {
    return this.rulesEngine.validateRules(data, this.config.validationRules);
  }

  async save(data: any): Promise<any> {
    // Validation
    const validation = await this.validate(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    // Generate record
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...validation.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Atomic save with metadata update
    await this.storage.transaction(async (txn) => {
      await txn.put(`record:${recordId}`, record);
      
      // Update count and indexes
      const metadata = await txn.get('metadata') || { recordCount: 0 };
      metadata.recordCount++;
      metadata.lastUpdated = new Date().toISOString();
      await txn.put('metadata', metadata);
      
      // Custom indexes
      await this.updateCustomIndexes(txn, record);
    });

    return record;
  }

  async query(filters: any, options: { limit?: number, offset?: number } = {}) {
    const { limit = 50, offset = 0 } = options;
    
    // Use storage list with efficient pagination
    const allRecords = await this.storage.list({ 
      prefix: 'record:',
      limit: limit + offset 
    });
    
    // Apply filters and pagination
    const filteredRecords = Array.from(allRecords.values())
      .filter(record => this.matchesFilters(record, filters))
      .slice(offset, offset + limit);

    return {
      records: filteredRecords,
      total: filteredRecords.length,
      hasMore: allRecords.size === (limit + offset)
    };
  }

  // Real-time state management
  async getStats() {
    const metadata = await this.storage.get('metadata') || {};
    const storageUsage = await this.storage.list().then(list => list.size);
    
    return {
      orgId: this.orgId,
      entityName: this.entityName,
      recordCount: metadata.recordCount || 0,
      storageKeys: storageUsage,
      lastActivity: metadata.lastUpdated,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    };
  }
}
```

### **Pattern 3: Hybrid Smart Routing**
```typescript
export class SmartRoutingDurableObject extends DurableObject {
  // Routes to the best isolation level based on configuration
  
  async route(orgId: string, entityName: string, operation: string, data: any) {
    const orgConfig = await this.getOrgConfiguration(orgId);
    
    switch (orgConfig.isolationLevel) {
      case 'entity-level':
        return this.routeToEntityObject(orgId, entityName, operation, data);
      
      case 'org-level':
        return this.routeToOrgObject(orgId, operation, { entityName, data });
      
      case 'shared':
        return this.handleInCurrentObject(orgId, entityName, operation, data);
      
      case 'auto':
        return this.autoSelectIsolation(orgId, entityName, operation, data);
    }
  }

  private async autoSelectIsolation(orgId: string, entityName: string, operation: string, data: any) {
    const usage = await this.getEntityUsageStats(orgId, entityName);
    
    // Smart routing based on usage patterns
    if (usage.requestsPerMinute > 100 || usage.dataSize > '10MB') {
      // High-traffic entities get dedicated objects
      return this.routeToEntityObject(orgId, entityName, operation, data);
    } else if (usage.entitiesCount > 10) {
      // Many entities get org-level grouping
      return this.routeToOrgObject(orgId, operation, { entityName, data });
    } else {
      // Low-traffic stays in shared object
      return this.handleInCurrentObject(orgId, entityName, operation, data);
    }
  }
}
```

---

## 🚀 **Advanced Durable Objects Features**

### **1. Dynamic Spawning & Auto-Scaling**
```typescript
// Configuration-driven spawning
const entityConfig = {
  name: 'SoftwareProject',
  orgId: 'acme-corp',
  isolationLevel: 'entity-level', // 'org-level', 'shared', 'auto'
  scaling: {
    minInstances: 1,
    maxInstances: 10,
    scaleUpThreshold: { requestsPerSecond: 50 },
    scaleDownThreshold: { idleMinutes: 30 }
  }
};

// Auto-spawn based on load
if (currentLoad > config.scaling.scaleUpThreshold.requestsPerSecond) {
  const newObjectId = env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}:${Date.now()}`);
  const newObject = env.ENTITY_OBJECTS.get(newObjectId);
  await newObject.fetch('/initialize');
}
```

### **2. Cross-Object Communication**
```typescript
// Organization object coordinates with entity objects
export class OrganizationDurableObject extends DurableObject {
  async broadcastToAllEntities(message: any) {
    const entityNames = await this.storage.get('entityNames') || [];
    
    const promises = entityNames.map(async (entityName: string) => {
      const entityId = this.env.ENTITY_OBJECTS.idFromName(`${this.orgId}:${entityName}`);
      const entityStub = this.env.ENTITY_OBJECTS.get(entityId);
      
      return entityStub.fetch('/broadcast', {
        method: 'POST',
        body: JSON.stringify(message)
      });
    });
    
    return Promise.all(promises);
  }

  async aggregateEntityStats() {
    const entityNames = await this.storage.get('entityNames') || [];
    const stats = new Map();
    
    for (const entityName of entityNames) {
      const entityId = this.env.ENTITY_OBJECTS.idFromName(`${this.orgId}:${entityName}`);
      const entityStub = this.env.ENTITY_OBJECTS.get(entityId);
      
      const response = await entityStub.fetch('/stats');
      stats.set(entityName, await response.json());
    }
    
    return Object.fromEntries(stats);
  }
}
```

### **3. Persistent State Patterns**
```typescript
// Advanced storage patterns
export class EntityDurableObject extends DurableObject {
  // Time-series data storage
  async saveWithTimeSeries(data: any) {
    const timestamp = new Date().toISOString();
    const dayKey = timestamp.substring(0, 10); // YYYY-MM-DD
    
    await this.storage.transaction(async (txn) => {
      // Current record
      await txn.put(`record:${data.id}`, data);
      
      // Time-series for analytics
      const timeSeriesKey = `timeseries:${dayKey}`;
      const dayRecords = await txn.get(timeSeriesKey) || [];
      dayRecords.push({ timestamp, id: data.id, operation: 'save' });
      await txn.put(timeSeriesKey, dayRecords);
      
      // Metrics
      await this.updateMetrics(txn, 'record_saved');
    });
  }

  // Event sourcing pattern
  async appendEvent(eventType: string, payload: any) {
    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      sequence: await this.getNextSequenceNumber()
    };
    
    await this.storage.put(`event:${event.sequence}:${event.id}`, event);
    return event;
  }

  // Materialized views
  async updateMaterializedView(viewName: string, data: any) {
    const currentView = await this.storage.get(`view:${viewName}`) || {};
    const updatedView = this.applyViewTransform(viewName, currentView, data);
    await this.storage.put(`view:${viewName}`, updatedView);
  }
}
```

---

## 📊 **Configuration-Driven Deployment**

### **Flexible Organization Configurations**
```typescript
const organizationConfigs = {
  'acme-corp': {
    isolationLevel: 'entity-level',  // Each entity gets its own DO
    entities: {
      'SoftwareProject': {
        durableObjectId: 'custom-naming-pattern',
        persistentStorage: true,
        caching: { ttl: 3600, strategy: 'write-through' },
        scaling: { minInstances: 2, maxInstances: 20 }
      }
    }
  },
  
  'startup-inc': {
    isolationLevel: 'org-level',     // All entities share one org DO
    sharedStorage: true,
    costOptimized: true
  },
  
  'enterprise-client': {
    isolationLevel: 'auto',          // Smart routing based on usage
    monitoring: { realTimeMetrics: true, alerting: true },
    compliance: { dataRetention: '7-years', encryption: 'at-rest' }
  }
};
```

### **Dynamic Entity Spawning**
```typescript
// API for dynamic entity deployment
app.post('/org/:orgId/entity/:entityName/spawn', async (c) => {
  const { orgId, entityName } = c.req.param();
  const config = await c.req.json();
  
  // Determine isolation level
  const orgConfig = await getOrgConfig(orgId);
  const isolationLevel = config.isolationLevel || orgConfig.isolationLevel || 'auto';
  
  switch (isolationLevel) {
    case 'entity-level':
      // Spawn dedicated EntityDurableObject
      const entityId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
      const entityStub = c.env.ENTITY_OBJECTS.get(entityId);
      await entityStub.fetch('/initialize', {
        method: 'POST',
        body: JSON.stringify(config)
      });
      break;
      
    case 'org-level':
      // Add to OrganizationDurableObject
      const orgId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgId);
      await orgStub.fetch('/add-entity', {
        method: 'POST',
        body: JSON.stringify({ entityName, config })
      });
      break;
  }
  
  return c.json({
    success: true,
    isolationLevel,
    objectId: isolationLevel === 'entity-level' ? `${orgId}:${entityName}` : orgId
  });
});
```

---

## ⚡ **Performance & Scaling Benefits**

### **1. Geographic Distribution**
```
Organization: Global Corp
├── US-East: OrgDurableObject[global-corp-us] → Low latency for US users
├── EU-West: OrgDurableObject[global-corp-eu] → GDPR compliant EU storage  
└── APAC: OrgDurableObject[global-corp-apac] → Fast access for Asian users
```

### **2. Auto-Scaling Patterns**
- **Cold Start Elimination**: Durable Objects remain warm with persistent connections
- **Load-Based Spawning**: New objects spawned automatically under high load
- **Geographic Proximity**: Objects migrate closer to high-usage regions
- **Cost Optimization**: Idle objects hibernate while maintaining state

### **3. Real-Time Capabilities**
```typescript
// WebSocket connections to Durable Objects
export class RealtimeEntityObject extends DurableObject {
  private websockets: Set<WebSocket> = new Set();
  
  async handleWebSocket(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    
    server.addEventListener('message', (event) => {
      // Real-time entity operations
      this.handleRealtimeOperation(JSON.parse(event.data));
    });
    
    this.websockets.add(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  
  async broadcastEntityUpdate(update: any) {
    this.websockets.forEach(ws => {
      ws.send(JSON.stringify({
        type: 'entity-update',
        orgId: this.orgId,
        entityName: this.entityName,
        update
      }));
    });
  }
}
```

---

## 🎯 **Implementation Roadmap**

### **Phase 1: Core Durable Objects**
1. Create `OrganizationDurableObject` class
2. Implement persistent storage for entity configurations
3. Add basic CRUD operations with validation
4. Test with existing multi-org scenarios

### **Phase 2: Entity-Level Isolation**  
1. Create `EntityDurableObject` class
2. Implement dynamic spawning based on configuration
3. Add cross-object communication patterns
4. Performance testing and optimization

### **Phase 3: Advanced Features**
1. Smart routing and auto-scaling
2. Real-time WebSocket connections
3. Time-series data and analytics
4. Geographic distribution patterns

### **Phase 4: Production Features**
1. Monitoring and observability
2. Backup and disaster recovery
3. Cost optimization algorithms
4. Enterprise security features

---

## 🌟 **Strategic Advantages**

### **1. Ultimate Flexibility**
- **Per-Org Configuration**: Each organization can choose their isolation level
- **Dynamic Scaling**: Objects spawn and hibernate based on real usage
- **Geographic Options**: Data locality for compliance and performance

### **2. Cost Efficiency**
- **Pay-Per-Use**: Only pay for active Durable Objects
- **Automatic Hibernation**: Idle objects don't consume resources
- **Shared Resources**: Organizations can opt for shared objects to reduce costs

### **3. Developer Experience**
- **Familiar Patterns**: Standard HTTP APIs with persistent state
- **Real-Time Updates**: WebSocket support for live data
- **Debugging Tools**: Each object can be inspected and debugged independently

### **4. Enterprise Ready**
- **Compliance**: Data residency and retention controls
- **Security**: Isolated execution contexts per organization/entity
- **Monitoring**: Real-time metrics and alerting per object
- **Scalability**: Unlimited horizontal scaling with geographic distribution

---

**This Durable Objects architecture transforms the Function Factory into a true "Platform-as-a-Service" where organizations can configure their exact isolation, scaling, and persistence requirements while maintaining the rules-based security model.**