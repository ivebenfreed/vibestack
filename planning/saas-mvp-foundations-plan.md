# SaaS MVP Foundations Plan: Complete Data Model & Access Control Transformation

## Current State Analysis

### Existing Architecture Review

#### Current Entity Structure
- **BaseSystemEntity**: UUID primary key, timestamps (createdAt, updatedAt)
- **BaseDomainEntity**: Adds clientId for sync purposes
- **Current Entities**: User, Project, Task with domain-specific fields and relationships

#### Architecture Gaps Identified

**❌ Missing Multi-Tenancy:**
- No organization/tenant isolation
- All entities share global namespace
- No tenant-scoped data access

**❌ Missing Access Control:**
- No container-based permissions
- No role-based field access
- No archetype-specific access patterns

**❌ Missing Universal Patterns:**
- Domain-specific entities instead of universal archetypes
- No polymorphic relationships
- No unified CRUD patterns

**❌ Missing Modern Foundations:**
- No UUIDv7 for timestamp ordering
- No event sourcing capabilities
- No field-level audit trails

### Planning Document Review

#### From `entity-archetypes-definition.md`:
- ✅ 8 Universal Archetypes defined (Project, Task, Record, Document, File, Activity, Discussion, Collection)
- ✅ Base Domain Entity properties specified
- ✅ System Option Set Types designed
- ✅ Universal relationships mapped

#### From `archetype-access-patterns.md`:
- ✅ Container-based access control architected
- ✅ Archetype-specific access patterns defined
- ✅ Field-level access control designed
- ✅ Sync integration with channel-based filtering

#### From `entity-datamodel-tech-plan.md`:
- ✅ Multi-tenant database-per-organization strategy
- ✅ Curated field type approach
- ✅ Schema evolution without downtime
- ✅ Phase-by-phase implementation timeline

#### From `livestore-client-migration-plan.md`:
- ✅ Client-side storage upgrade strategy
- ✅ Event-driven archetype operations
- ✅ Translation layer for server compatibility
- ✅ Hybrid migration approach

#### From `relatedb-mvp-specification.md`:
- ✅ Local-first architecture requirements
- ✅ Performance targets defined
- ✅ Relationship-first data modeling
- ✅ Real-time sync protocols

## Foundational Architecture Transformation

### Phase 1: Universal Entity Foundation (Weeks 1-4)

#### 1.1 Enhanced Base Entities
- **BaseSystemEntity**: Upgrade to UUIDv7 for timestamp ordering, add createdBy audit field
- **BaseDomainEntity**: Add containerType, containerId, archetype fields (no organizationId - database provides isolation)
- **Archetype Base Classes**: BaseProject, BaseTask, BaseRecord with computed container logic

#### 1.2 Multi-Tenant Infrastructure

**Control Plane (Shared Database):**
- **Organization**: Tenant management with slug, domain, settings, planType, status
- **OrganizationMember**: User membership with roles (admin, member, viewer) and status tracking
- **DatabaseInstance**: Per-org database connection tracking and routing

**Data Plane (Per-Organization Databases):**
- **User**: Organization-scoped user data and preferences (special case - references Better Auth but extends with org-specific data)
- **ContainerPermission**: Fine-grained access control with container-based permissions (no organizationId needed)

**⚠️ Authentication Entity Exclusion:**
- **Better Auth Entities**: Account, Session, Verification managed entirely by Better Auth
- **Stay Out**: Do not include auth entities in our archetype or container management systems
- **User Entity**: Special case that references Better Auth user but adds organization-specific data

#### 1.3 Universal Archetype System

**System Option Set Types** (Built-in Business Logic):
- **StatusOptionSet**: Workflow states with completion criteria and transition rules
- **PriorityOptionSet**: Urgency levels with escalation rules and SLA metadata
- **CategoryOptionSet**: Classification with auto-assignment rules and default behaviors
- **DiscussionTypeOptionSet**: Communication types with threading and resolution capabilities

**Generic Option Sets** (Custom Fields):
- **OptionSet**: User-defined dropdown/select fields with basic value/label pairs
- **OptionDefinition**: Individual option values without special business logic

**Universal Systems:**
- **EntityRelationship**: Universal polymorphic relationships between any archetypes
- **Label/EntityLabel**: Universal tagging system for all entities

### Phase 2: Archetype Implementation (Weeks 5-12)

#### 2.1 The 8 Universal Archetypes

**Core Business Archetypes:**
- **Project**: Strategic initiatives with owner, members, status/priority options, hierarchical structure, completion criteria
- **Task**: Executable work items with assignee, watchers, status/priority options, hierarchical structure

**Information Archetypes:**
- **Record**: Structured business data (contacts, companies, products) with recordType, custom fields, hierarchical structure
- **Document**: Editable content with versioning, format support (markdown, html, canvas), publishing workflow
- **File**: Binary assets with storage integration, metadata, processing status

**Communication & Event Archetypes:**
- **Activity**: Time-based events with scheduling, recurrence, participants, location
- **Discussion**: Communication threads with polymorphic attachment, threading, mentions
- **Collection**: Groups of related items with aggregates, ordering, metadata

#### 2.2 Supporting Infrastructure Entities (Not Archetypes)

**Membership & Participation:**
- **ProjectMember**: Team collaboration with role-based access
- **TaskWatcher**: Visibility tracking for team members
- **ActivityParticipant**: Event participation tracking with roles and status
- **CollectionItem**: Individual collection members with sort order and metadata

**Versioning & History:**
- **DocumentRevision**: Version history with change tracking

### Phase 3: Access Control & Multi-Tenancy (Weeks 13-20)

#### 3.1 Advanced Access Control Service
- **ArchetypeAccessControlService**: Unified access control with archetype-specific patterns
- **Container Access Logic**: Automatic container assignment based on entity type and business rules
- **Field-Level Filtering**: Dynamic field access based on user roles and entity relationships
- **Access Validation**: Pre-operation permission checking for create, read, update, delete operations

#### 3.2 Multi-Tenant Data Service
- **Database-per-Organization**: Isolated databases with Neon branch provisioning
- **Organization Management**: Tenant creation with automatic schema deployment
- **Default Setup**: Automatic option set creation and admin user provisioning
- **Connection Routing**: Organization-scoped database connections and query execution

### Phase 4: LiveStore Client Integration (Weeks 17-20)

#### 4.1 Client Storage Upgrade Strategy
- **Parallel Systems**: Run Dexie and LiveStore side-by-side during migration
- **Feature Flag Migration**: Gradual archetype-by-archetype migration (Tasks → Projects → Records → etc.)
- **Translation Layer**: Convert LiveStore events to existing TableChange format for server compatibility
- **Zero Server Changes**: Keep WebSocket protocol, LSN management, and sync logic unchanged

#### 4.2 LiveStore Schema Design
- **SQLite Schema**: Define archetype tables with native relationships and performance optimization
- **Event-Driven Operations**: Replace direct data mutations with semantic events (TaskCompleted, ProjectCreated)
- **Access Control Integration**: Apply container permissions at client level before storage
- **Multi-Tenant Store Management**: Organization-scoped LiveStore instances with automatic routing

#### 4.3 Event Translation Architecture
- **LiveStoreToVibeStackAdapter**: Convert semantic events to TableChange messages
- **Automatic Sync**: Event stream automatically triggers sync to existing server infrastructure
- **Rollback Safety**: Instant fallback to Dexie via feature flags if issues arise
- **Validation Period**: Parallel execution to ensure identical server messages

### Phase 5: Integration & Migration (Weeks 21-24)

#### 5.1 Unified API Layer
- **VibeStackUnifiedAPI**: Single interface for all archetype operations with automatic access control
- **Universal CRUD**: Consistent create, read, update, delete operations across all archetypes
- **Cross-Archetype Queries**: Complex operations spanning multiple entity types (project dashboards, relationship creation)
- **Universal Labeling**: Polymorphic tagging system for all entities

#### 5.2 Greenfield Implementation Strategy
- **Clean Architecture**: Build archetype system from scratch without legacy constraints
- **Default Organization Setup**: Create starter templates for new organizations with sample data
- **Option Set Templates**: Pre-built status, priority, and category options for common business domains
- **Onboarding Flow**: Guide users through archetype-based data modeling for their specific needs

## Implementation Timeline & Success Metrics

### Weeks 1-4: Foundation
- ✅ Enhanced base entities with UUIDv7 and database-per-org architecture
- ✅ System option set types vs generic option sets distinction
- ✅ Universal relationship framework
- **Success Metric**: All new entities inherit proper archetype patterns

### Weeks 5-12: Core Archetypes
- ✅ 8 universal archetypes (Project, Task, Record, Document, File, Activity, Discussion, Collection)
- ✅ Supporting infrastructure entities (membership, participation, versioning)
- ✅ Archetype-specific container access patterns
- **Success Metric**: 8 archetypes handle 100% of current use cases

### Weeks 13-16: Access Control & Multi-Tenancy
- ✅ Archetype-specific access control service
- ✅ Multi-tenant data service with database-per-org
- ✅ Default option sets and organization provisioning
- **Success Metric**: Complete data isolation between organizations

### Weeks 17-20: LiveStore Client Integration
- ✅ SQLite schema design for all archetypes
- ✅ Event-driven operations with translation layer
- ✅ Parallel Dexie/LiveStore systems with feature flags
- **Success Metric**: Zero server changes, identical sync behavior

### Weeks 21-24: Greenfield Implementation
- ✅ Unified API layer with automatic access control
- ✅ Clean archetype-based data modeling from scratch
- ✅ Complete LiveStore adoption with SQLite performance
- **Success Metric**: Superior capabilities compared to legacy approach

## Business Impact

### Technical Benefits
- **Universal Patterns**: 8 archetypes replace dozens of domain-specific entities
- **True Multi-Tenancy**: Database-per-organization with complete isolation
- **Sophisticated Access Control**: Container-based with field-level permissions
- **Event Sourcing Ready**: Foundation for audit trails and temporal queries
- **Relationship Performance**: Optimized for relational database strengths

### Product Benefits
- **Rapid Feature Development**: Universal archetype patterns accelerate new features
- **Enterprise Ready**: Multi-tenant with sophisticated access control
- **Data Integrity**: ACID transactions and referential integrity
- **Audit Compliance**: Complete change tracking and access logs
- **Scalability**: Database-per-org scales indefinitely

### Market Position
- **Relationship-First Database**: True relational performance at spreadsheet speeds
- **Local-First Architecture**: Zero-latency queries with cloud backup
- **Enterprise Access Control**: Container-based permissions exceed competitors
- **Universal Data Model**: Works across all business domains and use cases

This plan transforms VibeStack from a project management tool into a universal, relationship-first database platform that can compete with Airtable, Notion, and Monday.com while delivering superior performance and capabilities.