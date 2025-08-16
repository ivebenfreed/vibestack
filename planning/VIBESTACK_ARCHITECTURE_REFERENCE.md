# VibeStack Architecture Reference Documentation
*Comprehensive High-Level Analysis of the Multi-Tenant SaaS DataForge System*

## Executive Summary

VibeStack is a **Multi-Tenant SaaS Platform** built around a sophisticated **Universal Archetype System** and **DataForge Architecture**. The platform enables organizations to create custom business entities that automatically generate real database tables, client schemas, and server schemas with seamless background migrations, all while maintaining perfect tenant isolation and real-time synchronization.

## 🏗️ Core Architecture Overview

### System Philosophy
- **Universal Archetypes**: Eight fundamental patterns that model all business entities
- **Multi-Tenant Isolation**: Complete data separation between organizations at the database level
- **Real-Time Synchronization**: Live data sync with organization-aware filtering
- **Dynamic Schema Evolution**: Organizations can extend base archetypes with custom fields
- **Type-Safe Code Generation**: Automatic TypeScript schema generation from entity definitions

### Technology Stack
- **Frontend**: Vite + React + TypeScript + TanStack Query + Dexie (IndexedDB)
- **Backend**: Cloudflare Workers + Hono + Better Auth + Kysely + Neon PostgreSQL
- **Real-Time**: WebSockets + Durable Objects + Organization-aware broadcasting
- **Database**: PostgreSQL with Row Level Security (RLS) + WAL polling replication
- **ORM/Query**: Kysely (type-safe SQL builder) replacing Drizzle and MikroORM

## 🎯 Universal Archetype System

### Eight Universal Patterns

The system is built around eight fundamental archetypes that can model any business entity:

1. **Project** - Timeline-based entities with budget, progress tracking
   - Examples: Software projects, marketing campaigns, research initiatives
   - Core fields: `name`, `priority`, `budget`, `startDate`, `endDate`, `status`

2. **Task** - Work items with dependencies and assignments  
   - Examples: User stories, bugs, maintenance tasks
   - Core fields: `title`, `priority`, `status`, `assignedTo`, `estimatedHours`

3. **Record** - Structured data records
   - Examples: Meeting notes, technical specifications, process documentation
   - Core fields: `title`, `content`, `category`, `tags`, `metadata`

4. **Document** - Content-based entities with versioning
   - Examples: Contracts, proposals, user manuals
   - Core fields: `title`, `content`, `version`, `status`, `approvedBy`

5. **File** - Binary assets with metadata
   - Examples: Source code, media files, documentation assets
   - Core fields: `filename`, `mimeType`, `size`, `uploadedBy`, `tags`

6. **Activity** - Audit/activity log entries
   - Examples: Deployments, reviews, testing activities
   - Core fields: `activityType`, `description`, `performedBy`, `timestamp`

7. **Discussion** - Threaded conversations
   - Examples: Forums, announcements, support threads
   - Core fields: `title`, `content`, `discussionType`, `isResolved`, `participants`

8. **Collection** - Grouped entity containers
   - Examples: Dashboards, portfolios, knowledge bases
   - Core fields: `name`, `description`, `visibility`, `collectionType`

### Foundation Entity Hierarchy

```typescript
BaseSystemEntity (UUIDv7, audit trails, timestamps)
    ↓
BaseDomainEntity (container access control, archetype classification)
    ↓
[Archetype Patterns] (Project, Task, Record, Document, File, Activity, Discussion, Collection)
    ↓
[Organization-Specific Implementations] (SoftwareProject, UserStory, etc.)
```

**Key Features**:
- **UUIDv7 Primary Keys**: Timestamp-ordered UUIDs for optimal database performance
- **Container Access Control**: Entities belong to containers (project, department, workspace, user, system)
- **Archetype Classification**: Each entity follows one of 8 universal patterns  
- **Multi-tenant Isolation**: Single database with `organization_id` columns and RLS policies for perfect tenant separation
- **Organization-Aware Operations**: All business logic, sync, and data access respects organization boundaries

## 🏢 Multi-Tenant Architecture

### Organization-Level Isolation

The system uses **single database with RLS (Row Level Security)** for multi-tenant isolation:

#### 1. Core Organization Tables

**Base Organization System:**
- `organizations` - Main organization entities with subscription, billing, and configuration
- `organization_members` - User-organization relationships with RBAC (owner/admin/manager/member/viewer)
- `organization_invitations` - Token-based invitation system with expiration
- `organization_audit_logs` - Complete audit trail for compliance

**Role Hierarchy:** Numeric levels for permission checking:
```typescript
const ROLE_LEVELS = {
  owner: 100,   // Full control including organization deletion
  admin: 80,    // Management operations, settings, billing
  manager: 60,  // Project operations, limited member management 
  member: 40,   // Participation in projects and activities
  viewer: 20    // Read-only access to organization content
};
```

#### 2. Multi-Tenant Database Architecture

**Organization-Scoped Business Data:**
- Business entity tables use `organization_id UUID` columns referencing `organizations(id)`
- WAL-based change tracking with organization context in `change_history` table
- Organization-aware sync filtering ensures data isolation

**Row Level Security (RLS) Implementation:**
```sql
-- Example RLS policy for change_history table
CREATE POLICY "change_history_org_isolation" ON change_history
    FOR ALL TO PUBLIC
    USING (
        current_setting('app.system_mode', true) = 'true' OR
        organization_id = current_setting('app.current_organization_id', true)::UUID
    );

-- Organization context management functions
CREATE FUNCTION set_current_organization_id(org_id UUID) RETURNS VOID;
CREATE FUNCTION enable_system_mode() RETURNS VOID;
CREATE FUNCTION get_current_organization_id() RETURNS UUID;
```

#### 3. Authentication & Authorization Flow

**Two-Layer Security Model:**
```typescript
// Layer 1: Better Auth user authentication
const { user, session } = c.var; // From Better Auth middleware
if (!user || !session) return c.json({error: 'Authentication required'}, 401);

// Layer 2: Organization membership and role validation
const memberService = new OrganizationMemberService(db);
const permission = await memberService.hasPermission(orgId, user.id, 'member');
if (!permission.allowed) {
  return c.json({
    error: 'Insufficient permissions',
    required: 'member',
    current: permission.currentRole
  }, 403);
}

// Set organization context for RLS
await db.execute(sql`SELECT set_current_organization_id(${orgId})`);
```

#### 4. Organization Context in Business Operations

**All business operations are organization-scoped:**
```typescript
// Example: Organization-aware entity operations
const orgService = new OrganizationService(c);
const manager = new ArchetypeEntityManager(c.env, orgId);

// Create entity with automatic organization isolation
const entity = await manager.createArchetypeEntity(
  orgId, 
  'project', 
  tableName, 
  data
);

// Sync operations respect organization boundaries
const syncEngine = new GenericSyncEngine(databaseUrl, syncMetadata, junctionTables);
const changes = await syncEngine.getChangesForClient(lastSync, orgSpecificTables);
```

#### 5. Real-World Organization Data

**From actual testing (TechFlow Solutions organization `934fd0a8-f306-4f13-a544-094282f047eb`):**
- **Owner:** TechFlow Admin (admin@techflow.solutions)
- **Admin:** Sarah Chen (sarah.chen.techflow.001@gmail.com) 
- **Manager:** Michael Rodriguez (michael.rodriguez.techflow.001@gmail.com)
- **Member:** Emily Watson (emily.watson.techflow.001@gmail.com)
- **Subscription:** 14-day trial with 5 users, 3 projects, 1GB storage limits
- **Created:** 2025-08-15, expires 2025-08-29

### Recent Multi-Tenant SaaS MVP Refactor

The recent refactor (commits df962f45, 28643d62, c790bcbe) introduced:

#### Enhanced Base Entity System
- **UUIDv7 Implementation**: PostgreSQL function `generate_uuidv7()` for timestamp-ordered IDs
- **Audit Trail Enhancement**: `createdBy` field in BaseSystemEntity
- **Container Access Control**: Fields in BaseDomainEntity for fine-grained permissions
- **Computed Properties**: Container type checking and validation

#### Universal Systems (Labels, Options & Relationships)
- **Label System**: Hierarchical categorization with color/icon metadata
- **Option System**: Flexible configuration with validation and conditional logic
- **System Option Sets**: Pre-defined options (status, priority, category, discussion types)
- **Custom Field Support**: Text, number, date, boolean fields with validation
- **Entity Relationship System**: Polymorphic relationships between any archetype entities

#### Hybrid Table Architecture
```typescript
// Base polymorphic tables
Option & OptionSet entities

// Type-specific metadata tables for strong typing
StatusOptionMetadata     // Workflow states, transitions, completion criteria
PriorityOptionMetadata   // Urgency levels, escalation rules, SLA management  
CategoryOptionMetadata   // Auto-assignment rules, workflow templates
CustomFieldMetadata      // User-defined fields with validation
```

## ⚙️ DataForge Code Generation System

### Entity Definition Process

1. **Archetype Selection**:
   ```typescript
   // Validate archetype exists
   if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
     throw new Error(`Invalid archetype: ${archetype}`);
   }
   
   // Get pattern class
   const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
   ```

2. **DDL Generation**:
   ```typescript
   // Generate base DDL from archetype
   const baseDDL = ArchetypeClass.getProjectDDL(); // or getTaskDDL(), etc.
   
   // Add custom field columns
   const customColumns = this.generateCustomFieldColumns(customFields);
   
   // Combine base + custom fields
   let finalDDL = baseDDL.replace(/\{tableName\}/g, `${orgId}_${tableName}`);
   ```

3. **Schema Storage**:
   ```typescript
   // Store in OrgSchemaDO
   const entityDefinition: OrgEntityDefinition = {
     tableName,
     extends: archetype, // Links back to archetype pattern
     customFields,
     syncable: true,
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString()
   };
   ```

### Debounced Migration System

**Key Innovation**: Batches schema changes over 30 seconds to prevent rapid migrations:

```typescript
export class ArchetypeMigrationService {
  private readonly DEBOUNCE_DELAY = 30000; // 30 seconds
  
  async scheduleArchetypeSchemaChange(
    organizationId: string,
    entityName: string,
    archetype: string,
    operation: 'create' | 'update' | 'delete',
    newFields?: Record<string, FieldDefinition>,
    oldFields?: Record<string, FieldDefinition>
  ): Promise<string>
}
```

**Migration Flow**:
1. Schedule schema change with archetype pattern
2. Cancel any existing timer for the same entity
3. Batch changes over 30-second window
4. Execute DDL generation using archetype + custom fields
5. Apply to organization's database

## 🏢 Custom Multi-Tenant Organization System

### Architecture Overview

VibeStack implements a **custom enterprise-grade organization system** that replaces Better Auth's organization plugin. This system provides sophisticated B2B SaaS functionality with:

- **5-tier role hierarchy** (owner → admin → manager → member → viewer)
- **Enterprise security features** (SSO, 2FA enforcement, domain allowlists)
- **Subscription management** with usage limits and billing integration
- **Token-based invitation system** with expiration and tracking
- **Comprehensive audit logging** for compliance and security

### Database Schema

#### Core Organization Tables

**`organizations`** - Main organization entities with enterprise features
```sql
-- Identity & Branding
id, name, slug (unique), description, logo_url

-- Business Information  
industry, company_size, website_url, country, timezone

-- Subscription & Billing
subscription_tier ('free' | 'starter' | 'pro' | 'enterprise')
subscription_status, billing_email, trial_ends_at

-- Usage Limits & Quotas
max_users, max_projects, storage_limit_gb, api_rate_limit

-- Security Features
sso_enabled, enforce_2fa, allowed_domains[]

-- Flexible Configuration
settings JSONB -- Custom org-specific settings

-- Lifecycle Management
created_at, updated_at, deleted_at (soft delete)
```

**`organization_members`** - User-organization relationships with RBAC
```sql
-- Core Relationship
organization_id, user_id, role, status

-- Role Hierarchy: 'owner' (100) > 'admin' (80) > 'manager' (60) > 'member' (40) > 'viewer' (20)
role VARCHAR CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'))
status ('active' | 'inactive' | 'pending' | 'suspended')

-- Professional Details
title, department, notes

-- Invitation Tracking
invited_by, invited_at, joined_at
```

**`organization_invitations`** - Secure token-based invitations
```sql
-- Invitation Details
organization_id, email, role, invited_by, personal_message

-- Security & Expiration
token VARCHAR UNIQUE, expires_at TIMESTAMPTZ

-- Status Tracking
status ('pending' | 'accepted' | 'expired' | 'cancelled')
accepted_at, accepted_by
```

**`organization_audit_logs`** - Comprehensive activity tracking
```sql
-- Event Details
organization_id, action, actor_id, target_type, target_id

-- Context & Metadata
details JSONB, ip_address, user_agent, created_at

-- Actions: 'organization_created', 'member_added', 'role_changed', 'settings_updated', etc.
```

### Role-Based Access Control (RBAC)

#### Permission Hierarchy
```typescript
const ROLE_LEVELS: Record<OrganizationRole, number> = {
  owner: 100,   // Full control: delete org, transfer ownership
  admin: 80,    // Management: settings, members, billing, stats  
  manager: 60,  // Operations: projects, limited member operations
  member: 40,   // Participation: access projects, basic operations
  viewer: 20    // Read-only: view org details, members, projects
};
```

#### Permission Matrix
| Operation | Owner | Admin | Manager | Member | Viewer |
|-----------|-------|-------|---------|--------|--------|
| Delete Organization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Invitations | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Statistics | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Members | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Organization | ✅ | ✅ | ✅ | ✅ | ✅ |

### Service Architecture

#### OrganizationService - Core CRUD Operations
- `createOrganization()` - Creates org + adds creator as owner
- `updateOrganization()` - Updates with validation + audit logging
- `getOrganizationsByUser()` - Lists user's organizations with roles
- `deleteOrganization()` - Soft delete with data retention
- `getOrganizationStats()` - Usage analytics and metrics

#### OrganizationMemberService - Member Management
- `addMember()` - Adds user with role + quota validation
- `updateMember()` - Role changes with permission checks
- `hasPermission()` - Role-based access control validation
- `listMembers()` - Filtered member lists with search/pagination

#### OrganizationInvitationService - Invitation Lifecycle  
- `createInvitation()` - Generates secure tokens with expiration
- `acceptInvitation()` - Validates token + creates membership
- `cancelInvitation()` - Revokes pending invitations
- `resendInvitation()` - Regenerates expired invitations

### API Endpoints

#### Organization Management
```typescript
POST   /api/organizations              // Create new organization
GET    /api/organizations              // List user's organizations
GET    /api/organizations/:orgId       // Get organization details (viewer+)
PUT    /api/organizations/:orgId       // Update organization (admin+)
DELETE /api/organizations/:orgId       // Delete organization (owner only)
GET    /api/organizations/:orgId/stats // Organization statistics (admin+)
```

#### Member Management
```typescript
GET    /api/organizations/:orgId/members           // List members (viewer+)
POST   /api/organizations/:orgId/members           // Add member (admin+)  
PUT    /api/organizations/:orgId/members/:userId   // Update member (admin+)
DELETE /api/organizations/:orgId/members/:userId   // Remove member (admin+)
```

#### Invitation System
```typescript
POST   /api/organizations/:orgId/invitations         // Create invitation (admin+)
GET    /api/organizations/:orgId/invitations         // List invitations (admin+)
DELETE /api/organizations/:orgId/invitations/:id     // Cancel invitation (admin+)
POST   /api/organizations/:orgId/invitations/:id/resend // Resend invitation (admin+)
POST   /api/invitations/accept                       // Accept invitation (public)
```

### Authentication Integration

#### Middleware Chain
```typescript
// 1. Better Auth Authentication
const requireAuth = async (c, next) => {
  const user = c.var.user;        // Better Auth user object
  const session = c.var.session;  // Better Auth session
  if (!user || !session) return c.json({error: 'Authentication required'}, 401);
  await next();
};

// 2. Organization Permission Validation
const requireOrgPermission = (requiredRole: OrganizationRole) => {
  return async (c, next) => {
    const user = c.var.user;
    const orgId = c.req.param('orgId') || c.req.query('orgId');
    
    const memberService = new OrganizationMemberService(db);
    const permission = await memberService.hasPermission(orgId, user.id, requiredRole);
    
    if (!permission.allowed) {
      return c.json({
        error: 'Insufficient permissions',
        required: requiredRole,
        current: permission.currentRole
      }, 403);
    }
    
    // Set organization context for request
    c.set('organizationId', orgId);
    c.set('userRole', permission.currentRole);
    await next();
  };
};
```

### Integration with Archetype System

The custom organization system provides the foundation for multi-tenant archetype isolation:

```typescript
// Organization-scoped entity creation
const orgService = new OrganizationService(c);
const memberService = new OrganizationMemberService(db);

// Validate organization membership before entity operations
const hasAccess = await memberService.hasPermission(orgId, userId, 'member');
if (!hasAccess.allowed) {
  throw new UnauthorizedError('Insufficient organization permissions');
}

// Create archetype entity with organization isolation
const manager = new ArchetypeEntityManager(c.env, orgId);
const entity = await manager.createArchetypeEntity(orgId, 'project', tableName, data);
```

### Enterprise Features

#### Subscription Management
- **Tier-based Limits**: Free (5 users, 3 projects) → Enterprise (unlimited)
- **Usage Tracking**: Real-time monitoring of user count, storage, API calls
- **Trial Management**: Automatic trial expiration with grace periods
- **Billing Integration**: Separate billing contacts and payment management

#### Security & Compliance
- **Single Sign-On (SSO)**: Enterprise SAML/OAuth integration
- **Two-Factor Authentication**: Organization-wide 2FA enforcement
- **Domain Allowlists**: Auto-join for verified email domains
- **Audit Logging**: Complete activity trail for compliance requirements

#### Professional Features
- **Soft Delete**: Organizations retained for data recovery and compliance
- **Custom Settings**: Flexible JSONB configuration per organization  
- **Department Tracking**: Professional organizational structure
- **Member Metadata**: Job titles, departments, admin notes

### Key Advantages Over Better Auth Plugin

| Feature | Better Auth Plugin | VibeStack Custom System |
|---------|-------------------|-------------------------|
| **Role System** | Basic roles | 5-tier hierarchy with numeric levels |
| **Business Features** | Minimal | Subscriptions, limits, billing, trials |
| **Security** | Basic auth | SSO, 2FA, domain controls, audit logs |
| **Enterprise** | Limited | Soft delete, custom settings, analytics |
| **Invitation System** | Simple | Token-based with tracking and expiration |
| **Database Design** | 2-3 tables | 4 comprehensive tables with indexes |
| **API Coverage** | Basic CRUD | Full lifecycle management with RBAC |
| **Multi-tenant Ready** | Basic | Production-ready with perfect isolation |

## 🔗 Custom Entity Relationship System

### Architecture Overview

VibeStack implements a **sophisticated polymorphic relationship system** that connects any entities across the universal archetype patterns. This system provides:

- **14 relationship types** covering dependencies, hierarchies, references, and workflows
- **Bidirectional relationship support** with automatic inverse relationships
- **Circular dependency detection** to prevent workflow deadlocks
- **Metadata storage** for relationship strength, notes, and priority
- **Soft delete relationships** with activation/deactivation support

### Core Relationship Database Schema

**`entity_relationship`** - Polymorphic relationship table
```sql
-- Core Relationship Definition
source_entity_type VARCHAR(50)    -- 'project', 'task', 'record', etc.
source_entity_id UUID             -- UUID of source entity
target_entity_type VARCHAR(50)    -- 'project', 'task', 'record', etc.
target_entity_id UUID             -- UUID of target entity
relationship_type VARCHAR(50)     -- 'depends_on', 'blocks', 'relates_to', etc.

-- Relationship Metadata
metadata JSONB DEFAULT '{}'       -- Flexible relationship data
sort_order INTEGER DEFAULT 0      -- For ordered relationships
is_active BOOLEAN DEFAULT TRUE    -- Soft delete relationships
is_bidirectional BOOLEAN           -- Automatic inverse relationships
created_by_user_id UUID           -- User who created relationship

-- Constraints & Indexes
UNIQUE (source_entity_type, source_entity_id, target_entity_type, target_entity_id, relationship_type)
CHECK (source_entity_type != target_entity_type OR source_entity_id != target_entity_id) -- No self-relationships
```

### Supported Relationship Types

#### 1. **Dependency Relationships**
```typescript
'depends_on'    // A depends on B (A cannot start/complete until B is done)
'blocks'        // A blocks B (B cannot proceed while A is incomplete) 
'blocked_by'    // A is blocked by B (inverse of blocks)
```

#### 2. **Hierarchy Relationships**  
```typescript
'parent_of'     // A is parent of B (hierarchical structure)
'child_of'      // A is child of B (inverse of parent_of)
'contains'      // A contains B (composition relationship)
'contained_by'  // A is contained by B (inverse of contains)
```

#### 3. **Reference Relationships**
```typescript
'relates_to'    // A relates to B (generic association)
'references'    // A references B (documentation/citation)
'referenced_by' // A is referenced by B (inverse of references)
```

#### 4. **Workflow Relationships**
```typescript
'duplicates'    // A duplicates B (duplicate issue/entity)
'duplicated_by' // A is duplicated by B (inverse of duplicates)
'follows'       // A follows B (sequential workflow)
'preceded_by'   // A is preceded by B (inverse of follows)
```

### Cross-Archetype Relationship Examples

#### Project Management Workflows
```typescript
// Project → Task dependencies
{
  source_entity_type: 'project',
  source_entity_id: 'proj_001',
  target_entity_type: 'task',
  target_entity_id: 'task_001',
  relationship_type: 'contains',
  metadata: { role: 'epic_story', priority: 'high' }
}

// Task → Task dependencies  
{
  source_entity_type: 'task',
  source_entity_id: 'task_001',
  target_entity_type: 'task', 
  target_entity_id: 'task_002',
  relationship_type: 'depends_on',
  metadata: { blocking_reason: 'API must be implemented first', strength: 9 }
}
```

#### Documentation Relationships
```typescript
// Document → File references
{
  source_entity_type: 'document',
  source_entity_id: 'doc_001',
  target_entity_type: 'file',
  target_entity_id: 'file_001', 
  relationship_type: 'references',
  metadata: { section: 'Architecture Diagram', page: 12 }
}

// Record → Project associations
{
  source_entity_type: 'record',
  source_entity_id: 'meeting_001',
  target_entity_type: 'project',
  target_entity_id: 'proj_001',
  relationship_type: 'relates_to',
  metadata: { context: 'project kickoff meeting', decision_impact: 'high' }
}
```

#### Collection Hierarchies
```typescript
// Collection → Multiple entity types
{
  source_entity_type: 'collection',
  source_entity_id: 'dashboard_001',
  target_entity_type: 'project',
  target_entity_id: 'proj_001',
  relationship_type: 'contains',
  sort_order: 1,
  metadata: { widget_type: 'project_status', display_order: 'priority' }
}
```

### Advanced Relationship Features

#### Bidirectional Relationships
```typescript
// Create bidirectional relationship
const relationship = new EntityRelationship({
  source_entity_type: 'project',
  source_entity_id: 'proj_001',
  target_entity_type: 'project', 
  target_entity_id: 'proj_002',
  relationship_type: 'relates_to',
  is_bidirectional: true // Automatically creates inverse relationship
});

// System creates both:
// proj_001 → proj_002 (relates_to)
// proj_002 → proj_001 (relates_to)
```

#### Circular Dependency Detection
```typescript
// Prevent workflow deadlocks
const hasCircular = EntityRelationshipUtilities.hasCircularDependency(
  relationships,
  'task',
  'task_001'
);

if (hasCircular) {
  throw new Error('Cannot create dependency - would create circular dependency');
}
```

#### Relationship Path Analysis
```typescript
// Find dependency chain between entities  
const dependencyPath = EntityRelationshipUtilities.getDependencyPath(
  relationships,
  'task', 'task_001',    // From: Task 1
  'task', 'task_010'     // To: Task 10  
);

// Returns: [task_001 → task_003 → task_007 → task_010]
```

#### Relationship Metrics
```typescript
// Calculate relationship metrics for any entity
const metrics = EntityRelationshipUtilities.calculateMetrics(
  relationships,
  'project',
  'proj_001'
);

// Returns:
// {
//   total: 15,
//   outgoing: 8,
//   incoming: 7,
//   dependencies: 3,
//   blocks: 1,
//   references: 5,
//   hierarchical: 4,
//   bidirectional: 2,
//   active: 14,
//   inactive: 1
// }
```

### Relationship Metadata System

#### Flexible Metadata Storage
```typescript
relationship.updateMetadata('strength', 8);           // 1-10 relationship strength
relationship.updateMetadata('notes', 'Critical path dependency');
relationship.updateMetadata('priority', 'high');       // low, medium, high, critical
relationship.updateMetadata('conditions', {           // Custom conditions
  'trigger_type': 'completion',
  'percentage_threshold': 100,
  'validation_required': true
});
```

#### Business Logic Integration
```typescript
// Relationship-aware business rules
if (relationship.isDependency()) {
  // Block target entity until source completes
  await blockEntityProgress(relationship.target_entity_id);
}

if (relationship.isHierarchy()) {
  // Cascade status changes up/down hierarchy
  await propagateStatusChange(relationship);
}

if (relationship.getStrength() >= 8) {
  // High-strength relationships require approval to break
  await requireApprovalForDeletion(relationship);
}
```

### Integration with Organization System

#### Organization-Scoped Relationships
```typescript
// All relationships are scoped to organization context
const relationshipManager = new EntityRelationshipManager(orgId);

// Only creates relationships between entities in same organization
const relationship = await relationshipManager.createRelationship({
  source_entity_type: 'project',
  source_entity_id: org_123_project_001,    // Org-scoped entity ID
  target_entity_type: 'task',
  target_entity_id: org_123_task_001,       // Org-scoped entity ID  
  relationship_type: 'contains'
});
```

#### Multi-Tenant Isolation
```typescript
// Relationships respect organization boundaries
const techCorpRelationships = await getEntityRelationships(orgId: 'techcorp');
const startupRelationships = await getEntityRelationships(orgId: 'startup');

// No cross-organization relationships possible
// Prevents data leakage between tenants
```

### Foundation Integration

#### Archetype Pattern Support
```typescript
// EntityRelationship is a foundation entity in the registry
class FoundationEntityRegistry {
  static getEntityClasses() {
    return {
      User,
      EntityRelationship,           // ← Custom relationship system
      ContainerPermission,
      Project: ProjectArchetype,
      // ... other archetypes
    };
  }
  
  static getSupportedRelationshipTypes(): string[] {
    return [
      'depends_on', 'blocks', 'blocked_by', 
      'relates_to', 'references', 'referenced_by',
      'contains', 'contained_by', 'parent_of', 'child_of',
      'duplicates', 'duplicated_by', 'follows', 'preceded_by'
    ];
  }
}
```

### Performance Optimizations

#### Strategic Indexing
```sql
-- Optimized indexes for relationship queries
CREATE INDEX idx_entity_relationship_source ON entity_relationship(source_entity_type, source_entity_id);
CREATE INDEX idx_entity_relationship_target ON entity_relationship(target_entity_type, target_entity_id);
CREATE INDEX idx_entity_relationship_type ON entity_relationship(relationship_type);
CREATE INDEX idx_entity_relationship_active ON entity_relationship(is_active);
CREATE INDEX idx_entity_relationship_metadata ON entity_relationship USING GIN(metadata);
```

#### Query Optimization
```typescript
// Efficient relationship queries
const outgoingDependencies = EntityRelationshipUtilities.getOutgoingRelationships(
  relationships,
  'task',
  'task_001'
).filter(rel => rel.relationship_type === 'depends_on');

// Batched relationship operations
const relationshipsByType = EntityRelationshipUtilities.groupByType(relationships);
const sortedRelationships = EntityRelationshipUtilities.sortBySortOrder(relationships);
```

### Real-World Usage Examples

#### Software Development Workflow
```typescript
// Epic → Stories → Tasks
await createRelationship('project', 'epic_001', 'task', 'story_001', 'contains');
await createRelationship('task', 'story_001', 'task', 'dev_task_001', 'contains'); 
await createRelationship('task', 'dev_task_001', 'task', 'test_task_001', 'blocks');

// Documentation links
await createRelationship('task', 'story_001', 'document', 'requirements_doc', 'references');
await createRelationship('document', 'api_spec', 'file', 'openapi_schema', 'references');
```

#### Marketing Campaign Management  
```typescript
// Campaign → Assets → Activities
await createRelationship('project', 'campaign_001', 'file', 'creative_assets', 'contains');
await createRelationship('project', 'campaign_001', 'activity', 'launch_event', 'contains');
await createRelationship('activity', 'launch_event', 'task', 'social_media_posts', 'depends_on');

// Content relationships
await createRelationship('document', 'campaign_brief', 'file', 'brand_guidelines', 'references');
```

### Benefits of Custom Relationship System

1. **Universal Connectivity**: Connect any archetype entities with meaningful relationships
2. **Workflow Modeling**: Model complex business workflows with dependency management  
3. **Circular Detection**: Prevent deadlock situations in project/task dependencies
4. **Flexible Metadata**: Store relationship-specific data and business context
5. **Performance Optimized**: Strategic indexing for fast relationship queries
6. **Multi-Tenant Safe**: Perfect organization-level isolation
7. **Bidirectional Support**: Automatic inverse relationship management
8. **Soft Delete**: Deactivate relationships without losing historical data

This relationship system transforms VibeStack from a collection of isolated entities into a **connected knowledge graph** where business workflows, dependencies, hierarchies, and associations are first-class citizens of the platform.

## 💳 Polar Billing Integration

VibeStack integrates with Polar for complete subscription billing and payment processing.

### Architecture Overview

The billing system provides:
- **Subscription Management**: Free, Pro, and Enterprise tiers with usage limits
- **Webhook Processing**: Real-time billing event handling with signature verification
- **Organization Creation**: Automatic organization creation from successful billing
- **Usage Tracking**: Multi-dimensional usage monitoring with limit enforcement
- **Audit Trail**: Complete billing event history for compliance and debugging

### Subscription Tiers

**14-Day Free Trial**
- Full access to all Pro features
- Unlimited entities during trial
- Up to 25 team members
- 10 GB storage
- 50,000 API calls during trial
- No credit card required
- Automatic trial expiration enforcement

**VibeStack Starter ($5/month, $50/year)**
- Perfect for small teams
- Unlimited entities and projects
- Up to 3 team members
- 5 GB storage
- 5,000 API calls per month
- Email support
- 17% savings with annual billing

**VibeStack Pro ($19/month, $190/year)**
- Perfect for growing teams
- Unlimited entities and projects
- Up to 25 team members
- 50 GB storage
- 25,000 API calls per month
- Advanced integrations
- Standard support
- 17% savings with annual billing

**VibeStack Enterprise ($99/month, $990/year)**
- Everything in Pro
- Unlimited team members
- 500 GB storage
- 250,000 API calls per month
- Custom integrations & API access
- Priority support + dedicated success manager
- Advanced security (SSO, audit logs)
- Custom onboarding
- 17% savings with annual billing

### Database Schema

The billing integration extends the existing schema:

```sql
-- Organizations table extensions
ALTER TABLE organizations ADD COLUMN polar_customer_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trialing';
ALTER TABLE organizations ADD COLUMN subscription_seats INTEGER DEFAULT 25;
ALTER TABLE organizations ADD COLUMN trial_started_at TIMESTAMP DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days');
ALTER TABLE organizations ADD COLUMN billing_email VARCHAR(255);

-- Usage tracking table
CREATE TABLE organization_usage (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metric_type VARCHAR(50) NOT NULL, -- 'api_calls', 'storage_gb', 'active_users'
    usage_count INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    synced_to_polar BOOLEAN DEFAULT false
);

-- Billing events audit table
CREATE TABLE organization_billing_events (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_type VARCHAR(100) NOT NULL,
    polar_event_id VARCHAR(255),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false
);

-- Subscription limits table
CREATE TABLE subscription_limits (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    tier VARCHAR(50) NOT NULL, -- 'free', 'pro', 'enterprise'
    limit_type VARCHAR(100) NOT NULL, -- 'api_calls_per_month', 'storage_gb'
    limit_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true
);
```

### Webhook Processing

The Polar webhook handler at `src/api/polar-webhooks.ts` processes billing events:

**Signature Verification**
```typescript
function verifyPolarSignature(payload: string, signature: string, secret: string): boolean {
  const cleanSecret = secret.startsWith('whsec_') ? secret.substring(6) : secret;
  const expectedSignature = crypto
    .createHmac('sha256', cleanSecret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex')
  );
}
```

**Event Types Handled**
- `customer.created` - Customer registration
- `subscription.created/updated/active` - Subscription lifecycle
- `subscription.canceled` - Subscription cancellation
- `order.paid` - Successful payment processing
- `checkout.created/updated` - Checkout flow tracking

### Organization Creation Flow

Organizations are created automatically when billing succeeds:

1. **Customer Registration**: Polar creates customer, webhook received
2. **Subscription Active**: When subscription becomes active, organization is created
3. **Automatic Setup**: Organization gets proper tier, limits, and billing settings

```typescript
async function createOrganizationFromBilling(db: any, customer: any, subscription: any, product: any) {
  const tier = product?.name?.toLowerCase().includes('pro') ? 'pro' : 
               product?.name?.toLowerCase().includes('enterprise') ? 'enterprise' : 'free';
  
  const organizationData = {
    id: uuidv7(),
    name: `${customer.email.split('@')[0]}'s Organization`,
    slug: `org-${customer.id.slice(-8)}`,
    polar_customer_id: customer.id,
    subscription_tier: tier,
    subscription_status: subscription.status,
    billing_email: customer.email,
    billing_settings: {
      polar_subscription_id: subscription.id,
      created_from_billing: true
    }
  };
  
  return await db.insertInto('organizations').values(organizationData).execute();
}
```

### Usage Tracking and Limits

**Usage Recording**
```sql
-- Record API call usage
SELECT record_organization_usage(
  '12345678-1234-1234-1234-123456789012'::UUID,
  'api_calls',
  1,
  '{"endpoint": "/api/tasks", "method": "POST"}'::JSONB
);
```

**Limit Checking**
```sql
-- Check organization limits
SELECT check_organization_limits(
  '12345678-1234-1234-1234-123456789012'::UUID,
  'api_calls_per_month'
);
```

**Response Format**
```json
{
  "tier": "pro",
  "limit_type": "api_calls_per_month", 
  "limit_value": 10000,
  "current_usage": 1500,
  "remaining": 8500,
  "exceeded": false,
  "usage_percentage": 15.0
}
```

### Multi-Tenant Billing Security

All billing tables use Row Level Security (RLS):

```sql
-- Usage isolation
CREATE POLICY "organization_usage_isolation" ON organization_usage
  USING (organization_id = get_current_organization_id());

-- Billing events isolation  
CREATE POLICY "organization_billing_events_isolation" ON organization_billing_events
  USING (organization_id = get_current_organization_id());
```

### Integration with Custom Organization System

The Polar billing integrates seamlessly with the custom organization system:

- **Role-Based Access**: Billing operations respect RBAC hierarchy
- **Member Management**: Subscription seats control member limits
- **Feature Gating**: Subscription tiers gate advanced features
- **Usage Enforcement**: API middleware checks limits before processing

### Webhook Endpoint Configuration

Production webhook endpoint: `https://api.vibestack.com/api/polar/webhooks`
Development with Cloudflare tunnel: `https://{tunnel-id}.trycloudflare.com/api/polar/webhooks`

The webhook includes:
- HMAC-SHA256 signature verification
- Event deduplication by Polar event ID
- Automatic retry logic for failed processing
- Complete audit trail for all billing events

### Trial Enforcement

The system enforces trial expiration through middleware that:
- **Blocks expired trials**: Prevents data modification after 14 days
- **Graceful degradation**: Read-only access during expired trial
- **Clear messaging**: Provides upgrade prompts and billing links
- **Automatic enforcement**: No manual intervention required

```typescript
// Trial status check function
const trialCheck = await checkTrialStatus(organizationId);
if (trialCheck.expired && trialCheck.needsUpgrade) {
  return c.json({
    error: 'Trial expired',
    details: {
      message: `Your 14-day trial expired ${trialCheck.daysExpired} days ago.`,
      upgrade_url: '/billing/upgrade',
      contact_sales: '/contact-sales'
    }
  }, 402); // 402 Payment Required
}
```

### Key Benefits

1. **Simplified Onboarding**: No complex free tier limits to manage
2. **Higher Conversion**: 14-day trials convert better than freemium models
3. **Perfect Isolation**: Multi-tenant billing data with RLS security
4. **Clear Value Proposition**: Users experience full platform capabilities
5. **Automatic Enforcement**: Trial expiration without manual intervention
6. **Real-Time Processing**: Webhook-driven billing event processing
7. **Secure Verification**: HMAC signature verification prevents fraud
8. **Revenue Predictability**: All users are either trial or paying
9. **Seamless Integration**: Works with existing custom organization system

## 🔄 Real-Time Synchronization System

### Organization-Aware WAL Polling & Real-Time Sync

**Architecture:** Single database with organization-aware change tracking for perfect multi-tenant isolation.

#### 1. Change History System (Migration 006)

**Organization-Aware Change Tracking:**
```sql
-- From 006_wal_rls_integration.sql
CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    lsn TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    data JSONB NOT NULL,
    client_id TEXT,  -- Anti-echo support
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS for perfect tenant isolation
ALTER TABLE change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_history_org_isolation" ON change_history
    USING (
        current_setting('app.system_mode', true) = 'true' OR
        organization_id = current_setting('app.current_organization_id', true)::UUID
    );
```

#### 2. WebSocket Sync with Organization Context

**Organization-Scoped Real-Time Updates:**
```typescript
// From actual sync testing - WebSocket authentication requires organization membership
class SyncDO {
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const orgId = url.searchParams.get('orgId');
    const clientId = url.searchParams.get('clientId');
    
    // Validate organization membership before WebSocket upgrade
    const orgAccessService = new OrgAccessService(this.env.DATABASE_URL);
    const hasAccess = await orgAccessService.hasOrganizationAccess(userId, orgId);
    
    if (!hasAccess) {
      return new Response('Organization access denied', { status: 401 });
    }
    
    // WebSocket connection is now organization-scoped
    return new Response(null, { status: 101, webSocket: client });
  }
}
```

#### 3. Message Acknowledgment Flow

**Bidirectional Sync with Organization Filtering:**
```typescript
// Tested message flow:
// 1. Client sends changes → srv_changes_received acknowledgment
// 2. Server processes changes → srv_changes_applied confirmation  
// 3. Server broadcasts to organization members only

// Example from test-websocket-message-flow.cjs:
const message = {
  type: 'client_changes',
  changes: [/* organization-scoped changes */],
  clientId: 'test-client-123',
  organizationId: '934fd0a8-f306-4f13-a544-094282f047eb'
};

// Server response confirms organization context:
{
  type: 'srv_changes_applied',
  appliedCount: 3,
  organizationId: '934fd0a8-f306-4f13-a544-094282f047eb',
  timestamp: '2025-08-15T18:30:45.123Z'
}
```

#### 4. Organization Data Isolation Testing

**Real-World Validation:**
- **Tested Organization:** TechFlow Solutions (`934fd0a8-f306-4f13-a544-094282f047eb`)
- **Members:** 4 users with different roles (owner/admin/manager/member)
- **WebSocket Auth:** Successfully validates organization membership before connection
- **Change Filtering:** Only changes belonging to user's organizations are synced
- **Anti-Echo:** `client_id` prevents echoing changes back to originating client

#### 5. Sync Engine Architecture

**Table-Agnostic Organization-Aware Sync:**
```typescript
// From generic-sync-engine.ts - organization context respected throughout
class GenericSyncEngine {
  async getChangesForClient(lastSyncTimestamp: Date, tables: string[]): Promise<Record<string, any[]>> {
    // All queries automatically filtered by organization context via RLS
    const changes: Record<string, any[]> = {};
    
    for (const tableName of tablesToSync) {
      const records = await this.db
        .selectFrom(tableName as TableName)
        .selectAll()
        .execute(); // RLS automatically filters by current organization
      
      if (records.length > 0) {
        changes[tableName] = records;
      }
    }
    
    return changes;
  }
}
```

**Key Benefits:**
- **Perfect Isolation**: RLS ensures zero data leakage between organizations
- **Performance**: Single database with optimized indexes for organization queries
- **Real-time**: WebSocket connections respect organization boundaries
- **Anti-Echo**: Changes don't echo back to originating client
- **Scalability**: Shared infrastructure scales better than per-tenant databases

## 🗄️ Database Architecture Evolution

### Migration from Multiple ORMs to Kysely

Recent consolidation (commits c0fb1829, 03f25fe4, f68c372e):

**Before**: Multiple query layers
- MikroORM for entity definitions
- Drizzle for some queries  
- Raw SQL for complex operations

**After**: Unified Kysely architecture
- **Type-safe SQL builder**: End-to-end type safety from database to client
- **Better performance**: No ORM overhead, optimized queries
- **Multi-tenant support**: Native organization-aware query building
- **Simplified codebase**: Single query layer reduces complexity

### Database Schema Design

**Organization Tables**:
```sql
-- Core Organization System (from migration 003_custom_organization_system_final.sql)
organizations               -- Main org entities: subscription, billing, limits, settings
organization_members         -- User-org relationships with 5-tier RBAC system
organization_invitations    -- Token-based invitations with expiration
organization_audit_logs     -- Complete compliance and security audit trail

-- WAL & Change History (from migration 006_wal_rls_integration.sql)
change_history              -- Organization-aware change tracking with RLS

-- Business Entity Tables (organization-scoped with RLS)
-- Note: Current implementation uses shared tables with organization_id columns
-- rather than per-organization table generation for better performance
projects                    -- organization_id UUID, RLS enabled
tasks                       -- organization_id UUID, RLS enabled  
entity_relationships        -- organization_id UUID, cross-entity references
-- Additional business tables follow same pattern
```

**Universal System Tables**:
```sql
-- Polymorphic systems that work across all entity types
labels                      -- Hierarchical categorization
options                     -- Flexible configuration options
entity_relationships        -- Cross-entity references
container_permissions       -- Fine-grained access control
```

## 🔐 Access Control & Security

### Multi-Layer Security Model

1. **Organization Isolation**: RLS policies ensure perfect tenant separation
2. **Container-Based Permissions**: Entities belong to containers with specific access rules
3. **Role-Based Access Control**: Organization members have roles (owner, admin, member, guest)
4. **Field-Level Security**: Custom fields can have their own access controls

### Container Access Control

```typescript
export abstract class BaseDomainEntity extends BaseSystemEntity {
  @Property({ nullable: true })
  containerType?: ContainerType; // 'project' | 'department' | 'workspace' | 'user' | 'system'
  
  @Property({ nullable: true })
  containerId?: string;
  
  @Property()
  archetype!: string; // Links to one of 8 universal patterns
}
```

## 📦 Package Structure & Code Organization

### Current Structure
```
apps/server/src/
├── api/                     # API routes and endpoints
├── auth/                    # Better Auth integration
├── services/organization/   # Custom organization system
│   ├── OrganizationService.ts
│   ├── OrganizationMemberService.ts
│   └── OrganizationInvitationService.ts
├── types/organization.ts    # Organization type definitions
├── dataforge/               # Entity management system
│   ├── entities/            # Entity definitions
│   │   ├── base/           # Base entity classes
│   │   ├── foundation/     # Foundation entity system
│   │   │   ├── core/       # Core entities (User, EntityRelationship)
│   │   │   ├── access/     # Access control entities
│   │   │   ├── universal/  # Universal systems (labels, options)
│   │   │   └── archetypes/ # Universal archetype patterns
│   │   └── week5-index.ts  # Entity exports
│   ├── entity-operations/  # Entity CRUD operations
│   ├── durable-objects/    # Cloudflare DO services
│   ├── migration/          # Schema migration system
│   └── services/           # Business logic services
├── middleware/              # Multi-tenant middleware
├── replication/            # WAL polling and sync
├── sync/                   # Real-time synchronization
└── types/                  # TypeScript type definitions

packages/dataforge/
├── src/
│   ├── entities/           # DataForge entity definitions
│   ├── migrations/         # Database migrations
│   ├── services/           # Service layer
│   └── generated/          # Auto-generated schemas
└── temp/                   # Temporary JSON exports
```

### Planned Unified Structure
```
packages/
├── dataforge/                           # Core archetype system
│   ├── src/
│   │   ├── base-archetypes/             # Abstract base classes
│   │   ├── shared-entities/             # Global entities
│   │   ├── services/                    # Core services
│   │   └── scripts/                     # Generation scripts
│   └── generated/                       # Base schema outputs
├── test-orgs/                          # Organization implementations
│   ├── acme-corp/
│   │   ├── config/                     # Organization configuration
│   │   ├── generated/                  # Auto-generated artifacts
│   │   └── migrations/                 # Auto-generated migrations
│   └── techflow-agency/
└── server/                             # Updated server integration
```

## 🚀 Implementation Phases & Roadmap

### Completed (Recent Commits)

#### Phase 1 Week 1: Enhanced Base Entities & Multi-Tenant Infrastructure (c790bcbe)
- ✅ UUIDv7 primary key implementation
- ✅ Audit trail enhancement with `createdBy` field
- ✅ Container access control in BaseDomainEntity
- ✅ Multi-tenant organization entities
- ✅ Database instance routing
- ✅ Comprehensive foundation testing

#### Phase 1 Week 2: Universal Archetype System Foundation (28643d62)  
- ✅ Hybrid table architecture (base + metadata tables)
- ✅ System option types with business logic
- ✅ Custom option types for user-defined fields
- ✅ Business logic services with validation
- ✅ Workflow integrity testing

#### Multi-Org Platform Architecture Planning & POC (df962f45)
- ✅ Multi-org implementation plan with server-only DataForge
- ✅ Function Factory POC with Durable Objects validation
- ✅ JSON Rules Engine for Cloudflare Workers compatibility
- ✅ Custom multi-tenant organization system with enterprise features
- ✅ Server-only development strategy

#### Database Consolidation to Kysely (f68c372e, 03f25fe4, c0fb1829)
- ✅ Migration from MikroORM/Drizzle to unified Kysely
- ✅ Type-safe SQL builder implementation
- ✅ Multi-tenant query support
- ✅ Performance optimization

#### Organization-Aware WAL Polling (Recent)
- ✅ Updated regex patterns for UUIDv7-based organization IDs
- ✅ Organization context extraction from table names
- ✅ Change history with organization tracking
- ✅ RLS integration for perfect tenant isolation

### Planned Phases

#### Phase 2: Archetype Implementation
- **Week 3**: Core archetype patterns (Project, Task, Record)
- **Week 4**: Advanced archetypes (Document, File, Activity, Discussion, Collection)
- **Week 5**: Custom field integration and validation
- **Week 6**: Archetype relationships and polymorphic references

#### Phase 3: Access Control Implementation  
- **Week 7**: Container-based permission system
- **Week 8**: Role-based access control (RBAC)
- **Week 9**: Field-level security and data protection
- **Week 10**: Security audit and compliance testing

#### Phase 4: Real-Time & Performance
- **Week 11**: Enhanced real-time synchronization
- **Week 12**: Performance optimization and caching
- **Week 13**: Conflict resolution and offline support
- **Week 14**: Multi-tenant isolation testing

#### Phase 5: Production Deployment
- **Week 15**: Production multi-org deployment setup
- **Week 16**: Monitoring, logging, and observability
- **Week 17**: Final integration testing and performance validation

## 🎯 Key Innovations & Benefits

### Universal Archetype System Benefits
- **Consistency**: All business entities follow proven patterns
- **Flexibility**: Organizations can extend base archetypes with custom fields
- **Type Safety**: Full TypeScript type safety from database to client
- **Maintainability**: Centralized business logic with archetype-specific validation

### Multi-Tenant Architecture Benefits
- **Perfect Isolation**: Complete data separation between organizations
- **Scalability**: Each organization can have unlimited custom entities
- **Security**: Multiple layers of access control and data protection
- **Performance**: Organization-scoped queries and RLS optimization

### Real-Time Synchronization Benefits
- **Live Updates**: Instant propagation of changes across all clients
- **Organization Filtering**: Changes only sent to relevant organization members
- **Conflict Resolution**: Client-side conflict resolution with server validation
- **Offline Support**: Planned support for offline-first functionality

### Development Experience Benefits
- **Type Safety**: End-to-end TypeScript type safety
- **Auto-Generation**: Automatic schema generation from entity definitions
- **Hot Reload**: Real-time schema evolution with debounced migrations
- **Testing**: Comprehensive test suite with realistic business scenarios

## 🔮 Future Vision

VibeStack is positioned to become a **Universal Business Entity Platform** where:

1. **Organizations** can model any business process using universal archetypes
2. **Developers** get type-safe, real-time data synchronization out of the box
3. **Business Users** can create custom entities without developer intervention
4. **Platform Operators** can manage thousands of organizations with perfect isolation

The system combines the **flexibility of low-code platforms** with the **performance and type safety of custom development**, creating a unique position in the SaaS platform market.

---

*This reference document reflects the current state of VibeStack as of the recent multi-tenant SaaS MVP refactor and organization-aware WAL polling implementation.*