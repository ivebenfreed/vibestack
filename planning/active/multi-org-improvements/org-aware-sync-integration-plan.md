# Organization-Aware Sync & Replication Integration Plan

**Status**: Planning Phase  
**Goal**: Integrate organization separation and permission system into both direct server sync and client-to-client sync

## Current Architecture Analysis

### SyncDO (Client-to-Server Sync)
**Current State:**
- Handles WebSocket connections from individual clients
- Routes messages through specialized service modules
- Uses `clientId` for identification but lacks organization context
- No permission-based filtering of sync data
- Broadcasts changes without org-aware filtering

**Key Files:**
- `/apps/server/src/sync/SyncDO.ts` - Main sync coordinator
- `/apps/server/src/sync/WebSocketManager.ts` - Connection management
- `/apps/server/src/sync/BroadcastManager.ts` - Change broadcasting

### ReplicationDO (Server-to-Client Broadcasting)
**Current State:**
- Handles PostgreSQL WAL replication monitoring
- Broadcasts changes to all SyncDO instances globally
- No organization-level filtering - all clients receive all changes
- Uses generic change processing without permission checks

**Key Files:**
- `/apps/server/src/replication/ReplicationDO.ts` - WAL monitoring
- `/apps/server/src/replication/process-changes.ts` - Change processing
- `/apps/server/src/replication/PollingManager.ts` - WAL polling

### Auth & Permission System
**Available Components:**
- Better Auth with organization plugin (`/apps/server/src/lib/auth.ts`)
- OrgAccessService for organization membership (`/apps/server/src/services/org-access-service.ts`)
- ContainerPermission system for role-based access
- Session-based user context with organization data

## Integration Plan

### Phase 1: Organization Context in SyncDO

#### 1.1 WebSocket Connection Enhancement
**Goal**: Extract organization context during WebSocket upgrade

**Changes to SyncDO.ts:**
```typescript
interface SyncConnection {
  clientId: string;
  userId: string;
  organizationId: string;
  organizationSlug: string;
  userRole: string;
  permissions: string[];
  sessionData: any;
}
```

**Implementation:**
- Extract `Authorization` header or session cookie from WebSocket upgrade request
- Validate session using Better Auth
- Resolve user's organization membership via OrgAccessService
- Store organization context in SyncDO instance
- Reject connections for users without valid organization access

#### 1.2 Organization-Scoped Message Handling
**Goal**: Filter all sync operations by organization membership

**New Service: OrgAwareSyncManager**
```typescript
class OrgAwareSyncManager {
  async validateTableAccess(tableName: string, organizationId: string): boolean
  async filterChangesByOrg(changes: TableChange[], organizationId: string): TableChange[]
  async validatePermissions(action: string, resource: string, userRole: string): boolean
}
```

**Integration Points:**
- Initial sync: Only return tables belonging to user's organization
- Live changes: Filter incoming changes by organization prefix
- Client changes: Validate organization ownership before processing

### Phase 2: Consolidated OrgOpsDO

#### 2.1 Enhanced OrgOpsDO (Consolidated Organization Operations)
**Goal**: Consolidate all org operations into single DO per organization

**Enhanced OrgOpsDO** (combining OrgSchemaDO + OrgAdminDO + PermissionGraph):
```typescript
class OrgOpsDO implements DurableObject {
  // === Schema Operations (from OrgSchemaDO) ===
  private orgSchema: OrgSchemaData;
  private entityConfigs: Map<string, EntityConfig>;
  
  // === Admin Operations (from OrgAdminDO) ===  
  private organization: CachedOrganization;
  private members: Map<string, CachedMember>;
  private membersByRole: Map<string, Set<string>>;
  
  // === NEW: Permission Graph Cache ===
  private permissionGraph: Map<string, UserPermissionNode>;
  private entityAccessMatrix: Map<string, Set<string>>; // entityName -> userIds with access
  private lastPermissionSync: Date;
  
  // Schema operations
  async createArchetype(data: ArchetypeRequest): Promise<ArchetypeResponse>
  async clearTempSchema(entityName: string): Promise<void>
  
  // Admin operations  
  async checkAccess(userId: string): Promise<AccessResult>
  async syncMembers(orgData: OrgSyncData): Promise<void>
  
  // NEW: Permission operations
  async getUserPermissions(userId: string): Promise<SyncPermissions>
  async validateTableAccess(userId: string, tableName: string): Promise<boolean>
  async getAuthorizedUsers(tableName: string): Promise<string[]>
  async syncPermissionGraph(): Promise<void>
}

interface UserPermissionNode {
  userId: string;
  organizationId: string;
  role: string;
  permissions: {
    'entities:read': Set<string>;    // Set of entity names user can read
    'entities:write': Set<string>;   // Set of entity names user can write  
    'sync:subscribe': boolean;       // Can establish sync connection
    'sync:broadcast': boolean;       // Can trigger broadcasts to others
  };
  containerAccess: Map<string, string>; // containerId -> permission level
  lastUpdated: Date;
}
```

**Key Benefits:**
- **Single DO per org**: Consolidates schema + admin + permission operations
- **Reduced DO overhead**: No need for multiple DOs per organization  
- **Sub-millisecond permission checks** leveraging existing cached member data
- **Bulk permission validation** using pre-computed access matrices
- **Entity-level access control** without additional database queries
- **Leverages existing caches**: Permission graph builds on cached org/member data

#### 2.2 Permission Graph Synchronization
**Goal**: Keep permission cache in sync with ContainerPermission system

**Sync Triggers:**
- **On user role change**: Update user's permission node
- **On container permission change**: Refresh affected users
- **Periodic sync**: Every 5 minutes for consistency
- **On-demand sync**: When permission validation fails

**Integration with ContainerPermission:**
```typescript
class PermissionGraphSync {
  async syncUserPermissions(userId: string, orgId: string): Promise<void> {
    // Query ContainerPermission for user's access
    const containers = await this.getContainerPermissions(userId, orgId);
    
    // Build entity access sets
    const entityRead = new Set<string>();
    const entityWrite = new Set<string>();
    
    for (const container of containers) {
      const entities = await this.getContainerEntities(container.id);
      if (container.permission_type >= 'read') entityRead.add(...entities);
      if (container.permission_type >= 'write') entityWrite.add(...entities);  
    }
    
    // Update permission graph
    await this.updatePermissionNode(userId, { entityRead, entityWrite });
  }
}
```

#### 2.3 Consolidated DO Operations
**Goal**: Ultra-fast permission validation leveraging existing org caches

**Single DO for All Org Operations:**
```typescript
class OrgAwareSyncManager {
  private orgOpsDO: OrgOpsDO; // Same DO used for schema + admin + permissions
  
  async validateSyncAccess(userId: string, action: 'read' | 'write', tableName: string): Promise<boolean> {
    // Single DO call combining member check + permission validation
    const doId = this.env.ORG_OPS.idFromName(organizationId);
    const doStub = this.env.ORG_OPS.get(doId);
    return await doStub.validateTableAccess(userId, tableName, action);
  }
  
  async getAuthorizedClientsForBroadcast(tableName: string, orgId: string): Promise<string[]> {
    // Leverages cached member data + permission graph in same DO
    const doId = this.env.ORG_OPS.idFromName(orgId);
    const doStub = this.env.ORG_OPS.get(doId);
    return await doStub.getAuthorizedUsers(tableName);
  }
  
  // Bonus: Can also handle schema operations in same DO
  async createArchetypeEntity(orgId: string, entityData: any): Promise<any> {
    const doId = this.env.ORG_OPS.idFromName(orgId);
    const doStub = this.env.ORG_OPS.get(doId);
    return await doStub.createArchetype(entityData); // Same DO!
  }
}
```

### Phase 3: Organization-Aware Change Broadcasting

#### 3.1 ReplicationDO Organization Filtering
**Goal**: Filter WAL changes by organization before broadcasting

**New Component: OrgAwareReplicationService**
```typescript
class OrgAwareReplicationService {
  async processWALChange(change: WALChange): Promise<OrgScopedChange[]>
  async routeChangeToOrganizations(change: OrgScopedChange): Promise<void>
  async broadcastToOrgMembers(orgId: string, change: TableChange[]): Promise<void>
}
```

**Integration:**
- Parse table names to extract organization prefixes (`${orgId}_${tableName}`)
- Route changes only to SyncDO instances belonging to that organization
- Maintain organization → SyncDO mapping for efficient broadcasting

#### 3.2 Client-to-Client Sync with Org Isolation
**Goal**: Ensure client changes only reach same-organization members

**Enhanced BroadcastManager:**
```typescript
class OrgAwareBroadcastManager extends BroadcastManager {
  async broadcastChangesToOrgMembers(
    changes: TableChange[], 
    originClientId: string, 
    organizationId: string
  ): Promise<void>
  
  async validateCrossClientSync(
    sourceOrgId: string, 
    targetClientIds: string[]
  ): Promise<string[]> // Return valid target client IDs
}
```

**Implementation:**
- Maintain registry of active SyncDO instances by organization
- Filter broadcast targets to same-organization clients only
- Apply anti-echo logic within organization boundaries
- Validate permissions for cross-client change propagation

### Phase 4: Enhanced Security & Monitoring

#### 4.1 Sync Audit Trail
**Goal**: Track organization-specific sync activities

**Audit Events:**
- User connects to org-specific sync
- Client changes processed with org validation  
- Permission violations during sync
- Cross-organization access attempts

#### 4.2 Rate Limiting & Abuse Prevention
**Goal**: Organization-scoped rate limiting

**Implementation:**
- Rate limit sync connections per organization
- Throttle change broadcast frequency per org
- Detect and prevent cross-org data leakage attempts

## Implementation Phases

### Week 1: Foundation (Days 1-2)
- [ ] Extract organization context from WebSocket connections
- [ ] Implement OrgAwareSyncManager service
- [ ] Add organization validation to SyncDO
- [ ] Test basic org-scoped connections

### Week 1: Consolidate to OrgOpsDO (Days 3-4)  
- [ ] Merge OrgSchemaDO + OrgAdminDO + PermissionGraph into single OrgOpsDO
- [ ] Implement permission graph synchronization with ContainerPermission inside OrgOpsDO  
- [ ] Add fast-path permission validation leveraging existing cached member data
- [ ] Test consolidated DO operations and permission checks

### Week 1: Broadcasting Enhancement (Day 5)
- [ ] Implement organization-aware change broadcasting
- [ ] Update ReplicationDO with org filtering
- [ ] Enhance BroadcastManager for org isolation
- [ ] Test client-to-client org-scoped sync

### Week 2: Testing & Validation
- [ ] Multi-organization sync isolation testing
- [ ] Permission boundary validation
- [ ] Cross-org access attempt prevention
- [ ] Performance testing with org-scoped filtering

## Success Criteria

### Organization Isolation
✅ **Complete Data Isolation**: Users can only sync data from their own organization  
✅ **Table-Level Filtering**: Only org-prefixed tables are accessible to org members  
✅ **Change Broadcasting**: Live changes only reach same-organization clients  

### Permission-Based Access
✅ **Role-Based Sync**: Admin/member/viewer roles determine sync capabilities  
✅ **Container Permissions**: Existing permission system controls entity access  
✅ **Action Validation**: Read/write permissions enforced during sync operations  

### Security & Performance
✅ **Cross-Org Prevention**: No data leakage between organizations  
✅ **Session Validation**: All sync connections require valid authenticated sessions  
✅ **Efficient Filtering**: Organization-scoped operations maintain performance  

## Technical Integration Points

### Database Schema
- Organization-prefixed tables: `${orgId}_${entityName}`
- Member table joins for org validation
- Session-based user context resolution

### Durable Objects Integration  
- **OrgOpsDO**: Consolidated per-org DO (schema + admin + permission cache)
  - Replaces: OrgSchemaDO, OrgAdminDO, PermissionGraphDO
  - Single DO per organization for all operations
  - Leverages existing caches for permission validation
- **SyncDO**: Instances scoped to organization contexts with permission validation
- **ReplicationDO**: Org-aware change routing with bulk permission checks via OrgOpsDO

### Better Auth Integration
- Session extraction from WebSocket connections  
- Organization plugin for multi-org user management
- Role-based permission resolution via OrgAccessService

## Risk Mitigation

### Performance Considerations
- **PermissionGraphDO**: Sub-millisecond permission validation for sync operations
- **Bulk Permission Checks**: Validate multiple users/entities in single DO call
- **In-Memory Permission Graph**: No database queries during sync operations
- **Efficient Broadcast Filtering**: Pre-computed authorized user lists per entity
- **Organization Membership Caching**: Use OrgAdminDO for fast org access checks

### Security Vulnerabilities  
- Validate organization context on every sync operation
- Prevent clientId spoofing across organizations
- Audit all cross-organization access attempts

### Backwards Compatibility
- Gradual rollout with feature flags
- Fallback to existing sync behavior if org context missing
- Migration strategy for existing sync connections

## Migration Strategy

### Consolidating Existing DOs into OrgOpsDO

1. **Merge OrgSchemaDO + OrgAdminDO**: Combine existing functionality into single OrgOpsDO
2. **Update all references**: Change ORG_SCHEMA and ORG_ADMIN bindings to ORG_OPS  
3. **Backward compatibility**: Support both old and new endpoints during migration
4. **Add permission graph**: Extend with permission cache functionality

## Next Steps

1. **Phase 1 Implementation**: Start with organization context extraction in SyncDO
2. **OrgOpsDO Consolidation**: Merge existing DOs and add permission graph
3. **OrgAwareSyncManager**: New service using consolidated OrgOpsDO
4. **Incremental Testing**: Validate each phase with real scenarios
5. **Performance Validation**: Ensure consolidated DO maintains performance
6. **Security Audit**: Complete organization isolation verification