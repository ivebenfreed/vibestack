# WAL-Based Role/Permission Updates & Entity API Events Integration

## Executive Summary

This plan integrates Write-Ahead Logging (WAL) events with Organization Actor cache management and entity APIs to create a real-time, event-driven system. Changes to roles, permissions, and business data automatically trigger cache updates and business events across all connected clients.

**INTEGRATION STATUS**: This plan builds on the completed **Phase 4: Route Migration** where the Universal Archetype API has been successfully migrated to hybrid security middleware with zero-latency SQLite cache operations.

### Key Objectives
- **Real-time cache invalidation** via WAL triggers
- **Automatic event propagation** to Organization Actor WebSocket connections
- **Built-in entity API events** for business logic automation
- **Zero-latency cache updates** maintaining data consistency
- **Event-driven architecture** for reactive business processes

### Prerequisites (✅ COMPLETE)
- ✅ **Organization Actor SQLite Architecture** - Foundation complete
- ✅ **Hybrid Security Middleware** - Zero-latency permission checks implemented
- ✅ **Archetype API Migration** - 9 routes successfully migrated
- ✅ **Type System Integration** - Full TypeScript support
- ⏳ **Organizations API Migration** - Planned for Phase 5

---

## Current WAL Infrastructure

### Existing WAL Implementation

```sql
-- Current WAL monitoring (from migration 006)
CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id TEXT,
    organization_id UUID,
    changes JSONB,
    lsn TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- WAL processing function
CREATE OR REPLACE FUNCTION process_wal_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log changes to change_history table
    INSERT INTO change_history (table_name, operation, record_id, organization_id, changes, lsn)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id::text, NEW.organization_id, row_to_json(NEW), pg_current_wal_lsn()::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### WAL Poller Service

```typescript
// Current WAL poller implementation
class WALPoller {
  async pollChanges() {
    const changes = await this.getChangesSinceLastLSN();
    for (const change of changes) {
      await this.notifySyncDO(change);
    }
  }
}
```

---

## Enhanced WAL Event System

### 1. Role & Permission Change Detection

```sql
-- Enhanced change detection for security-related tables
CREATE OR REPLACE FUNCTION detect_security_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_type TEXT;
    affected_user_id TEXT;
    affected_org_id UUID;
    event_data JSONB;
BEGIN
    -- Determine change type and affected entities
    CASE TG_TABLE_NAME
        WHEN 'organization_members' THEN
            affected_user_id := COALESCE(NEW.user_id, OLD.user_id);
            affected_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
            
            -- Detect role changes
            IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
                change_type := 'role_changed';
                event_data := jsonb_build_object(
                    'user_id', affected_user_id,
                    'organization_id', affected_org_id,
                    'old_role', OLD.role,
                    'new_role', NEW.role,
                    'permissions_changed', true
                );
            ELSIF TG_OP = 'INSERT' THEN
                change_type := 'member_added';
                event_data := jsonb_build_object(
                    'user_id', affected_user_id,
                    'organization_id', affected_org_id,
                    'role', NEW.role,
                    'status', NEW.status
                );
            ELSIF TG_OP = 'DELETE' THEN
                change_type := 'member_removed';
                event_data := jsonb_build_object(
                    'user_id', affected_user_id,
                    'organization_id', affected_org_id,
                    'role', OLD.role
                );
            END IF;
            
        WHEN 'container_permissions' THEN
            affected_user_id := COALESCE(NEW.user_id, OLD.user_id);
            affected_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
            change_type := 'permission_changed';
            event_data := jsonb_build_object(
                'user_id', affected_user_id,
                'organization_id', affected_org_id,
                'container_id', COALESCE(NEW.container_id, OLD.container_id),
                'permission_type', COALESCE(NEW.permission_type, OLD.permission_type),
                'granted', CASE TG_OP 
                    WHEN 'DELETE' THEN false 
                    ELSE NEW.granted 
                END
            );
    END CASE;
    
    -- Insert security change event
    IF change_type IS NOT NULL THEN
        INSERT INTO security_change_events (
            id,
            change_type,
            affected_user_id,
            affected_organization_id,
            event_data,
            lsn,
            created_at
        ) VALUES (
            generate_uuidv7(),
            change_type,
            affected_user_id,
            affected_org_id,
            event_data,
            pg_current_wal_lsn()::text,
            NOW()
        );
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Security change events table
CREATE TABLE security_change_events (
    id UUID PRIMARY KEY,
    change_type TEXT NOT NULL, -- role_changed, member_added, member_removed, permission_changed
    affected_user_id TEXT NOT NULL,
    affected_organization_id UUID NOT NULL,
    event_data JSONB NOT NULL,
    lsn TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create triggers for security tables
CREATE TRIGGER security_changes_trigger_members
    AFTER INSERT OR UPDATE OR DELETE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION detect_security_changes();

CREATE TRIGGER security_changes_trigger_permissions  
    AFTER INSERT OR UPDATE OR DELETE ON container_permissions
    FOR EACH ROW EXECUTE FUNCTION detect_security_changes();
```

### 2. Business Entity Change Events

```sql
-- Enhanced business entity change detection
CREATE OR REPLACE FUNCTION detect_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
    table_info RECORD;
    event_type TEXT;
    entity_data JSONB;
    change_data JSONB;
BEGIN
    -- Extract table and organization info
    SELECT 
        substring(TG_TABLE_NAME from 'org_([a-f0-9\-]+)_(.+)') as org_id,
        substring(TG_TABLE_NAME from 'org_[a-f0-9\-]+_(.+)') as entity_type
    INTO table_info;
    
    -- Determine event type
    event_type := CASE TG_OP
        WHEN 'INSERT' THEN 'entity_created'
        WHEN 'UPDATE' THEN 'entity_updated'  
        WHEN 'DELETE' THEN 'entity_deleted'
    END;
    
    -- Build entity data
    entity_data := CASE TG_OP
        WHEN 'DELETE' THEN row_to_json(OLD)::jsonb
        ELSE row_to_json(NEW)::jsonb
    END;
    
    -- Build change data for updates
    IF TG_OP = 'UPDATE' THEN
        change_data := jsonb_build_object(
            'old', row_to_json(OLD)::jsonb,
            'new', row_to_json(NEW)::jsonb,
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(row_to_json(NEW)::jsonb)
                WHERE value != (row_to_json(OLD)::jsonb ->> key)::jsonb
            )
        );
    ELSE
        change_data := entity_data;
    END IF;
    
    -- Insert business event
    INSERT INTO business_change_events (
        id,
        event_type,
        entity_type,
        entity_id,
        organization_id,
        entity_data,
        change_data,
        lsn,
        created_at
    ) VALUES (
        generate_uuidv7(),
        event_type,
        table_info.entity_type,
        COALESCE(NEW.id, OLD.id)::text,
        table_info.org_id::uuid,
        entity_data,
        change_data,
        pg_current_wal_lsn()::text,
        NOW()
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Business change events table
CREATE TABLE business_change_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL, -- entity_created, entity_updated, entity_deleted
    entity_type TEXT NOT NULL, -- project, task, user, etc.
    entity_id TEXT NOT NULL,
    organization_id UUID NOT NULL,
    entity_data JSONB NOT NULL,
    change_data JSONB NOT NULL,
    lsn TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Function to auto-create triggers for business tables
CREATE OR REPLACE FUNCTION setup_entity_change_triggers()
RETURNS TEXT AS $$
DECLARE
    table_record RECORD;
    trigger_count INTEGER := 0;
BEGIN
    -- Find all business tables (org_*_* pattern)
    FOR table_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'org_%_%'
        AND schemaname = 'public'
    LOOP
        -- Create trigger for each business table
        EXECUTE format('
            CREATE TRIGGER entity_changes_trigger_%I
                AFTER INSERT OR UPDATE OR DELETE ON %I.%I
                FOR EACH ROW EXECUTE FUNCTION detect_entity_changes()',
            table_record.tablename,
            table_record.schemaname, 
            table_record.tablename
        );
        
        trigger_count := trigger_count + 1;
        RAISE NOTICE 'Created entity change trigger for: %', table_record.tablename;
    END LOOP;
    
    RETURN format('Created entity change triggers for %s business tables', trigger_count);
END;
$$ LANGUAGE plpgsql;

-- Execute to create all triggers
SELECT setup_entity_change_triggers();
```

---

## Enhanced WAL Poller with Event Processing

### WAL Event Processor

```typescript
/**
 * Enhanced WAL Poller with Organization Actor cache invalidation
 * and business event propagation
 */
export class EnhancedWALPoller {
  private lastSecurityLSN: string = '';
  private lastBusinessLSN: string = '';
  
  constructor(
    private env: Env,
    private database: any
  ) {}
  
  /**
   * Main polling loop - processes both security and business events
   */
  async pollAndProcessEvents(): Promise<void> {
    try {
      // Process security events (roles, permissions)
      await this.processSecurityEvents();
      
      // Process business events (entities)
      await this.processBusinessEvents();
      
    } catch (error) {
      syncLogger.error('WAL event processing failed', {
        error: error instanceof Error ? error.message : String(error)
      }, 'WALPoller');
    }
  }
  
  /**
   * Process security-related changes (roles, permissions)
   */
  private async processSecurityEvents(): Promise<void> {
    const securityEvents = await this.database
      .selectFrom('security_change_events')
      .selectAll()
      .where('processed', '=', false)
      .where('lsn', '>', this.lastSecurityLSN)
      .orderBy('created_at', 'asc')
      .limit(100)
      .execute();
    
    for (const event of securityEvents) {
      await this.processSecurityEvent(event);
      this.lastSecurityLSN = event.lsn;
    }
    
    // Mark events as processed
    if (securityEvents.length > 0) {
      await this.database
        .updateTable('security_change_events')
        .set({ processed: true })
        .where('id', 'in', securityEvents.map(e => e.id))
        .execute();
    }
  }
  
  /**
   * Process individual security event
   */
  private async processSecurityEvent(event: SecurityChangeEvent): Promise<void> {
    const { change_type, affected_organization_id, affected_user_id, event_data } = event;
    
    try {
      // Get Organization Actor for affected organization
      const orgActor = this.getOrganizationActor(affected_organization_id);
      
      switch (change_type) {
        case 'role_changed':
          await this.handleRoleChanged(orgActor, affected_user_id, affected_organization_id, event_data);
          break;
          
        case 'member_added':
          await this.handleMemberAdded(orgActor, affected_user_id, affected_organization_id, event_data);
          break;
          
        case 'member_removed':
          await this.handleMemberRemoved(orgActor, affected_user_id, affected_organization_id, event_data);
          break;
          
        case 'permission_changed':
          await this.handlePermissionChanged(orgActor, affected_user_id, affected_organization_id, event_data);
          break;
      }
      
      syncLogger.info('Security event processed', {
        changeType: change_type,
        organizationId: affected_organization_id.substring(0, 8) + '...',
        userId: affected_user_id.substring(0, 8) + '...'
      }, 'WALPoller');
      
    } catch (error) {
      syncLogger.error('Failed to process security event', {
        eventId: event.id,
        changeType: change_type,
        error: error instanceof Error ? error.message : String(error)
      }, 'WALPoller');
    }
  }
  
  /**
   * Handle role change events
   */
  private async handleRoleChanged(
    orgActor: DurableObjectStub,
    userId: string,
    organizationId: string,
    eventData: any
  ): Promise<void> {
    // 1. Invalidate role cache
    await orgActor.fetch(new Request('https://internal/invalidate-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, organizationId })
    }));
    
    // 2. Invalidate all permission cache for user
    await this.invalidateUserPermissions(orgActor, userId);
    
    // 3. Broadcast role change to connected clients
    await orgActor.fetch(new Request('https://internal/broadcast-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'role_changed',
        userId,
        oldRole: eventData.old_role,
        newRole: eventData.new_role,
        timestamp: Date.now()
      })
    }));
  }
  
  /**
   * Handle permission change events
   */
  private async handlePermissionChanged(
    orgActor: DurableObjectStub,
    userId: string,
    organizationId: string,
    eventData: any
  ): Promise<void> {
    // 1. Invalidate specific permission cache
    await orgActor.fetch(new Request('https://internal/invalidate-permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        resourceType: 'container',
        resourceId: eventData.container_id,
        action: eventData.permission_type
      })
    }));
    
    // 2. Broadcast permission change
    await orgActor.fetch(new Request('https://internal/broadcast-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'permission_changed',
        userId,
        containerId: eventData.container_id,
        permissionType: eventData.permission_type,
        granted: eventData.granted,
        timestamp: Date.now()
      })
    }));
  }
  
  /**
   * Process business entity changes
   */
  private async processBusinessEvents(): Promise<void> {
    const businessEvents = await this.database
      .selectFrom('business_change_events')
      .selectAll()
      .where('processed', '=', false)
      .where('lsn', '>', this.lastBusinessLSN)
      .orderBy('created_at', 'asc')
      .limit(100)
      .execute();
    
    for (const event of businessEvents) {
      await this.processBusinessEvent(event);
      this.lastBusinessLSN = event.lsn;
    }
    
    // Mark events as processed
    if (businessEvents.length > 0) {
      await this.database
        .updateTable('business_change_events')
        .set({ processed: true })
        .where('id', 'in', businessEvents.map(e => e.id))
        .execute();
    }
  }
  
  /**
   * Process individual business event
   */
  private async processBusinessEvent(event: BusinessChangeEvent): Promise<void> {
    const { event_type, entity_type, entity_id, organization_id, entity_data, change_data } = event;
    
    try {
      // Get Organization Actor for affected organization
      const orgActor = this.getOrganizationActor(organization_id);
      
      // 1. Invalidate schema cache if needed
      if (this.isSchemaAffectingChange(event_type, entity_type)) {
        await this.invalidateSchemaCache(orgActor, entity_type);
      }
      
      // 2. Broadcast entity change to connected clients
      await orgActor.fetch(new Request('https://internal/broadcast-entity-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: event_type,
          entityType: entity_type,
          entityId: entity_id,
          organizationId: organization_id,
          data: entity_data,
          changes: change_data,
          timestamp: Date.now()
        })
      }));
      
      // 3. Process business rules
      await this.processBusinessRules(event);
      
      syncLogger.debug('Business event processed', {
        eventType: event_type,
        entityType: entity_type,
        entityId: entity_id.substring(0, 8) + '...',
        organizationId: organization_id.substring(0, 8) + '...'
      }, 'WALPoller');
      
    } catch (error) {
      syncLogger.error('Failed to process business event', {
        eventId: event.id,
        eventType: event_type,
        entityType: entity_type,
        error: error instanceof Error ? error.message : String(error)
      }, 'WALPoller');
    }
  }
  
  /**
   * Process business rules based on entity changes
   */
  private async processBusinessRules(event: BusinessChangeEvent): Promise<void> {
    const { event_type, entity_type, organization_id, entity_data } = event;
    
    // Example business rules
    switch (`${entity_type}:${event_type}`) {
      case 'project:entity_created':
        await this.onProjectCreated(organization_id, entity_data);
        break;
        
      case 'task:entity_updated':
        await this.onTaskUpdated(organization_id, entity_data);
        break;
        
      case 'user:entity_deleted':
        await this.onUserDeleted(organization_id, entity_data);
        break;
    }
  }
  
  /**
   * Business rule: Handle project creation
   */
  private async onProjectCreated(organizationId: string, projectData: any): Promise<void> {
    // Example: Auto-assign project owner role
    // Example: Create default project tasks
    // Example: Send notifications
    
    syncLogger.info('Project created business rule triggered', {
      organizationId: organizationId.substring(0, 8) + '...',
      projectId: projectData.id.substring(0, 8) + '...',
      projectName: projectData.name
    }, 'WALPoller');
  }
  
  /**
   * Business rule: Handle task updates
   */
  private async onTaskUpdated(organizationId: string, taskData: any): Promise<void> {
    // Example: Update project progress
    // Example: Send status change notifications
    // Example: Trigger automation workflows
    
    if (taskData.status === 'completed') {
      // Handle task completion
      syncLogger.info('Task completed business rule triggered', {
        organizationId: organizationId.substring(0, 8) + '...',
        taskId: taskData.id.substring(0, 8) + '...'
      }, 'WALPoller');
    }
  }
  
  private getOrganizationActor(organizationId: string): DurableObjectStub {
    const orgActorId = this.env.ORGANIZATION_ACTOR.idFromName(`org:${organizationId}`);
    return this.env.ORGANIZATION_ACTOR.get(orgActorId);
  }
  
  private async invalidateUserPermissions(orgActor: DurableObjectStub, userId: string): Promise<void> {
    await orgActor.fetch(new Request('https://internal/invalidate-user-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    }));
  }
  
  private isSchemaAffectingChange(eventType: string, entityType: string): boolean {
    // Only invalidate schema cache for structural changes
    return eventType === 'entity_created' && ['table', 'column', 'relationship'].includes(entityType);
  }
  
  private async invalidateSchemaCache(orgActor: DurableObjectStub, entityType: string): Promise<void> {
    await orgActor.fetch(new Request('https://internal/invalidate-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName: entityType })
    }));
  }
}

// Event type definitions
interface SecurityChangeEvent {
  id: string;
  change_type: 'role_changed' | 'member_added' | 'member_removed' | 'permission_changed';
  affected_user_id: string;
  affected_organization_id: string;
  event_data: any;
  lsn: string;
  created_at: Date;
}

interface BusinessChangeEvent {
  id: string;
  event_type: 'entity_created' | 'entity_updated' | 'entity_deleted';
  entity_type: string;
  entity_id: string;
  organization_id: string;
  entity_data: any;
  change_data: any;
  lsn: string;
  created_at: Date;
}
```

---

## Enhanced Organization Actor Event Handling

### WebSocket Event Broadcasting

```typescript
// Enhanced Organization Actor with event broadcasting
export class OrganizationActor extends Actor {
  // ... existing implementation ...
  
  /**
   * Broadcast events to all connected clients
   */
  async handleBroadcastEvent(request: Request): Promise<Response> {
    try {
      const event = await request.json();
      
      await this.broadcastToClients(event);
      
      return new Response(JSON.stringify({
        success: true,
        broadcastCount: this.connections.size
      }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }
  
  /**
   * Broadcast entity events to connected clients
   */
  async handleBroadcastEntityEvent(request: Request): Promise<Response> {
    try {
      const entityEvent = await request.json();
      
      // Add event metadata
      const enrichedEvent = {
        ...entityEvent,
        id: crypto.randomUUID(),
        source: 'organization_actor',
        version: 1
      };
      
      await this.broadcastToClients(enrichedEvent);
      
      // Optional: Store event in SQLite for replay capability
      await this.storeEventForReplay(enrichedEvent);
      
      return new Response(JSON.stringify({
        success: true,
        broadcastCount: this.connections.size,
        eventId: enrichedEvent.id
      }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }
  
  /**
   * Invalidate user permissions cache
   */
  async handleInvalidateUserPermissions(request: Request): Promise<Response> {
    try {
      const { userId } = await request.json();
      
      // Remove all permission cache entries for user
      await this.ctx.storage.sql
        .prepare(`DELETE FROM permission_cache WHERE user_id = ?`)
        .bind(userId)
        .run();
      
      return new Response(JSON.stringify({ success: true }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }
  
  /**
   * Invalidate specific permission cache entry
   */
  async handleInvalidatePermission(request: Request): Promise<Response> {
    try {
      const { userId, resourceType, resourceId, action } = await request.json();
      
      await this.ctx.storage.sql
        .prepare(`
          DELETE FROM permission_cache 
          WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND action = ?
        `)
        .bind(userId, resourceType, resourceId, action)
        .run();
      
      return new Response(JSON.stringify({ success: true }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }
  
  /**
   * Invalidate schema cache
   */
  async handleInvalidateSchema(request: Request): Promise<Response> {
    try {
      const { tableName } = await request.json();
      
      await this.ctx.storage.sql
        .prepare(`DELETE FROM schema_cache WHERE table_name = ?`)
        .bind(tableName)
        .run();
      
      return new Response(JSON.stringify({ success: true }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }
  
  /**
   * Store event for replay capability
   */
  private async storeEventForReplay(event: any): Promise<void> {
    try {
      await this.ctx.storage.sql
        .prepare(`
          INSERT OR REPLACE INTO event_log 
          (id, event_type, event_data, created_at)
          VALUES (?, ?, ?, ?)
        `)
        .bind(event.id, event.type, JSON.stringify(event), Date.now())
        .run();
        
    } catch (error) {
      syncLogger.warn('Failed to store event for replay', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Enhanced fetch handler with new endpoints
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // ... existing endpoints ...
      
      if (path === '/broadcast-event') {
        return await this.handleBroadcastEvent(request);
      }
      
      if (path === '/broadcast-entity-event') {
        return await this.handleBroadcastEntityEvent(request);
      }
      
      if (path === '/invalidate-user-permissions') {
        return await this.handleInvalidateUserPermissions(request);
      }
      
      if (path === '/invalidate-permission') {
        return await this.handleInvalidatePermission(request);
      }
      
      if (path === '/invalidate-schema') {
        return await this.handleInvalidateSchema(request);
      }
      
      // ... existing endpoints ...
      
    } catch (error) {
      syncLogger.error('Organization Actor request failed', {
        path,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}
```

### Event Log SQLite Table

```sql
-- Add event log table to Organization Actor SQLite schema
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_type_created 
ON event_log(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_created 
ON event_log(created_at DESC);
```

---

## Entity API Integration

### Enhanced Entity APIs with Built-in Events

```typescript
/**
 * Enhanced entity API with automatic event generation
 */
export class EntityAPIWithEvents {
  constructor(
    private database: any,
    private organizationActorCache: OrganizationActorCacheService
  ) {}
  
  /**
   * Create entity with automatic event generation
   */
  async createEntity(
    organizationId: string,
    entityType: string,
    entityData: any,
    context: HybridSecurityContext
  ): Promise<any> {
    // 1. Security check
    if (!context.hasPermission('write')) {
      throw new Error('Insufficient permissions to create entity');
    }
    
    // 2. Create entity in database (triggers WAL event automatically)
    const tableName = `org_${organizationId.replace(/-/g, '_')}_${entityType}`;
    const entity = await this.database
      .insertInto(tableName)
      .values({
        id: crypto.randomUUID(),
        ...entityData,
        organization_id: organizationId,
        created_by: context.userId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirst();
    
    // 3. Manual business event (if needed beyond WAL)
    await this.emitBusinessEvent(organizationId, {
      type: 'entity_created',
      entityType,
      entityId: entity.id,
      entityData: entity,
      context: {
        userId: context.userId,
        organizationId,
        timestamp: Date.now()
      }
    });
    
    return entity;
  }
  
  /**
   * Update entity with automatic event generation
   */
  async updateEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    updates: any,
    context: HybridSecurityContext
  ): Promise<any> {
    // 1. Security check
    if (!context.hasPermission('write')) {
      throw new Error('Insufficient permissions to update entity');
    }
    
    // 2. Get existing entity for change detection
    const tableName = `org_${organizationId.replace(/-/g, '_')}_${entityType}`;
    const existingEntity = await this.database
      .selectFrom(tableName)
      .selectAll()
      .where('id', '=', entityId)
      .executeTakeFirst();
    
    if (!existingEntity) {
      throw new Error('Entity not found');
    }
    
    // 3. Update entity (triggers WAL event automatically)
    const updatedEntity = await this.database
      .updateTable(tableName)
      .set({
        ...updates,
        updated_by: context.userId,
        updated_at: new Date()
      })
      .where('id', '=', entityId)
      .returningAll()
      .executeTakeFirst();
    
    // 4. Emit business event with change details
    await this.emitBusinessEvent(organizationId, {
      type: 'entity_updated',
      entityType,
      entityId,
      entityData: updatedEntity,
      changes: this.detectChanges(existingEntity, updatedEntity),
      context: {
        userId: context.userId,
        organizationId,
        timestamp: Date.now()
      }
    });
    
    return updatedEntity;
  }
  
  /**
   * Delete entity with automatic event generation
   */
  async deleteEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    context: HybridSecurityContext
  ): Promise<void> {
    // 1. Security check
    if (!context.hasPermission('delete')) {
      throw new Error('Insufficient permissions to delete entity');
    }
    
    // 2. Get entity before deletion
    const tableName = `org_${organizationId.replace(/-/g, '_')}_${entityType}`;
    const entity = await this.database
      .selectFrom(tableName)
      .selectAll()
      .where('id', '=', entityId)
      .executeTakeFirst();
    
    if (!entity) {
      throw new Error('Entity not found');
    }
    
    // 3. Delete entity (triggers WAL event automatically)
    await this.database
      .deleteFrom(tableName)
      .where('id', '=', entityId)
      .execute();
    
    // 4. Emit business event
    await this.emitBusinessEvent(organizationId, {
      type: 'entity_deleted',
      entityType,
      entityId,
      entityData: entity,
      context: {
        userId: context.userId,
        organizationId,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Emit business event to Organization Actor
   */
  private async emitBusinessEvent(
    organizationId: string,
    event: BusinessEvent
  ): Promise<void> {
    try {
      const orgActor = this.organizationActorCache.getOrgActor(organizationId);
      
      await orgActor.fetch(new Request('https://internal/business-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }));
      
    } catch (error) {
      syncLogger.error('Failed to emit business event', {
        organizationId: organizationId.substring(0, 8) + '...',
        eventType: event.type,
        entityType: event.entityType,
        error: error instanceof Error ? error.message : String(error)
      }, 'EntityAPI');
    }
  }
  
  /**
   * Detect changes between old and new entity data
   */
  private detectChanges(oldEntity: any, newEntity: any): any {
    const changes: any = {};
    
    for (const [key, newValue] of Object.entries(newEntity)) {
      const oldValue = oldEntity[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          from: oldValue,
          to: newValue
        };
      }
    }
    
    return changes;
  }
}

interface BusinessEvent {
  type: 'entity_created' | 'entity_updated' | 'entity_deleted';
  entityType: string;
  entityId: string;
  entityData: any;
  changes?: any;
  context: {
    userId: string;
    organizationId: string;
    timestamp: number;
  };
}
```

---

## Real-time Client Integration

### Client-side Event Handling

```typescript
/**
 * Client-side event handler for real-time updates
 */
export class OrganizationEventHandler {
  private webSocket: WebSocket | null = null;
  private eventCallbacks = new Map<string, Array<(event: any) => void>>();
  
  constructor(
    private organizationId: string,
    private authToken: string
  ) {}
  
  /**
   * Connect to Organization Actor WebSocket
   */
  async connect(): Promise<void> {
    const wsUrl = `ws://localhost:8787/api/org-actor/${this.organizationId}/websocket`;
    
    this.webSocket = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'X-Organization-Id': this.organizationId
      }
    });
    
    this.webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleEvent(data);
    };
    
    this.webSocket.onopen = () => {
      console.log('Connected to Organization Actor events');
    };
    
    this.webSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  /**
   * Subscribe to specific event types
   */
  on(eventType: string, callback: (event: any) => void): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);
  }
  
  /**
   * Handle incoming events
   */
  private handleEvent(event: any): void {
    const { type } = event;
    
    // Call all registered callbacks for this event type
    const callbacks = this.eventCallbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event callback error:', error);
      }
    });
    
    // Handle specific event types
    switch (type) {
      case 'role_changed':
        this.handleRoleChanged(event);
        break;
        
      case 'permission_changed':
        this.handlePermissionChanged(event);
        break;
        
      case 'entity_created':
      case 'entity_updated':
      case 'entity_deleted':
        this.handleEntityChanged(event);
        break;
    }
  }
  
  /**
   * Handle role change events
   */
  private handleRoleChanged(event: any): void {
    // Update local user context
    if (event.userId === getCurrentUserId()) {
      updateLocalUserRole(event.newRole);
      showNotification(`Your role has been changed to ${event.newRole}`);
    }
  }
  
  /**
   * Handle entity change events
   */
  private handleEntityChanged(event: any): void {
    // Update local data store (Legend State, Zustand, etc.)
    updateEntityInStore(event.entityType, event.entityId, event);
    
    // Show notification for relevant changes
    if (event.type === 'entity_created') {
      showNotification(`New ${event.entityType} created: ${event.entityData.name}`);
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
  }
}

// Usage in React component
export function useOrganizationEvents(organizationId: string) {
  const [eventHandler, setEventHandler] = useState<OrganizationEventHandler | null>(null);
  
  useEffect(() => {
    const handler = new OrganizationEventHandler(organizationId, getAuthToken());
    handler.connect();
    setEventHandler(handler);
    
    // Subscribe to events
    handler.on('entity_updated', (event) => {
      // Handle entity updates in React state
      updateLocalState(event);
    });
    
    return () => {
      handler.disconnect();
    };
  }, [organizationId]);
  
  return eventHandler;
}
```

---

## Implementation Roadmap

### Phase 1: WAL Event Infrastructure (Week 1-2)
- [x] **Security change detection** - SQL triggers for roles/permissions
- [x] **Business change detection** - SQL triggers for entity tables
- [x] **Event tables** - Storage for security and business events
- [ ] **Enhanced WAL poller** - Process security and business events
- [ ] **Organization Actor event handlers** - Cache invalidation and broadcasting

### Phase 2: Entity API Integration (Week 2-3)
- [ ] **Enhanced entity APIs** - Built-in event generation
- [ ] **Business rule engine** - Automated business logic on events
- [ ] **Event replay capability** - SQLite event log for debugging
- [ ] **Cache warming triggers** - Automatic cache population

### Phase 3: Real-time Client Integration (Week 3-4)
- [ ] **Client event handlers** - WebSocket event processing
- [ ] **React hooks** - Easy event subscription in components
- [ ] **Local state synchronization** - Automatic UI updates
- [ ] **Event notification system** - User-friendly event alerts

### Phase 4: Advanced Features (Month 2)
- [ ] **Event sourcing** - Complete audit trail in events
- [ ] **Workflow automation** - Complex business process triggers
- [ ] **Cross-organization events** - Inter-org communication
- [ ] **Event analytics** - Performance and usage metrics

---

## Performance & Monitoring

### Event Processing Metrics

```typescript
interface EventMetrics {
  securityEventsProcessed: number;
  businessEventsProcessed: number;
  averageProcessingTime: number;
  cacheInvalidations: number;
  broadcastsSent: number;
  failureRate: number;
}

// Monitoring dashboard endpoints
GET /api/org-actor/:orgId/event-metrics
{
  "metrics": {
    "securityEventsProcessed": 1247,
    "businessEventsProcessed": 8934,
    "averageProcessingTime": "2.3ms",
    "cacheInvalidations": 456,
    "broadcastsSent": 9180,
    "failureRate": 0.002
  },
  "performance": {
    "walPollingLatency": "50ms",
    "eventBroadcastLatency": "1.2ms",
    "cacheInvalidationLatency": "0.5ms"
  }
}
```

### Health Monitoring

- **WAL Lag Monitoring** - Track LSN processing delays
- **Event Processing Rate** - Monitor events/second throughput
- **Cache Hit Rate Impact** - Measure invalidation effectiveness
- **WebSocket Connection Health** - Monitor client connectivity
- **Business Rule Performance** - Track business logic execution time

---

This comprehensive WAL-based event system creates a reactive, real-time architecture where changes to roles, permissions, and business entities automatically propagate through the Organization Actor SQLite cache system and broadcast to all connected clients. The result is a truly real-time collaborative application with zero-latency security checks and instant business event processing.

---

*Last Updated: August 21, 2025*  
*Document Version: 1.0*  
*Status: Ready for Implementation*