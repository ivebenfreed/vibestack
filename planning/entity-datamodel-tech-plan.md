# Entity Data Model & Multi-Tenant Architecture Tech Plan

## Executive Summary

This document outlines the technical roadmap for evolving VibeStack's entity data model to support dynamic schema evolution, container-based access control, and multi-tenant SaaS architecture with database-per-organization isolation.

## Current State Analysis

### Existing Architecture Strengths
- ✅ **Solid Foundation**: BaseSystemEntity → BaseDomainEntity hierarchy
- ✅ **MikroORM Integration**: Type-safe entity definitions with decorators
- ✅ **Local-First Sync**: Real-time collaboration via IndexedDB + WebSocket
- ✅ **DataForge Build System**: Automated code generation for CRUD operations

### Architecture Gaps
- ❌ **No Dynamic Schema**: Runtime field additions require full rebuilds
- ❌ **Limited Access Control**: No container-based inheritance model
- ❌ **Single-Tenant**: All orgs share same database schema
- ❌ **Manual Migrations**: No automated schema evolution for custom fields

### Related Issues Context
- **Issue #78**: Container-based access control with role hierarchy
- **Issue #65**: Universal sync-compatible access control (19 tables)
- **Issue #66**: JSON-driven schema configuration for runtime updates

## First Principles & Design Philosophy

### 1. Separation of Archetypes and Container Behavior
Two orthogonal concepts that can be composed:

**Archetypes** = *What kind of thing is this?* (data patterns, behavior)
- WorkItem: Things that need to be done (tasks, leads, orders, tickets)
- Record: Structured data entities (contacts, products, assets) 
- Discussion: Conversational content (comments, notes, reviews)
- Relationship: Connections between entities (dependencies, associations)

**Container Behavior** = *Can this thing organize other things?* (access control, hierarchy)
- Any archetype can optionally become a container
- Containers control access inheritance to their contents
- Dynamic containment relationships (Task → Subtasks, Contact → Family Members)

### 2. Flexible Entity Composition
```typescript
// Task starts as WorkItem, can become Container
class Task extends BaseEntity implements WorkItemTrait {
  archetypes = ['work_item'];
  
  // Later: enable container behavior for subtasks
  enableAsContainer('task_container');
}

// Contact starts as Record, can become Container  
class Contact extends BaseEntity implements RecordTrait {
  archetypes = ['record'];
  
  // Later: promote to container for company employees
  promoteToContainer('company_container');
}
```

### 3. Container-Based Access Inheritance
Access flows through container hierarchy regardless of archetype:
```
Project (Container)
  ├── Task (WorkItem + Container) 
  │   ├── Subtask (WorkItem)
  │   └── Comment (Discussion)
  └── Document (Record)
```

### 4. Schema Evolution Without Downtime
- **Build-time schema**: Static, type-safe, performant
- **Runtime schema**: Dynamic, customer-controlled, backwards-compatible
- **Unified interface**: Transparent to application logic

### 5. Multi-Tenant Isolation
- **Control plane**: Shared infrastructure for user management
- **Data plane**: Isolated databases per organization
- **Schema replication**: Consistent structure across tenant databases

### 6. Local-First Performance
- **Zero-latency queries**: All operations on local IndexedDB
- **Background sync**: Schema + data synchronization
- **Offline resilience**: Full functionality without connectivity

## Entity Archetypes: Universal Business Patterns

### Core Archetype Definitions

#### 1. WorkItem Archetype
*"Things that need to be done"*

**Common Properties:**
- Title, description, status, priority
- Assignment (who), scheduling (when), completion tracking
- Lifecycle management with configurable workflows
- Progress tracking and time estimation

**Domain Implementations:**
```typescript
class Task extends BaseWorkItem {}        // Project management
class Lead extends BaseWorkItem {}        // CRM sales pipeline  
class Order extends BaseWorkItem {}       // E-commerce fulfillment
class Ticket extends BaseWorkItem {}      // Support queue
class Issue extends BaseWorkItem {}       // Bug tracking
class Application extends BaseWorkItem {} // HR recruitment
```

**Business Value:** Standardizes how work flows through any organization, enabling cross-domain reporting and automation.

#### 2. Record Archetype  
*"Structured data entities"*

**Common Properties:**
- Primary name/title field for display
- Extensible custom fields for domain-specific data
- Audit trail and change history
- Data validation and constraints

**Domain Implementations:**
```typescript
class Contact extends BaseRecord {}       // CRM contacts
class Product extends BaseRecord {}       // E-commerce catalog
class Asset extends BaseRecord {}         // IT asset management
class Student extends BaseRecord {}       // Education platform
class Patient extends BaseRecord {}       // Healthcare system
class Employee extends BaseRecord {}      // HR management
```

**Business Value:** Provides consistent data management patterns while allowing domain-specific customization.

#### 3. Discussion Archetype
*"Conversational content attached to anything"*

**Common Properties:**
- Rich text content with formatting
- Author attribution and timestamps  
- Thread support (replies, mentions)
- Polymorphic attachment to any entity

**Domain Implementations:**
```typescript
class Comment extends BaseDiscussion {}   // General purpose comments
class Note extends BaseDiscussion {}      // Internal notes/memos
class Review extends BaseDiscussion {}    // Customer reviews/feedback
class Message extends BaseDiscussion {}   // Direct messaging
class Annotation extends BaseDiscussion {} // Document annotations
```

**Business Value:** Enables communication and collaboration around any business object.

#### 4. Relationship Archetype
*"Connections between entities"*

**Common Properties:**
- Polymorphic source and target entities
- Relationship type and strength/weight
- Directional or bidirectional semantics
- Metadata for relationship context

**Domain Implementations:**
```typescript
class EntityDependency extends BaseRelationship {} // Task dependencies
class PersonConnection extends BaseRelationship {} // Professional network
class ProductAssociation extends BaseRelationship {} // Product bundles
class DocumentReference extends BaseRelationship {} // Citations, links
class LocationHierarchy extends BaseRelationship {} // Geographic relationships
```

**Business Value:** Creates flexible, queryable connections between any business entities.

### Archetype Implementation Framework

#### Base Archetype Traits
```typescript
// Pure behavioral interfaces - no container assumptions
interface WorkItemTrait {
  title: string;
  status: string;
  priority: string;
  assignee?: User;
  dueDate?: Date;
  
  // Workflow methods
  transitionTo(state: string): Promise<void>;
  assign(user: User): Promise<void>;
  getTimeRemaining(): Duration;
}

interface RecordTrait {
  name: string; // Primary display field
  customFields?: Record<string, any>;
  
  // Data methods
  updateField(field: string, value: any): Promise<void>;
  validateData(): ValidationResult;
  getDisplayName(): string;
}

interface DiscussionTrait {
  content: string;
  author?: User;
  parentEntityType: string;
  parentEntityId: string;
  
  // Discussion methods
  reply(content: string): Promise<Discussion>;
  mention(users: User[]): Promise<void>;
  getThread(): Promise<Discussion[]>;
}

interface RelationshipTrait {
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relationshipType: string;
  weight?: number;
  
  // Relationship methods
  getSourceEntity(): Promise<BaseEntity>;
  getTargetEntity(): Promise<BaseEntity>;
  validateRelationship(): Promise<boolean>;
}
```

#### Archetype Configuration System
```typescript
interface ArchetypeConfig {
  name: string; // 'task', 'lead', 'contact'
  baseArchetype: 'work_item' | 'record' | 'discussion' | 'relationship';
  customFields: CustomField[];
  workflows?: WorkflowDefinition[];
  relationships: RelationshipConfig[];
  displayConfig: DisplayConfig;
  accessRules: AccessRule[];
}

// Example: Configure a CRM Lead
const leadConfig: ArchetypeConfig = {
  name: 'lead',
  baseArchetype: 'work_item',
  customFields: [
    { name: 'company', type: 'text', required: true },
    { name: 'estimatedRevenue', type: 'currency' },
    { name: 'source', type: 'select', options: ['website', 'referral', 'cold_call'] },
    { name: 'industry', type: 'select', options: ['tech', 'finance', 'healthcare'] }
  ],
  workflows: [{
    name: 'lead_qualification',
    states: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
    transitions: [
      { from: 'new', to: 'contacted', requiredFields: ['company'] },
      { from: 'contacted', to: 'qualified', requiredRole: 'sales_rep' }
    ]
  }],
  relationships: [
    { target: 'contact', type: 'many_to_one', name: 'primaryContact' },
    { target: 'account', type: 'many_to_one', name: 'company' }
  ],
  displayConfig: {
    primaryField: 'title',
    secondaryField: 'company',
    statusField: 'status',
    listView: ['title', 'company', 'estimatedRevenue', 'status'],
    detailView: ['all']
  }
};
```

### Archetype Business Domain Mapping

#### Project Management Domain
```typescript
// WorkItem archetypes
Epic extends BaseWorkItem        // Large initiatives
Story extends BaseWorkItem       // User stories  
Task extends BaseWorkItem        // Individual tasks
Bug extends BaseWorkItem         // Bug reports

// Container + Record archetypes
Project extends BaseRecord       // Can contain epics/stories
Sprint extends BaseRecord        // Can contain stories/tasks

// Discussion archetypes  
Comment extends BaseDiscussion   // General comments
Retrospective extends BaseDiscussion // Sprint retrospectives

// Relationship archetypes
Dependency extends BaseRelationship // Task dependencies
BlockedBy extends BaseRelationship  // Blocking relationships
```

#### CRM Domain
```typescript
// WorkItem archetypes
Lead extends BaseWorkItem          // Sales prospects
Opportunity extends BaseWorkItem   // Sales deals
Deal extends BaseWorkItem          // Closing deals

// Record archetypes
Contact extends BaseRecord         // People
Account extends BaseRecord         // Companies
Product extends BaseRecord         // What we sell

// Discussion archetypes
CallLog extends BaseDiscussion     // Sales calls
EmailThread extends BaseDiscussion // Email conversations

// Relationship archetypes
ContactRole extends BaseRelationship // Contact-Account roles
ProductInterest extends BaseRelationship // Lead-Product connections
```

#### E-commerce Domain
```typescript
// WorkItem archetypes
Order extends BaseWorkItem         // Order fulfillment
Return extends BaseWorkItem        // Return processing
Refund extends BaseWorkItem        // Refund processing

// Record archetypes
Product extends BaseRecord         // Catalog items
Customer extends BaseRecord        // Buyers
Inventory extends BaseRecord       // Stock tracking

// Discussion archetypes
Review extends BaseDiscussion      // Product reviews
SupportTicket extends BaseDiscussion // Customer support

// Relationship archetypes
ProductVariant extends BaseRelationship // Product variations
CrossSell extends BaseRelationship     // Product recommendations
```

### Archetype Benefits

#### 1. **Cross-Domain Consistency**
- Same patterns work across any business domain
- Users learn once, apply everywhere
- Consistent APIs and UI components

#### 2. **Rapid Domain Implementation**
- Configure new business domains in hours, not weeks
- Reuse proven patterns and behaviors
- Automatic UI generation for forms, lists, details

#### 3. **Universal Reporting & Analytics**
- WorkItems can be analyzed across all domains (sales, support, dev)
- Records provide consistent data management patterns
- Relationships enable cross-domain insights

#### 4. **Extensibility Without Complexity**
- Add custom fields while maintaining core behavior
- Compose archetypes (WorkItem + Container)
- Plugin additional behaviors as needed

## Phase 1: Enhanced Entity Framework (Weeks 1-4)

### 1.1 Container-Aware Entity Decorators

Extend DataForge with new decorators for access control:

```typescript
// New decorator types
@Container(type: 'workspace' | 'project' | 'user' | 'system')
@FieldAccess(roles: AccessRole[])
@AccessMetadata(options: AccessOptions)

// Enhanced base entities
export abstract class BaseContainerEntity extends BaseDomainEntity {
  @Property({ type: 'string' })
  @AccessMetadata({ autoPopulate: true })
  containerType!: string;

  @Property({ type: 'uuid' })
  @AccessMetadata({ autoPopulate: true })
  containerId!: string;

  @Property({ type: 'uuid' })
  @AccessMetadata({ autoPopulate: true })
  organizationId!: string;
}

// Example usage
@Entity()
@Container('project')
export class Task extends BaseContainerEntity {
  @Property()
  @FieldAccess(['MEMBER', 'OWNER', 'ADMIN'])
  title!: string;
  
  @Property()
  @FieldAccess(['OWNER', 'ADMIN'])
  internalNotes?: string;
  
  @ManyToOne(() => Project, { fieldName: 'project_id' })
  project!: Project;
}
```

### 1.2 Access Control Code Generation

Generate access control logic automatically:

```typescript
// Generated access control service
export class TaskAccessControl {
  static async checkAccess(
    userId: string,
    taskId: string,
    operation: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    // Auto-generated from @Container('project') decorator
    const task = await TaskRepository.findById(taskId);
    return ProjectAccessControl.checkAccess(userId, task.projectId, operation);
  }

  static filterFields(task: Task, userRole: AccessRole): Partial<Task> {
    // Auto-generated from @FieldAccess decorators
    const result: Partial<Task> = { ...task };
    
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      delete result.internalNotes;
    }
    
    return result;
  }
}
```

### 1.3 Database Schema Updates

Add access control infrastructure:

```sql
-- Container access permissions
CREATE TABLE container_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  container_type VARCHAR(50) NOT NULL,
  container_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'ADMIN', 'OWNER', 'MEMBER', 'VIEWER'
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(user_id, container_type, container_id)
);

-- Add organization context to all domain entities
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE tasks ADD COLUMN organization_id UUID REFERENCES organizations(id);
-- ... repeat for all domain entities

-- Performance indexes
CREATE INDEX idx_container_permissions_user ON container_permissions(user_id, container_type);
CREATE INDEX idx_entity_org ON tasks(organization_id);
CREATE INDEX idx_entity_container ON tasks(project_id);
```

## Phase 2: Dynamic Schema Architecture (Weeks 5-8)

### 2.1 Curated Field Type Strategy

Instead of fully dynamic JSON fields, provide users with a curated set of safe field types that map to predictable database migrations:

```typescript
const SUPPORTED_FIELD_TYPES = [
  { name: 'text', dbType: 'VARCHAR(255)' },
  { name: 'long_text', dbType: 'TEXT' },
  { name: 'number', dbType: 'DECIMAL(12,2)' },
  { name: 'integer', dbType: 'INTEGER' },
  { name: 'date', dbType: 'DATE' },
  { name: 'datetime', dbType: 'TIMESTAMPTZ' },
  { name: 'boolean', dbType: 'BOOLEAN' },
  { name: 'select', dbType: 'VARCHAR(100)' },
  { name: 'multiselect', dbType: 'TEXT[]' },
  { name: 'email', dbType: 'VARCHAR(255)' },
  { name: 'url', dbType: 'VARCHAR(500)' },
  { name: 'currency', dbType: 'DECIMAL(12,2)' }
];
```

**Benefits**:
- Real database columns from day one (performance)
- Type-safe generated entities (developer experience)
- Predictable migrations (reliability)
- No complex JSON query optimization needed

**User Experience**:
```typescript
// User configures custom fields from curated types
const taskConfig = {
  archetype: 'task',
  customFields: [
    { name: 'department', type: 'select', options: ['Engineering', 'Sales'] },
    { name: 'estimated_hours', type: 'number' },
    { name: 'client_email', type: 'email' }
  ]
};

// Generates real columns and typed entity automatically
await fieldService.addCustomFields('task', taskConfig.customFields);
```

### 2.2 Schema Manager System

Build runtime schema management on top of existing DataForge:

```typescript
interface RuntimeSchema {
  entityName: string;
  organizationId: string;
  customFields: CustomField[];
  version: number;
  createdAt: Date;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'relationship';
  config: FieldConfig;
  accessLevel: AccessRole[];
}

export class SchemaManager {
  // Merge build-time + runtime schemas
  async getEntitySchema(entityName: string, orgId: string): Promise<EntitySchema> {
    const baseSchema = this.getStaticSchema(entityName);
    const customFields = await this.getCustomFields(entityName, orgId);
    
    return {
      ...baseSchema,
      fields: [...baseSchema.fields, ...customFields]
    };
  }

  // Add custom field without rebuild
  async addCustomField(
    entityName: string,
    orgId: string,
    field: CustomField
  ): Promise<void> {
    // 1. Validate field definition
    await this.validateCustomField(entityName, field);
    
    // 2. Update runtime schema
    await this.updateRuntimeSchema(entityName, orgId, field);
    
    // 3. Apply database migration
    await this.applyFieldMigration(entityName, orgId, field);
    
    // 4. Broadcast schema change to all clients
    await this.broadcastSchemaUpdate(orgId, entityName);
  }
}
```

### 2.2 JSON Schema Export Enhancement

Extend DataForge build to export JSON schemas:

```typescript
// Enhanced forge build process
export async function buildSchemas(): Promise<void> {
  // Existing build steps (unchanged)
  await generateTypeScriptTypes();
  await generateCRUDOperations();
  await generateDexieSchema();
  await generateDrizzleSchema();
  
  // New: Export JSON schema
  await generateJSONSchema();
  await generateAccessControlPolicies();
}

// Generated schema.json
{
  "entities": {
    "Task": {
      "baseFields": [
        {
          "name": "title",
          "type": "string",
          "accessLevel": ["MEMBER", "OWNER", "ADMIN"],
          "required": true
        }
      ],
      "container": "project",
      "relationships": [
        {
          "name": "project",
          "type": "many_to_one",
          "target": "Project"
        }
      ]
    }
  }
}
```

### 2.3 Migration Engine

Automated schema migrations for custom fields:

```typescript
export class MigrationEngine {
  async applyCustomFieldMigration(
    entityName: string,
    orgId: string,
    field: CustomField
  ): Promise<void> {
    const migration: SchemaMigration = {
      id: generateId(),
      type: 'add_custom_field',
      entityName,
      organizationId: orgId,
      operations: [
        {
          type: 'add_column',
          table: this.getTableName(entityName, orgId),
          column: {
            name: `custom_${field.id}`,
            type: this.mapFieldType(field.type),
            nullable: !field.required
          }
        }
      ]
    };

    // Apply to organization's database
    await this.executeMigration(orgId, migration);
    
    // Record migration history
    await this.recordMigration(migration);
  }
}
```

## Phase 3: Multi-Tenant Database Architecture (Weeks 9-16)

### 3.1 Control Plane vs Data Plane

**Control Plane (Shared Database)**:
```sql
-- Shared infrastructure database
CREATE SCHEMA control_plane;

CREATE TABLE control_plane.organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  database_url TEXT NOT NULL,
  schema_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE control_plane.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  organization_id UUID REFERENCES control_plane.organizations(id),
  global_role VARCHAR(50) DEFAULT 'member'
);

CREATE TABLE control_plane.database_instances (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES control_plane.organizations(id),
  neon_database_id VARCHAR(255),
  connection_string TEXT,
  status VARCHAR(50) DEFAULT 'active'
);
```

**Data Plane (Per-Organization Databases)**:
```sql
-- Each org gets: {org_id}_workspace database
-- Contains the full domain schema + custom fields
-- Example: org_123_workspace

-- Standard domain tables (replicated across all orgs)
CREATE TABLE projects (...);
CREATE TABLE tasks (...);
-- ... all domain entities

-- Org-specific custom field tables
CREATE TABLE custom_field_definitions (...);
CREATE TABLE custom_field_values (...);
```

### 3.2 Database Provisioning Service

Automated database creation for new organizations:

```typescript
export class DatabaseProvisioningService {
  async createOrganizationDatabase(orgId: string): Promise<DatabaseInstance> {
    // 1. Create Neon database branch
    const neonBranch = await this.neonClient.createBranch({
      name: `${orgId}_workspace`,
      parent: 'main'
    });

    // 2. Apply base schema
    await this.applyBaseSchema(neonBranch.connectionString);

    // 3. Set up RLS policies
    await this.setupAccessPolicies(neonBranch.connectionString, orgId);

    // 4. Register in control plane
    const instance = await this.registerDatabaseInstance({
      organizationId: orgId,
      neonDatabaseId: neonBranch.id,
      connectionString: neonBranch.connectionString
    });

    return instance;
  }

  async applyBaseSchema(connectionString: string): Promise<void> {
    // Use generated schema from DataForge
    const schema = await import('../generated/base-schema.sql');
    await this.executeSQL(connectionString, schema);
  }
}
```

### 3.3 Connection Routing

Route database connections based on organization:

```typescript
export class DatabaseRouter {
  private connections = new Map<string, DatabaseConnection>();

  async getOrgConnection(orgId: string): Promise<DatabaseConnection> {
    if (this.connections.has(orgId)) {
      return this.connections.get(orgId)!;
    }

    const instance = await this.getOrgDatabaseInstance(orgId);
    const connection = await this.createConnection(instance.connectionString);
    
    this.connections.set(orgId, connection);
    return connection;
  }

  // Middleware for automatic routing
  withOrgContext = (handler: Function) => {
    return async (request: Request) => {
      const orgId = await this.extractOrgId(request);
      const db = await this.getOrgConnection(orgId);
      
      return handler(request, { db, orgId });
    };
  };
}
```

## Phase 4: Sync Protocol Enhancement (Weeks 17-20)

### 4.1 Schema-Aware Sync

Extend sync protocol to handle dynamic schemas:

```typescript
interface SyncMessage {
  type: 'data_change' | 'schema_change';
  organizationId: string;
  payload: DataPayload | SchemaPayload;
}

interface SchemaPayload {
  entityName: string;
  schemaVersion: number;
  changes: SchemaChange[];
}

export class SchemaSyncManager {
  async handleSchemaChange(orgId: string, change: SchemaPayload): Promise<void> {
    // 1. Update local runtime schema
    await this.updateLocalSchema(orgId, change);
    
    // 2. Migrate local IndexedDB structure
    await this.migrateLocalDatabase(change);
    
    // 3. Broadcast to other clients
    await this.broadcastSchemaUpdate(orgId, change);
    
    // 4. Trigger UI refresh for form builders
    this.events.emit('schema:updated', { orgId, entityName: change.entityName });
  }
}
```

### 4.2 Access-Aware Sync Filtering

Integrate access control with sync:

```typescript
export class AccessAwareSyncManager {
  async filterChangesForUser(
    changes: DataChange[],
    userId: string,
    orgId: string
  ): Promise<DataChange[]> {
    const userPermissions = await this.getUserPermissions(userId, orgId);
    const filteredChanges: DataChange[] = [];

    for (const change of changes) {
      // Check container access
      const hasAccess = await this.checkContainerAccess(
        userPermissions,
        change.entityType,
        change.containerId
      );

      if (!hasAccess) continue;

      // Filter fields based on access level
      const userRole = await this.getUserRoleInContainer(
        userId,
        change.entityType,
        change.containerId
      );
      
      const filteredData = this.filterFieldsByRole(
        change.data,
        change.entityType,
        userRole
      );

      filteredChanges.push({
        ...change,
        data: filteredData
      });
    }

    return filteredChanges;
  }
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Extend entity decorators for containers and access control
- [ ] Generate access control policies from entity definitions
- [ ] Add container_permissions table and migration

### Week 3-4: Access Control Integration
- [ ] Implement universal access control service
- [ ] Integrate with sync filtering
- [ ] Add field-level access control

### Week 5-6: Schema Management
- [ ] Build SchemaManager for runtime schema
- [ ] Implement custom field addition API
- [ ] Create migration engine for schema changes

### Week 7-8: JSON Schema Export
- [ ] Extend DataForge to export JSON schemas
- [ ] Build schema merging logic (static + runtime)
- [ ] Implement schema versioning system

### Week 9-12: Multi-Tenant Infrastructure
- [ ] Create database provisioning service
- [ ] Implement organization database routing
- [ ] Set up control plane vs data plane architecture

### Week 13-16: Database Migration
- [ ] Build org-to-database migration tools
- [ ] Implement gradual migration strategy
- [ ] Create backup and rollback procedures

### Week 17-20: Enhanced Sync
- [ ] Extend sync protocol for schema changes
- [ ] Implement access-aware sync filtering
- [ ] Add real-time schema broadcasting

## Success Metrics

### Performance
- [ ] Custom field addition: <2 seconds end-to-end
- [ ] Database provisioning: <30 seconds for new orgs
- [ ] Access control overhead: <10ms per operation
- [ ] Schema sync: <5 seconds across all clients

### Functionality
- [ ] Dynamic custom fields without rebuild
- [ ] Container-based access inheritance working
- [ ] Multi-tenant isolation with zero data leakage
- [ ] Offline-first functionality maintained

### Developer Experience
- [ ] Type-safe custom field access
- [ ] Automatic access control policy generation
- [ ] Zero-downtime schema migrations
- [ ] Consistent API across static and dynamic fields

## Risk Mitigation

### Database Performance
- **Risk**: Per-org databases may impact performance
- **Mitigation**: Connection pooling, query optimization, Neon scaling

### Schema Complexity
- **Risk**: Runtime schema management becomes unwieldy
- **Mitigation**: Strict validation, versioning, rollback mechanisms

### Access Control Bugs
- **Risk**: Access control bypasses leading to data leaks
- **Mitigation**: Comprehensive testing, audit logging, security reviews

### Migration Failures
- **Risk**: Schema migrations corrupt customer data
- **Mitigation**: Atomic migrations, backup before changes, rollback procedures

## Future Considerations

### Advanced Features (Post-MVP)
- **Computed Fields**: Formula-based custom fields
- **Cross-Entity Relationships**: Custom relationships between entities
- **Advanced Access Control**: Time-based permissions, conditional access
- **Schema Marketplace**: Shared schema templates between orgs

### Enterprise Features
- **Audit Logging**: Complete access control audit trail
- **Compliance**: GDPR, SOC2 compliance for multi-tenant architecture
- **Performance Monitoring**: Per-org database metrics and alerting
- **Advanced Migration**: Blue-green deployments for schema changes

This architecture provides a clear path from the current single-tenant system to a fully multi-tenant SaaS platform while maintaining local-first performance and adding dynamic schema capabilities.