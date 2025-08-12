# Phase 1: Foundation Implementation Plan (Weeks 1-4)

## Overview

Phase 1 establishes the foundational architecture for the universal archetype system, multi-tenant infrastructure, and database-per-organization setup. This phase creates the base entities and systems that all future archetypes will build upon.

## Week 1: Enhanced Base Entities & Multi-Tenant Infrastructure

### 1.1 Enhanced Base Entity System

#### BaseSystemEntity Upgrade
- [ ] **UUIDv7 Primary Key Implementation**
  - [ ] Install/configure UUIDv7 library for PostgreSQL
  - [ ] Update `gen_random_uuid()` to `generate_uuidv7()` in defaultRaw
  - [ ] Test timestamp ordering properties of generated UUIDs
  - [ ] Create migration to update existing UUID generation

- [ ] **Audit Trail Enhancement**
  - [ ] Add `createdBy` field (UUID, nullable, references User)
  - [ ] Update MikroORM BaseSystemEntity with new field
  - [ ] Test audit trail inheritance across all entities
  - [ ] Add indexes for performance (`created_by_id`, `created_at`)

#### BaseDomainEntity Multi-Tenant Update
- [ ] **Container Access Control Fields**
  - [ ] Add `containerType` field (string: project, department, workspace, user, system)
  - [ ] Add `containerId` field (UUID: container identifier)
  - [ ] Add `archetype` field (string: project, task, record, document, file, activity, discussion, collection)
  - [ ] Remove `organizationId` field (database isolation provides tenant separation)
  - [ ] Update all existing entities to inherit new structure

- [ ] **Archetype Base Classes**
  - [ ] Create `BaseProject` with computed `archetype`, `containerType`, `containerId` properties
  - [ ] Create `BaseTask` with project inheritance logic
  - [ ] Create `BaseRecord` with department container pattern
  - [ ] Test `persist: false` computed properties work correctly
  - [ ] Verify container assignment logic for each archetype

### 1.2 Multi-Tenant Database Architecture

#### Control Plane (Shared Database) Setup
- [ ] **Organization Management**
  - [ ] Create `Organization` entity (name, slug, domain, settings, planType, status)
  - [ ] Create `OrganizationMember` entity (organization, user, role, status, timestamps)
  - [ ] Create `DatabaseInstance` entity (organizationId, neonDatabaseId, connectionString, status)
  - [ ] Add unique constraints and indexes
  - [ ] Test organization CRUD operations

- [ ] **Database Connection Routing (Environment-Aware)**
  - [ ] Implement `MultiTenantDatabaseRouter` service with environment detection
  - [ ] Create `LocalDatabaseRouter` for local development (uses local PostgreSQL with schema prefixes)
  - [ ] Create `NeonDatabaseRouter` for production (uses Neon API for database branches)
  - [ ] Add organization-to-database mapping with conditional routing
  - [ ] Test database routing with mock organizations in both environments

#### Data Plane (Per-Organization Database) Setup
- [ ] **User Entity Bridge**
  - [ ] Create `User` entity with `betterAuthUserId` reference
  - [ ] Add organization-specific fields (displayName, department, jobTitle, preferences)
  - [ ] Ensure NO management of Better Auth entities (Account, Session, Verification)
  - [ ] Test user data isolation per organization
  - [ ] Add user lookup and sync utilities

- [ ] **Container Permission System**
  - [ ] Create `ContainerPermission` entity (userId, containerType, containerId, role, grantedBy, expiresAt)
  - [ ] Add role hierarchy (ADMIN > OWNER > MEMBER > VIEWER)
  - [ ] Create permission check utilities
  - [ ] Add permission grant/revoke operations
  - [ ] Test container access control logic

## Week 2: Universal Archetype System Foundation

### 2.1 System Option Set Types (Built-in Business Logic)

#### Hybrid Option System Implementation (Base + Type-Specific Tables)

- [ ] **Base Option Set Entity**
  - [ ] Create `OptionSet` entity extending BaseDomainEntity
  - [ ] Add `name`, `description`, `optionSetType` fields
  - [ ] Add `isSystemType` boolean to distinguish system vs custom option sets
  - [ ] Add unique constraints and indexes for performance

- [ ] **Base Option Entity**
  - [ ] Create `Option` entity with core common fields
  - [ ] Add fields: `value`, `label`, `optionType`, `sortOrder`, `isActive`
  - [ ] Add `color`, `icon`, `description` for UI presentation
  - [ ] Add relationship to parent `OptionSet`
  - [ ] Add base validation and constraints

- [ ] **System Option Type-Specific Metadata Tables**
  - [ ] Create `StatusOptionMetadata` entity with strongly-typed fields:
    - `isCompletionState: boolean`, `allowedTransitions: string[]`
    - `completionCriteria: JSON`, `triggerActions: JSON`
  - [ ] Create `PriorityOptionMetadata` entity with strongly-typed fields:
    - `urgencyLevel: number`, `escalationDays: number`
    - `escalationTarget: string`, `slaHours: number`
  - [ ] Create `CategoryOptionMetadata` entity with strongly-typed fields:
    - `defaultPriority: string`, `requiredFields: string[]`
    - `autoAssignRules: JSON`, `workflowTemplate: string`
  - [ ] Create `DiscussionTypeOptionMetadata` entity with strongly-typed fields:
    - `isThreadable: boolean`, `isResolvable: boolean`
    - `allowsRichContent: boolean`, `requiresParentEntity: boolean`

- [ ] **System Option Services & Validation**
  - [ ] Create typed service classes for each system option type
  - [ ] Implement validation logic with proper TypeScript types
  - [ ] Add business logic enforcement for workflows and transitions
  - [ ] Test type-specific operations and metadata handling

### 2.2 Generic Option Sets (Custom Fields)

#### Custom Field Option System (Extensible Hybrid Approach)

- [ ] **Custom Option Type-Specific Metadata Tables**
  - [ ] Create `CustomFieldMetadata` entity for extensible custom field behavior:
    - `fieldType: string` (text, number, date, boolean, etc.)
    - `validationRules: JSON` (min/max, regex patterns, required)
    - `displaySettings: JSON` (placeholder, helpText, formatting)
  - [ ] Create `CalculatedFieldMetadata` entity for computed custom fields:
    - `formula: string`, `dependencies: string[]`
    - `updateTriggers: string[]`, `resultType: string`
  - [ ] Create `LookupFieldMetadata` entity for reference custom fields:
    - `targetArchetype: string`, `displayField: string`
    - `filterCriteria: JSON`, `allowMultiple: boolean`

- [ ] **Custom Option Set Templates & Management**
  - [ ] Create template system for common custom field patterns
  - [ ] Add validation framework for custom field metadata
  - [ ] Implement option set cloning and inheritance
  - [ ] Add bulk import/export with metadata preservation
  - [ ] Test extensible custom field creation and validation

- [ ] **Unified Option Set API**
  - [ ] Create unified service layer handling both system and custom options
  - [ ] Implement polymorphic queries joining base + metadata tables
  - [ ] Add caching layer for frequently accessed option metadata
  - [ ] Test performance of hybrid table approach with realistic data volumes

## Week 3: Universal Relationship & Labeling Systems

### 3.1 Universal Polymorphic Relationships

#### EntityRelationship System
- [ ] **Relationship Entity**
  - [ ] Create `EntityRelationship` entity with polymorphic source/target
  - [ ] Add relationship types (depends_on, blocks, relates_to, contains, references)
  - [ ] Add metadata field for relationship-specific data
  - [ ] Add sort order for ordered relationships
  - [ ] Create unique constraints to prevent duplicates

- [ ] **Relationship Management**
  - [ ] Create relationship CRUD operations
  - [ ] Add relationship validation (prevent circular dependencies)
  - [ ] Test cross-archetype relationship creation
  - [ ] Add relationship querying and traversal utilities
  - [ ] Create relationship visualization helpers

- [ ] **Dependency System Integration**
  - [ ] Migrate existing `EntityDependency` to new `EntityRelationship` pattern
  - [ ] Add 4-type blocking system (blocks, blocked_by, depends_on, etc.)
  - [ ] Test dependency resolution and cycle detection
  - [ ] Add dependency impact analysis
  - [ ] Create dependency visualization tools

### 3.2 Universal Labeling System

#### Label & EntityLabel System
- [ ] **Label Entities**
  - [ ] Create `Label` entity (name, color, description)
  - [ ] Create `EntityLabel` entity with polymorphic entity reference
  - [ ] Add label hierarchies and categories
  - [ ] Test label creation and assignment
  - [ ] Add label search and filtering

- [ ] **Label Management**
  - [ ] Create label CRUD operations
  - [ ] Add bulk labeling operations
  - [ ] Test label-based entity filtering and search
  - [ ] Add label usage analytics
  - [ ] Create label templates and suggestions

## Week 4: Database Provisioning & Testing

### 4.1 Organization Database Provisioning

#### Environment-Aware Database Provisioning
- [ ] **Database Provisioning Service (Dual Implementation)**
  - [ ] Create `DatabaseProvisioningService` interface for environment abstraction
  - [ ] Implement `LocalDatabaseProvisioner` for local development:
    - Creates new PostgreSQL schemas with `org_<id>_` prefix
    - Uses local connection string with schema switching
    - Mocks Neon API responses for consistent interface
  - [ ] Implement `NeonDatabaseProvisioner` for production:
    - Uses actual Neon API for database branch creation
    - Handles real Neon database lifecycle management
    - Implements proper error handling and retry logic
  - [ ] Add environment detection and service selection
  - [ ] Test provisioning workflows in both local and production modes

- [ ] **Schema Deployment (Environment-Aware)**
  - [ ] Create automated schema migration for new organizations
  - [ ] Implement local schema deployment using schema-prefixed tables
  - [ ] Implement production schema deployment via Neon API database branches
  - [ ] Add default option set creation for new organizations
  - [ ] Test schema consistency across multiple organization isolation methods
  - [ ] Add schema version tracking and upgrade paths for both environments

#### Default Data Setup
- [ ] **Default Option Sets Creation**
  - [ ] Auto-create system option sets for new organizations
  - [ ] Add sample generic option sets for common business needs
  - [ ] Create default container permissions for organization admin
  - [ ] Test default data consistency and completeness
  - [ ] Add customizable default data templates

- [ ] **Environment Configuration**
  - [ ] Add environment variables for local vs production mode:
    - `MULTI_TENANT_MODE=local|production`
    - `NEON_API_KEY` (production only)
    - `LOCAL_DB_SCHEMA_PREFIX=org_` (local only)
  - [ ] Create configuration validation and startup checks
  - [ ] Add development setup documentation for local multi-tenant testing
  - [ ] Test environment switching and fallback behaviors

### 4.2 Comprehensive Testing & Validation

#### Entity System Testing
- [ ] **Base Entity Tests**
  - [ ] Test UUIDv7 generation and ordering
  - [ ] Test audit trail functionality
  - [ ] Test container access control inheritance
  - [ ] Test archetype classification system
  - [ ] Test database isolation between organizations

- [ ] **Option Set Tests**
  - [ ] Test system option set business logic
  - [ ] Test generic option set CRUD operations
  - [ ] Test option set metadata and validation
  - [ ] Test option set templating and sharing
  - [ ] Test option set performance with large datasets

#### Multi-Tenant Architecture Testing
- [ ] **Organization Management Tests**
  - [ ] Test organization CRUD operations
  - [ ] Test user membership and role management
  - [ ] Test database provisioning and connection routing
  - [ ] Test data isolation between organizations
  - [ ] Test organization deletion and cleanup

- [ ] **Relationship & Label Tests**
  - [ ] Test polymorphic relationship creation and validation
  - [ ] Test relationship querying and traversal
  - [ ] Test label creation and assignment
  - [ ] Test cross-archetype labeling and filtering
  - [ ] Test relationship and label performance

#### Integration Testing
- [ ] **End-to-End Workflow Tests**
  - [ ] Test complete organization setup workflow
  - [ ] Test user onboarding and permission assignment
  - [ ] Test entity creation with container access control
  - [ ] Test relationship and label operations
  - [ ] Test system option set workflows


## Success Metrics

### Technical Metrics
- [ ] **All new entities inherit proper archetype patterns** (100% compliance)
- [ ] **Database provisioning completes successfully** per organization
- [ ] **Container access control functions correctly** for all operations
- [ ] **Option set operations work correctly** for basic use cases
- [ ] **Relationship queries function properly** for standard scenarios

### Functional Metrics
- [ ] **System option sets provide workflow automation** for all 8 archetypes
- [ ] **Generic option sets support unlimited custom fields** per archetype
- [ ] **Universal relationships work between any archetype combinations**
- [ ] **Universal labeling supports flexible tagging** across all entities
- [ ] **Multi-tenant isolation provides zero data leakage** between organizations

### Code Quality Metrics
- [ ] **All entities have basic unit tests** for core functionality
- [ ] **All database operations have integration tests** for happy path scenarios
- [ ] **All option set workflows have functional tests** for basic operations
- [ ] **Type safety maintained across all entity operations** (0 TypeScript errors)

## Risk Mitigation

### Technical Risks
- [ ] **UUIDv7 Compatibility**: Ensure UUIDv7 library works correctly with PostgreSQL
- [ ] **Neon API Integration**: Validate Neon API integration functions properly
- [ ] **Option Set Complexity**: Ensure metadata structure supports required functionality
- [ ] **Relationship Cycles**: Implement cycle detection and prevention

### Business Risks  
- [ ] **Foundation Stability**: Phase 1 must work independently for validation
- [ ] **Data Integrity**: Comprehensive validation rules for all entity relationships
- [ ] **Functionality Completeness**: Ensure all required features work correctly

## Dependencies & Prerequisites

### External Dependencies
- [ ] Neon API access and configuration
- [ ] UUIDv7 PostgreSQL extension or library
- [ ] Better Auth integration points identified
- [ ] MikroORM version compatibility verified

### Internal Dependencies
- [ ] Current entity migration plan (for reference only)
- [ ] LiveStore integration requirements (Phase 4 planning)
- [ ] Access control patterns (detailed in Phase 3)
- [ ] Archetype specifications (detailed in Phase 2)

This foundation phase establishes the critical infrastructure that all subsequent phases will build upon. Successful completion ensures a solid base for the 8 universal archetypes and sophisticated access control system.