# LiveStore Client Migration Plan

## Executive Summary

We are already conducting a complete client-side data architecture rewrite to implement:
- 8 universal entity archetypes (Project, Task, Record, Document, File, Activity, Discussion, Collection)
- Container-based access control with archetype-specific patterns
- Multi-tenant data isolation and routing

**Key Insight**: Since we're rewriting all client data access patterns anyway, this is the optimal time to migrate from Dexie (IndexedDB) to LiveStore (SQLite) with zero additional migration cost.

## Current State: Complete Rewrite Already Required

### Existing Client Architecture (Being Replaced)
```typescript
// Current: Domain-specific entities with manual relationships
await db.tasks.get(id);
await db.projects.get(id);
await db.users.get(id);
// No unified access patterns, no container access control
```

### Required New Architecture (Regardless of Storage)
```typescript
// New: Archetype-based with container access control
const taskService = new ArchetypeService('task', containerAccess);
const task = await taskService.findById(id, userContext);
// Unified access patterns, automatic access control
```

**Result**: 100% of client data access code must be rewritten anyway. Storage layer choice is orthogonal to this requirement.

## LiveStore Integration Strategy

### Phase 1: Foundation Architecture (Weeks 1-4)

#### 1.1 LiveStore Schema Design
```typescript
// Define schemas using our archetype patterns
export const vibestackSchema = {
  // Base archetype tables
  projects: State.SQLite.table({
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // UUIDv7
      name: State.SQLite.text(),
      description: State.SQLite.text(),
      status: State.SQLite.text(),
      priority: State.SQLite.text(),
      startDate: State.SQLite.text(),
      endDate: State.SQLite.text(),
      ownerId: State.SQLite.text(),
      // Container access fields
      containerId: State.SQLite.text(),
      containerType: State.SQLite.text(),
      organizationId: State.SQLite.text(),
      // System fields
      createdAt: State.SQLite.text(),
      updatedAt: State.SQLite.text(),
      createdBy: State.SQLite.text(),
      clientId: State.SQLite.text()
    },
    indexes: [
      ['organizationId', 'containerId'],
      ['status', 'priority'],
      ['ownerId']
    ]
  }),

  tasks: State.SQLite.table({
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      title: State.SQLite.text(),
      description: State.SQLite.text(),
      status: State.SQLite.text(),
      priority: State.SQLite.text(),
      assigneeId: State.SQLite.text(),
      projectId: State.SQLite.text(), // Foreign key to projects
      // Container access (inherits from project)
      containerId: State.SQLite.text(),
      containerType: State.SQLite.text(),
      organizationId: State.SQLite.text(),
      // System fields
      createdAt: State.SQLite.text(),
      updatedAt: State.SQLite.text(),
      createdBy: State.SQLite.text(),
      clientId: State.SQLite.text()
    },
    indexes: [
      ['organizationId', 'projectId'],
      ['assigneeId', 'status'],
      ['containerId']
    ]
  }),

  // Container permission management
  containerPermissions: State.SQLite.table({
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      userId: State.SQLite.text(),
      containerType: State.SQLite.text(),
      containerId: State.SQLite.text(),
      role: State.SQLite.text(), // ADMIN, OWNER, MEMBER, VIEWER
      organizationId: State.SQLite.text(),
      grantedAt: State.SQLite.text(),
      grantedBy: State.SQLite.text()
    },
    indexes: [
      ['userId', 'organizationId'],
      ['containerType', 'containerId'],
      ['organizationId']
    ]
  })
};
```

#### 1.2 Event-Driven Archetype Operations
```typescript
// Define events that map to our TableChange protocol
export const vibestackEvents = {
  // Project archetype events
  ProjectCreated: State.event('ProjectCreated', {
    projectId: State.string(),
    name: State.string(),
    ownerId: State.string(),
    containerId: State.string(),
    organizationId: State.string()
  }),

  ProjectUpdated: State.event('ProjectUpdated', {
    projectId: State.string(),
    changes: State.record({
      name: State.optional(State.string()),
      status: State.optional(State.string()),
      priority: State.optional(State.string())
    }),
    updatedBy: State.string()
  }),

  // Task archetype events  
  TaskCreated: State.event('TaskCreated', {
    taskId: State.string(),
    title: State.string(),
    projectId: State.string(),
    assigneeId: State.optional(State.string()),
    organizationId: State.string()
  }),

  TaskAssigned: State.event('TaskAssigned', {
    taskId: State.string(),
    assigneeId: State.string(),
    assignedBy: State.string()
  }),

  TaskCompleted: State.event('TaskCompleted', {
    taskId: State.string(),
    completedBy: State.string(),
    completedAt: State.string()
  }),

  // Container access events
  ContainerPermissionGranted: State.event('ContainerPermissionGranted', {
    userId: State.string(),
    containerType: State.string(),
    containerId: State.string(),
    role: State.string(),
    grantedBy: State.string(),
    organizationId: State.string()
  })
};
```

#### 1.3 Server Protocol Translation Layer
```typescript
export class LiveStoreToVibeStackAdapter {
  private clientId: string;
  private organizationId: string;

  constructor(clientId: string, organizationId: string) {
    this.clientId = clientId;
    this.organizationId = organizationId;
  }

  /**
   * Translate LiveStore events to our existing TableChange format
   */
  translateEvent(event: LiveStoreEvent): TableChange[] {
    const eventMappings: Record<string, (event: any) => TableChange[]> = {
      ProjectCreated: (e) => [{
        table: 'projects',
        operation: 'insert',
        data: {
          id: e.projectId,
          name: e.name,
          ownerId: e.ownerId,
          containerId: e.containerId,
          organizationId: e.organizationId,
          status: 'active',
          createdAt: new Date().toISOString(),
          createdBy: e.ownerId,
          clientId: this.clientId
        },
        clientId: this.clientId,
        updatedAt: new Date().toISOString(),
        changeId: event.id
      }],

      ProjectUpdated: (e) => [{
        table: 'projects',
        operation: 'update',
        data: {
          id: e.projectId,
          ...e.changes,
          updatedAt: new Date().toISOString(),
          clientId: this.clientId
        },
        clientId: this.clientId,
        updatedAt: new Date().toISOString(),
        changeId: event.id
      }],

      TaskCreated: (e) => [{
        table: 'tasks',
        operation: 'insert',
        data: {
          id: e.taskId,
          title: e.title,
          projectId: e.projectId,
          assigneeId: e.assigneeId,
          organizationId: e.organizationId,
          status: 'todo',
          createdAt: new Date().toISOString(),
          clientId: this.clientId
        },
        clientId: this.clientId,
        updatedAt: new Date().toISOString(),
        changeId: event.id
      }],

      TaskAssigned: (e) => [{
        table: 'tasks',
        operation: 'update',
        data: {
          id: e.taskId,
          assigneeId: e.assigneeId,
          updatedAt: new Date().toISOString(),
          clientId: this.clientId
        },
        clientId: this.clientId,
        updatedAt: new Date().toISOString(),
        changeId: event.id
      }],

      TaskCompleted: (e) => [{
        table: 'tasks',
        operation: 'update',
        data: {
          id: e.taskId,
          status: 'completed',
          completedAt: e.completedAt,
          updatedAt: new Date().toISOString(),
          clientId: this.clientId
        },
        clientId: this.clientId,
        updatedAt: new Date().toISOString(),
        changeId: event.id
      }]
    };

    const mapper = eventMappings[event.type];
    if (!mapper) {
      throw new Error(`Unknown event type: ${event.type}`);
    }

    return mapper(event.data);
  }

  /**
   * Set up automatic translation and sync to existing server
   */
  setupEventSync(liveStore: LiveStore, webSocketService: WebSocketService) {
    liveStore.events.subscribe((event) => {
      try {
        const tableChanges = this.translateEvent(event);
        
        // Send to existing server using current protocol
        webSocketService.send({
          type: 'client_changes',
          changes: tableChanges,
          sequence: Date.now(),
          clientId: this.clientId
        });
        
        console.log(`[LiveStore Adapter] Translated ${event.type} → ${tableChanges.length} TableChanges`);
      } catch (error) {
        console.error('[LiveStore Adapter] Translation failed:', error);
      }
    });
  }
}
```

### Phase 2: Archetype Service Layer (Weeks 5-8)

#### 2.1 Universal Archetype Interface
```typescript
export abstract class BaseArchetypeService<T> {
  protected store: LiveStore;
  protected accessControl: ContainerAccessService;
  protected organizationId: string;

  constructor(
    store: LiveStore, 
    accessControl: ContainerAccessService,
    organizationId: string
  ) {
    this.store = store;
    this.accessControl = accessControl;
    this.organizationId = organizationId;
  }

  /**
   * Find entity by ID with automatic access control
   */
  async findById(id: string, userContext: UserContext): Promise<T | null> {
    // Query SQLite directly with joins
    const result = await this.store.query(`
      SELECT e.*, cp.role as userRole
      FROM ${this.getTableName()} e
      LEFT JOIN containerPermissions cp ON 
        cp.containerType = e.containerType AND 
        cp.containerId = e.containerId AND 
        cp.userId = ? AND
        cp.organizationId = ?
      WHERE e.id = ? AND e.organizationId = ?
    `, [userContext.userId, this.organizationId, id, this.organizationId]);

    if (!result || result.length === 0) {
      return null;
    }

    const entity = result[0];
    
    // Apply field-level access control
    return this.filterFieldsByAccess(entity, entity.userRole);
  }

  /**
   * Create new entity with automatic container assignment
   */
  async create(data: Partial<T>, userContext: UserContext): Promise<T> {
    // Validate access before creation
    await this.validateCreateAccess(data, userContext);

    // Determine container assignment based on archetype
    const containerInfo = await this.determineContainer(data, userContext);

    const event = this.createInsertEvent(data, userContext, containerInfo);
    await this.store.apply(event);

    return this.findById(event.data.id, userContext)!;
  }

  /**
   * Update entity with access control and optimistic locking
   */
  async update(id: string, changes: Partial<T>, userContext: UserContext): Promise<T> {
    // Check write access
    const current = await this.findById(id, userContext);
    if (!current) {
      throw new Error('Entity not found or access denied');
    }

    await this.validateUpdateAccess(current, changes, userContext);

    const event = this.createUpdateEvent(id, changes, userContext);
    await this.store.apply(event);

    return this.findById(id, userContext)!;
  }

  /**
   * Query with automatic access control and container filtering
   */
  async findMany(filters: any, userContext: UserContext): Promise<T[]> {
    // Build SQL query with container access joins
    const query = this.buildAccessControlledQuery(filters, userContext);
    const results = await this.store.query(query.sql, query.params);

    return results.map(result => 
      this.filterFieldsByAccess(result, result.userRole)
    );
  }

  // Abstract methods implemented by specific archetypes
  protected abstract getTableName(): string;
  protected abstract determineContainer(data: any, userContext: UserContext): Promise<ContainerInfo>;
  protected abstract createInsertEvent(data: any, userContext: UserContext, container: ContainerInfo): any;
  protected abstract createUpdateEvent(id: string, changes: any, userContext: UserContext): any;
}
```

#### 2.2 Archetype-Specific Implementations
```typescript
export class ProjectService extends BaseArchetypeService<Project> {
  protected getTableName() { return 'projects'; }

  protected async determineContainer(data: any, userContext: UserContext): Promise<ContainerInfo> {
    // Projects create their own containers
    return {
      containerId: data.id || generateUUID(),
      containerType: 'project'
    };
  }

  protected createInsertEvent(data: any, userContext: UserContext, container: ContainerInfo) {
    return {
      type: 'ProjectCreated',
      data: {
        projectId: data.id || generateUUID(),
        name: data.name,
        description: data.description,
        ownerId: userContext.userId,
        containerId: container.containerId,
        organizationId: this.organizationId
      }
    };
  }

  protected createUpdateEvent(id: string, changes: any, userContext: UserContext) {
    return {
      type: 'ProjectUpdated',
      data: {
        projectId: id,
        changes,
        updatedBy: userContext.userId
      }
    };
  }

  /**
   * Get project tasks with automatic container inheritance
   */
  async getTasks(projectId: string, userContext: UserContext): Promise<Task[]> {
    const taskService = new TaskService(this.store, this.accessControl, this.organizationId);
    return taskService.findMany({ projectId }, userContext);
  }
}

export class TaskService extends BaseArchetypeService<Task> {
  protected getTableName() { return 'tasks'; }

  protected async determineContainer(data: any, userContext: UserContext): Promise<ContainerInfo> {
    // Tasks inherit container from parent project
    const project = await this.store.query(
      'SELECT containerId, containerType FROM projects WHERE id = ? AND organizationId = ?',
      [data.projectId, this.organizationId]
    );

    if (!project || project.length === 0) {
      throw new Error('Parent project not found');
    }

    return {
      containerId: project[0].containerId,
      containerType: project[0].containerType
    };
  }

  protected createInsertEvent(data: any, userContext: UserContext, container: ContainerInfo) {
    return {
      type: 'TaskCreated',
      data: {
        taskId: data.id || generateUUID(),
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        assigneeId: data.assigneeId,
        organizationId: this.organizationId
      }
    };
  }

  /**
   * Task-specific operations with rich events
   */
  async assign(taskId: string, assigneeId: string, userContext: UserContext): Promise<Task> {
    await this.store.apply({
      type: 'TaskAssigned',
      data: {
        taskId,
        assigneeId,
        assignedBy: userContext.userId
      }
    });

    return this.findById(taskId, userContext)!;
  }

  async complete(taskId: string, userContext: UserContext): Promise<Task> {
    await this.store.apply({
      type: 'TaskCompleted',
      data: {
        taskId,
        completedBy: userContext.userId,
        completedAt: new Date().toISOString()
      }
    });

    return this.findById(taskId, userContext)!;
  }
}
```

### Phase 3: Multi-Tenant Integration (Weeks 9-12)

#### 3.1 Organization-Scoped LiveStore Instances
```typescript
export class MultiTenantLiveStoreManager {
  private stores: Map<string, LiveStore> = new Map();
  private adapters: Map<string, LiveStoreToVibeStackAdapter> = new Map();

  /**
   * Get or create LiveStore instance for organization
   */
  async getStore(organizationId: string, clientId: string): Promise<LiveStore> {
    const storeKey = `${organizationId}-${clientId}`;
    
    if (!this.stores.has(storeKey)) {
      const store = await this.createOrganizationStore(organizationId, clientId);
      this.stores.set(storeKey, store);
      
      // Set up translation adapter
      const adapter = new LiveStoreToVibeStackAdapter(clientId, organizationId);
      adapter.setupEventSync(store, this.getWebSocketService());
      this.adapters.set(storeKey, adapter);
    }

    return this.stores.get(storeKey)!;
  }

  private async createOrganizationStore(organizationId: string, clientId: string): Promise<LiveStore> {
    const store = new LiveStore({
      name: `vibestack-${organizationId}`,
      schema: vibestackSchema,
      events: vibestackEvents,
      worker: '/livestore-worker.js',
      syncProvider: {
        // Use our existing Cloudflare Workers sync
        url: `wss://api.vibestack.com/sync?orgId=${organizationId}&clientId=${clientId}`,
        // Note: This connects to our existing server via the translation layer
      }
    });

    await store.ready();
    return store;
  }

  /**
   * Handle organization switching
   */
  async switchOrganization(newOrgId: string, clientId: string): Promise<void> {
    // Close current stores
    await this.closeAllStores();
    
    // Initialize new organization store
    await this.getStore(newOrgId, clientId);
  }

  private async closeAllStores(): Promise<void> {
    for (const store of this.stores.values()) {
      await store.close();
    }
    this.stores.clear();
    this.adapters.clear();
  }
}
```

#### 3.2 Container Access Control Integration
```typescript
export class LiveStoreContainerAccessService {
  constructor(
    private store: LiveStore,
    private organizationId: string
  ) {}

  /**
   * Check if user has access to entity based on container membership
   */
  async canAccess(userId: string, entityType: string, entityId: string, operation: 'read' | 'write'): Promise<boolean> {
    // Get entity's container information
    const entity = await this.store.query(`
      SELECT containerType, containerId 
      FROM ${entityType} 
      WHERE id = ? AND organizationId = ?
    `, [entityId, this.organizationId]);

    if (!entity || entity.length === 0) {
      return false;
    }

    const { containerType, containerId } = entity[0];

    // Check user's role in the container
    const permission = await this.store.query(`
      SELECT role 
      FROM containerPermissions 
      WHERE userId = ? AND containerType = ? AND containerId = ? AND organizationId = ?
    `, [userId, containerType, containerId, this.organizationId]);

    if (!permission || permission.length === 0) {
      return false;
    }

    const role = permission[0].role;
    const requiredRole = operation === 'write' ? 'MEMBER' : 'VIEWER';
    
    return this.hasRequiredRole(role, requiredRole);
  }

  /**
   * Get all entities user has access to of a given archetype
   */
  async getAccessibleEntities(userId: string, archetype: string): Promise<any[]> {
    return this.store.query(`
      SELECT e.*, cp.role as userRole
      FROM ${archetype} e
      JOIN containerPermissions cp ON 
        cp.containerType = e.containerType AND 
        cp.containerId = e.containerId AND
        cp.organizationId = e.organizationId
      WHERE cp.userId = ? AND e.organizationId = ?
      ORDER BY e.updatedAt DESC
    `, [userId, this.organizationId]);
  }

  /**
   * Grant container access with automatic event tracking
   */
  async grantAccess(
    targetUserId: string, 
    containerType: string, 
    containerId: string, 
    role: string,
    grantedByUserId: string
  ): Promise<void> {
    await this.store.apply({
      type: 'ContainerPermissionGranted',
      data: {
        userId: targetUserId,
        containerType,
        containerId,
        role,
        grantedBy: grantedByUserId,
        organizationId: this.organizationId
      }
    });
  }

  private hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = ['ADMIN', 'OWNER', 'MEMBER', 'VIEWER'];
    const userIndex = roleHierarchy.indexOf(userRole);
    const requiredIndex = roleHierarchy.indexOf(requiredRole);
    return userIndex <= requiredIndex; // Lower index = higher privilege
  }
}
```

### Phase 4: Complete Migration (Weeks 13-16)

#### 4.1 Unified API Layer
```typescript
export class VibeStackDataManager {
  private liveStoreManager: MultiTenantLiveStoreManager;
  private currentOrganizationId: string;
  private currentClientId: string;
  private userContext: UserContext;

  constructor(organizationId: string, clientId: string, userContext: UserContext) {
    this.liveStoreManager = new MultiTenantLiveStoreManager();
    this.currentOrganizationId = organizationId;
    this.currentClientId = clientId;
    this.userContext = userContext;
  }

  /**
   * Get archetype service with automatic access control
   */
  async getArchetypeService<T>(archetype: string): Promise<BaseArchetypeService<T>> {
    const store = await this.liveStoreManager.getStore(
      this.currentOrganizationId, 
      this.currentClientId
    );
    
    const accessControl = new LiveStoreContainerAccessService(
      store, 
      this.currentOrganizationId
    );

    const serviceMap = {
      'project': () => new ProjectService(store, accessControl, this.currentOrganizationId),
      'task': () => new TaskService(store, accessControl, this.currentOrganizationId),
      'record': () => new RecordService(store, accessControl, this.currentOrganizationId),
      'document': () => new DocumentService(store, accessControl, this.currentOrganizationId),
      'file': () => new FileService(store, accessControl, this.currentOrganizationId),
      'activity': () => new ActivityService(store, accessControl, this.currentOrganizationId),
      'discussion': () => new DiscussionService(store, accessControl, this.currentOrganizationId),
      'collection': () => new CollectionService(store, accessControl, this.currentOrganizationId)
    };

    const serviceFactory = serviceMap[archetype];
    if (!serviceFactory) {
      throw new Error(`Unknown archetype: ${archetype}`);
    }

    return serviceFactory() as BaseArchetypeService<T>;
  }

  /**
   * Universal entity operations
   */
  async findById<T>(archetype: string, id: string): Promise<T | null> {
    const service = await this.getArchetypeService<T>(archetype);
    return service.findById(id, this.userContext);
  }

  async create<T>(archetype: string, data: Partial<T>): Promise<T> {
    const service = await this.getArchetypeService<T>(archetype);
    return service.create(data, this.userContext);
  }

  async update<T>(archetype: string, id: string, changes: Partial<T>): Promise<T> {
    const service = await this.getArchetypeService<T>(archetype);
    return service.update(id, changes, this.userContext);
  }

  async findMany<T>(archetype: string, filters: any): Promise<T[]> {
    const service = await this.getArchetypeService<T>(archetype);
    return service.findMany(filters, this.userContext);
  }

  /**
   * Complex cross-archetype queries leveraging SQLite joins
   */
  async getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
    const store = await this.liveStoreManager.getStore(
      this.currentOrganizationId, 
      this.currentClientId
    );

    // Complex SQL query across multiple archetypes
    const result = await store.query(`
      SELECT 
        p.id as projectId,
        p.name as projectName,
        p.status as projectStatus,
        COUNT(t.id) as totalTasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completedTasks,
        COUNT(DISTINCT t.assigneeId) as assigneeCount,
        COUNT(d.id) as discussionCount,
        COUNT(f.id) as fileCount
      FROM projects p
      LEFT JOIN tasks t ON t.projectId = p.id AND t.organizationId = p.organizationId
      LEFT JOIN discussions d ON d.parentEntityType = 'project' AND d.parentEntityId = p.id
      LEFT JOIN files f ON f.parentEntityType = 'project' AND f.parentEntityId = p.id
      JOIN containerPermissions cp ON 
        cp.containerType = p.containerType AND 
        cp.containerId = p.containerId AND 
        cp.userId = ? AND
        cp.organizationId = p.organizationId
      WHERE p.id = ? AND p.organizationId = ?
      GROUP BY p.id
    `, [this.userContext.userId, projectId, this.currentOrganizationId]);

    return result[0] as ProjectDashboard;
  }

  /**
   * Handle organization switching
   */
  async switchOrganization(newOrganizationId: string): Promise<void> {
    this.currentOrganizationId = newOrganizationId;
    await this.liveStoreManager.switchOrganization(newOrganizationId, this.currentClientId);
  }
}
```

#### 4.2 React Integration Layer
```typescript
export const VibeStackProvider: React.FC<{
  organizationId: string;
  clientId: string;
  userContext: UserContext;
  children: React.ReactNode;
}> = ({ organizationId, clientId, userContext, children }) => {
  const [dataManager] = useState(() => 
    new VibeStackDataManager(organizationId, clientId, userContext)
  );

  return (
    <VibeStackContext.Provider value={dataManager}>
      {children}
    </VibeStackContext.Provider>
  );
};

// Custom hooks for each archetype
export function useProjects(filters?: any) {
  const dataManager = useContext(VibeStackContext);
  
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => dataManager.findMany<Project>('project', filters)
  });
}

export function useProject(projectId: string) {
  const dataManager = useContext(VibeStackContext);
  
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => dataManager.findById<Project>('project', projectId)
  });
}

export function useProjectTasks(projectId: string) {
  const dataManager = useContext(VibeStackContext);
  
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () => dataManager.findMany<Task>('task', { projectId })
  });
}

// Mutation hooks with automatic cache invalidation
export function useCreateProject() {
  const queryClient = useQueryClient();
  const dataManager = useContext(VibeStackContext);
  
  return useMutation({
    mutationFn: (data: Partial<Project>) => 
      dataManager.create<Project>('project', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const dataManager = useContext(VibeStackContext);
  
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const taskService = await dataManager.getArchetypeService<Task>('task') as TaskService;
      return taskService.complete(taskId, dataManager.userContext);
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    }
  });
}
```

## Implementation Timeline

### Weeks 1-4: Foundation
- **Week 1:** LiveStore setup + basic schema design for 2 archetypes (Project, Task)
- **Week 2:** Translation layer implementation + server protocol integration
- **Week 3:** Basic archetype services (CRUD operations)
- **Week 4:** Container access control integration

### Weeks 5-8: Core Archetypes  
- **Week 5:** Record archetype with complex relationships
- **Week 6:** Document archetype with file attachments
- **Week 7:** Activity and Discussion archetypes
- **Week 8:** Collection archetype + cross-archetype queries

### Weeks 9-12: Multi-Tenant Integration
- **Week 9:** Multi-tenant LiveStore manager
- **Week 10:** Organization switching + data isolation
- **Week 11:** Advanced access control patterns
- **Week 12:** Performance optimization + caching

### Weeks 13-16: UI Integration & Polish
- **Week 13:** React hooks + TanStack Query integration
- **Week 14:** Complex dashboard queries + UI components  
- **Week 15:** Performance testing + optimization
- **Week 16:** Dexie removal + cleanup

## Risk Mitigation

### Technical Risks
1. **SQLite Performance:** LiveStore uses SQLite WASM which could be slower than IndexedDB
   - **Mitigation:** Performance benchmarking in Week 1, optimization in Week 15
   
2. **Event Translation Complexity:** Complex events might not map cleanly to TableChange format
   - **Mitigation:** Start with simple CRUD events, add complexity gradually

3. **Access Control Edge Cases:** SQLite queries might not handle all access patterns
   - **Mitigation:** Comprehensive test coverage for all archetype access patterns

### Business Risks
1. **Migration Timeline:** 16 weeks could impact other feature development
   - **Mitigation:** Parallel development teams, infrastructure-first approach

2. **User Experience Disruption:** Data access patterns will change significantly
   - **Mitigation:** Maintain API compatibility, gradual UI migration

## Success Metrics

### Technical Metrics
- **Query Performance:** 90% of queries under 100ms (vs current Dexie baseline)
- **Storage Efficiency:** 50% reduction in local storage usage via SQLite compression
- **Code Complexity:** 60% reduction in data access code via unified archetype pattern

### Business Metrics  
- **Developer Velocity:** 40% faster feature development with universal data patterns
- **Bug Reduction:** 70% fewer data consistency bugs via ACID transactions
- **User Experience:** Seamless offline experience with better conflict resolution

## Conclusion

This migration plan transforms a necessary rewrite (archetypes + access control + multi-tenancy) into an opportunity to upgrade our entire client data architecture. Since we must rewrite all data access code anyway, switching to LiveStore provides significant benefits with minimal additional cost.

The phased approach ensures we can validate each component before moving to the next, with clear rollback points if issues arise. The translation layer approach means zero server-side changes, eliminating the largest source of migration risk.

**Recommendation: Proceed with implementation starting Week 1 with Project and Task archetypes POC.**