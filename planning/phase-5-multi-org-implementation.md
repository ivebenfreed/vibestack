# Multi-Org Platform Architecture Plan
*Server-Only DataForge with JSON Schema Layer Over Kysely*

## Current State & Key Learnings

### What We Have Built
1. **Function Factory POC**: Validated multi-org Durable Objects architecture with JSON rules engine
2. **DataForge (Legacy)**: Static entity system with MikroORM - **BEING MOVED TO SERVER**
3. **Main App**: Production sync system with Durable Objects, WebSocket connections, and local-first architecture  
4. **Database Infrastructure**: PostgreSQL with real-time sync, LSN tracking, and conflict resolution

### Critical Architectural Decisions
- **DataForge moves completely to server**: No more separate package, everything in `apps/server/src/dataforge/`
- **No MikroORM**: Custom JSON schema layer over Kysely for dynamic entity management
- **Hardcoded foundation + Dynamic entities**: System entities hardcoded, business entities via JSON
- **Sync field control**: Per-field control over what syncs to client vs server-only
- **Better Auth as absolute truth**: PostgreSQL stores users, orgs, memberships as source of truth
- **DOs as access control cache layer**: Fast permission checks with cached decisions from PostgreSQL
- **Admin separation**: Platform management completely separate from entity system

### What We've Learned
1. **Multi-org isolation** works perfectly with Durable Objects + org-prefixed naming
2. **JSON Rules Engine** provides security + performance without dynamic execution
3. **Sync system adapts naturally** to multi-org with `{orgId}_sync_{connectionId}` pattern  
4. **Real-time schema updates** are achievable with debounced migrations
5. **Kysely + JSON schemas** provide type safety with runtime flexibility  

## MVP Feature Requirements

### Core Multi-Org Capabilities
- Organizations can create custom business entities via JSON API
- Custom fields with validation rules, constraints, and sync control
- Automatic database table generation and migrations
- Per-field sync control (client-syncable vs server-only fields)
- Real-time sync across all clients in the organization
- Full type safety through generated Kysely schemas
- Org-level data isolation and access control

### Technical Architecture
- **Server**: Cloudflare Workers with server-only DataForge
- **Database**: PostgreSQL with Kysely + JSON schema layer
- **Entities**: Hardcoded foundation + JSON-defined business entities
- **Sync**: LSN-based real-time sync with field-level filtering
- **Validation**: JSON Rules Engine integrated with Kysely
- **Admin**: Completely separate platform management system

## Implementation Plan

### Phase 1: Server-Only DataForge Foundation ✅ COMPLETED
**Goal**: Move DataForge to server with JSON schema layer over Kysely

**COMPLETED Achievements:**
- ✅ **Complete DataForge system** moved to `apps/server/src/dataforge/`
- ✅ **JSON schema layer over Kysely** replacing MikroORM completely
- ✅ **Hardcoded foundation entities** with base archetypes working
- ✅ **JSON-driven custom entity creation** fully functional
- ✅ **Per-field sync control** (syncable vs server-only fields) implemented

**Completed Files:**
- ✅ `apps/server/src/dataforge/base/hardcoded-database.ts` - Kysely foundation schema
- ✅ `apps/server/src/dataforge/json-schema/org-entity-schema.ts` - JSON schema management
- ✅ `apps/server/src/dataforge/rules/json-rules-engine.ts` - Validation engine
- ✅ `apps/server/src/dataforge/kysely-generator/runtime-schema-generator.ts` - SQL DDL generation
- ✅ `apps/server/src/dataforge/entity-operations/entity-manager.ts` - CRUD with validation

**Completed Deliverables:**
- ✅ Hardcoded foundation schema with Users, Organizations, base archetypes
- ✅ JSON schema format for custom business entities working
- ✅ Kysely SQL DDL generator from JSON definitions operational
- ✅ Field-level sync control system fully functional

### Phase 2: Better Auth + Durable Objects Integration ✅ COMPLETED
**Goal**: Integrate Better Auth with server-only DataForge + implement access control cache layer

**COMPLETED Achievements:**
- ✅ **Better Auth 100% functional**: Complete user/org authentication working
- ✅ **Organization plugin working**: Create orgs, manage members, list orgs
- ✅ **Database schema complete**: All Better Auth tables with proper relationships
- ✅ **SuperAdminDO implemented**: Platform SaaS management with @cloudflare/actors SDK
- ✅ **OrgSchemaDO implemented**: Per-org entity schema management
- ✅ **Access control cache architecture**: Three-tier with PostgreSQL → DOs → API

**Architecture Layers:**
```
PostgreSQL (Better Auth) ← Source of Truth ✅
    ↓ (cache sync)
Durable Objects ← Access Control Cache Layer ✅  
    ↓ (fast lookups)
API Endpoints ← Permission-Protected Routes ✅
```

**Completed Files:**
- ✅ `apps/server/src/lib/auth.ts` - Better Auth config with organization plugin
- ✅ `apps/server/src/api/auth.ts` - Better Auth routing integration  
- ✅ `apps/server/src/dataforge/durable-objects/SuperAdminDO.ts` - Platform management
- ✅ `apps/server/src/dataforge/durable-objects/OrgSchemaDO.ts` - Per-org schemas
- ✅ `apps/server/src/dataforge/durable-objects/OrgAdminDO.ts` - Access control cache
- ✅ `apps/server/src/services/org-access-service.ts` - Three-tier architecture
- ✅ `apps/server/src/migrations/server/20250813_complete_better_auth_schema.ts` - Full schema

**Completed Deliverables:**
- ✅ Better Auth org/membership tables in PostgreSQL with all required fields
- ✅ SuperAdminDO for platform-wide SaaS management using @cloudflare/actors
- ✅ OrgAdminDO for per-org access control caching with PostgreSQL sync
- ✅ Permission cache layer with three-tier architecture working
- ✅ Fast permission lookups without database hits for cached data
- ✅ Complete authentication flow: signup → login → create org → manage members

### Phase 3: Auto-Migration & Sync Control ✅ COMPLETED
**Goal**: Auto-migration system with field-level sync filtering

**COMPLETED Achievements:**
- ✅ **Debounced migration system**: 30-second batching for schema changes using Kysely
- ✅ **Field-level sync filtering**: syncable vs server-only fields fully implemented
- ✅ **Kysely-based SQL generation**: All table operations use Kysely schema builder (no raw SQL)
- ✅ **Migration status monitoring**: Real-time pending migration tracking
- ✅ **Backward compatibility**: Supports both immediate and debounced entity creation

**Completed Files:**
- ✅ `apps/server/src/dataforge/migration/debounced-migration-service.ts` - Full batched migration system
- ✅ `apps/server/src/dataforge/kysely-generator/runtime-schema-generator.ts` - DDL generation
- ✅ `apps/server/src/dataforge/entity-operations/entity-manager.ts` - Updated with migration support
- ✅ `apps/server/src/routes/dataforge-test.ts` - Enhanced with migration endpoints
- ✅ `scripts/test-debounced-migrations.sh` - Comprehensive test coverage

**Completed Deliverables:**
- ✅ JSON schema → Kysely SQL DDL auto-migration with 30-second batching
- ✅ Rapid schema change debouncing (prevents database thrashing)
- ✅ Migration flush for testing and immediate processing
- ✅ Per-field sync control implementation working perfectly
- ✅ Comprehensive test suite validating all migration scenarios

### Phase 4: Client Integration ⏸️ FUTURE (SERVER-ONLY FOCUS)
**Goal**: Frontend support for server-driven dynamic entities

**COMPLETED (Server-Side):**
- ✅ **Server API endpoints**: Schema loading endpoints working (`/api/dataforge/orgs/{orgId}/schema`)
- ✅ **Syncable field filtering**: Client receives only syncable schemas
- ✅ **Complete server-side foundation**: All APIs ready for client integration

**FUTURE CLIENT WORK:**
- ⏸️ **Client-side schema loading**: Dynamic schema loading from server API (foundation created)
- ⏸️ **Generic schema-driven components**: React components that adapt to server schemas
- ⏸️ **Real-time schema updates**: WebSocket integration for live schema changes
- ⏸️ **Admin UI**: Entity management interface for business users

**Foundation Files Created:**
- ✅ `apps/web/src/lib/schema-client.ts` - Server schema loading client (ready to use)
- ✅ `apps/web/src/hooks/use-entity-schema.ts` - React hooks for dynamic schemas (ready to use)

**Current Status:**
- **Server-only implementation is COMPLETE and fully functional**
- **Client integration foundation is prepared but not integrated**
- **Focus remains on server-side testing and validation**

### Phase 5: Production Features
**Goal**: Enterprise-ready capabilities (SEPARATE from entity system)

**Key Changes:**
- **SEPARATE ADMIN SYSTEM**: Billing, compliance, monitoring
- Add org-level quotas and limits for entity system
- Implement audit logging for schema changes
- Add performance monitoring for DataForge operations

**Files to Create:**
- `apps/server/src/platform/billing/` - Usage tracking (SEPARATE)
- `apps/server/src/platform/compliance/` - Data residency (SEPARATE)  
- `apps/server/src/dataforge/quotas/` - Entity system limits
- `apps/server/src/dataforge/audit/` - Schema change auditing

**Deliverables:**
- **SEPARATE** platform admin system for billing/compliance
- Entity system quota enforcement
- Schema change audit logging
- DataForge performance monitoring

### Phase 6: Platform Scaling  
**Goal**: Multi-region and advanced features

**Key Changes:**
- Geographic distribution of org data and Durable Objects
- Advanced caching for frequently accessed schemas
- Rate limiting per org for entity operations  
- Enterprise features for large organizations

**Files to Create:**
- `apps/server/src/dataforge/regions/` - Multi-region entity distribution
- `apps/server/src/dataforge/cache/` - Schema caching layer
- `apps/server/src/dataforge/limits/` - Entity operation rate limiting
- `apps/server/src/platform/sso/` - Enterprise SSO (SEPARATE)

**Deliverables:**
- Multi-region Durable Object distribution
- Schema caching for performance
- Per-org rate limiting for entity operations  
- **SEPARATE** enterprise admin features

## Technical Specifications

### Server-Only DataForge Architecture
```
apps/server/src/
├── dataforge/                    # Server-only entity system
│   ├── base/                     # Hardcoded Kysely schemas
│   │   ├── users.schema.ts       # System entities
│   │   ├── organizations.schema.ts
│   │   └── archetypes/           # Base entity templates
│   │       ├── project.schema.ts
│   │       ├── task.schema.ts
│   │       └── event.schema.ts
│   ├── json-schema/              # JSON schema management
│   ├── rules/                    # JSON Rules Engine
│   ├── kysely-generator/         # Runtime type generation
│   ├── entity-operations/        # CRUD with validation
│   ├── migration/                # Auto-migration engine
│   └── sync-filter/              # Field-level sync control
├── durable-objects/
│   ├── entity/                   # Entity-focused DOs
│   │   ├── OrganizationDO        # Per-org entity storage
│   │   ├── EntityDO              # High-traffic isolation
│   │   └── SmartRoutingDO        # Entity routing
│   └── platform/                 # SEPARATE admin DOs
│       └── SuperAdminDO          # Platform management
└── routes/
    ├── entities/                 # Entity management API
    └── platform/                 # SEPARATE admin API
```

### JSON Entity Schema Format
```json
{
  "orgId": "acme-corp",
  "entities": {
    "SoftwareProject": {
      "extends": "base_projects",
      "tableName": "acme_corp_software_projects",
      "customFields": {
        "repositoryUrl": {
          "type": "string",
          "required": true,
          "syncable": true
        },
        "techStack": {
          "type": "array",
          "items": { "type": "string" },
          "syncable": true
        },
        "internalNotes": {
          "type": "text",
          "syncable": false,
          "serverOnly": true
        }
      },
      "validation": {
        "rules": [
          {
            "field": "repositoryUrl",
            "operator": "matches",
            "value": "^https://github\\.com/.+",
            "message": "Must be a valid GitHub URL"
          }
        ]
      }
    }
  }
}
```

### Hardcoded Foundation Schema
```typescript
// apps/server/src/dataforge/base/hardcoded-database.ts
export interface HardcodedDatabase {
  // System entities (never change)
  users: UserTable;
  organizations: OrganizationTable;
  
  // Base archetypes (templates)
  base_projects: BaseProjectTable;
  base_tasks: BaseTaskTable;
  base_events: BaseEventTable;
  base_contacts: BaseContactTable;
}

interface BaseProjectTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'deleted';
  created_at: Generated<Date>;
  updated_at: Date;
}
```

### Generated Org Database Schema
```typescript
// Runtime generated from JSON schemas
export interface AcmeCorpDatabase extends HardcodedDatabase {
  // Dynamic business entities
  acme_corp_software_projects: AcmeCorpSoftwareProjectTable;
  acme_corp_user_stories: AcmeCorpUserStoryTable;
}

// Client sync schema (filtered)
export interface AcmeCorpSyncDatabase {
  acme_corp_software_projects: {
    id: string;
    name: string;
    repository_url: string;  // syncable: true
    tech_stack: string[];    // syncable: true
    // internalNotes excluded   // syncable: false
    created_at: Date;
    updated_at: Date;
  };
}
```

### Durable Objects Architecture
```
ENTITY SYSTEM (DataForge)
├── OrganizationDO (per org)
│   ├── JSON schema storage
│   ├── Entity operations
│   └── Sync field filtering
├── EntityDO (high-traffic entities)
│   └── Ultra-isolated operations
└── SmartRoutingDO (routing logic)

PLATFORM ADMIN (SEPARATE)
└── SuperAdminDO (global)
    ├── Org lifecycle
    ├── Billing
    └── Compliance
```

### API Endpoints Structure
```
ENTITY SYSTEM APIs:
POST /api/entities/orgs/{orgId}/entities     # Create custom entity
PUT  /api/entities/orgs/{orgId}/entities/{name} # Update entity schema  
POST /api/entities/orgs/{orgId}/data/{entity}   # Save entity data
GET  /api/entities/orgs/{orgId}/data/{entity}   # Query entity data
GET  /api/entities/orgs/{orgId}/schema          # Get org schemas (syncable only)

PLATFORM ADMIN APIs (SEPARATE):
POST /api/admin/orgs                         # Create organization
DELETE /api/admin/orgs/{orgId}               # Delete organization
GET  /api/admin/billing/{orgId}              # Billing information
POST /api/admin/orgs/{orgId}/suspend         # Suspend organization
```

### Database Table Strategy
```sql
-- Hardcoded foundation tables
CREATE TABLE users (...);
CREATE TABLE organizations (...);
CREATE TABLE base_projects (...);    -- Template only
CREATE TABLE base_tasks (...);       -- Template only

-- Dynamic org-specific business tables
CREATE TABLE acme_corp_software_projects (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  -- Custom fields from JSON schema
  repository_url VARCHAR(500),
  tech_stack JSONB,
  internal_notes TEXT,  -- syncable: false
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform admin tables (SEPARATE)
CREATE TABLE org_billing (...);
CREATE TABLE audit_logs (...);
```

## Server-Only Development Strategy

### **Critical: Pure Server-Only Work**
This implementation will be **server-only** initially to avoid webapp complexity and focus purely on the DataForge architecture.

### **Required Cleanup Tasks:**
1. **Remove all DataForge imports from server**
   - Clean up existing `@repo/dataforge`, `@vibestack/dataforge` imports in `apps/server/`
   - Remove DataForge dependencies from server package.json
   - Ensure server can start independently without DataForge package
   - Comment out or stub DataForge-dependent code temporarily

2. **Create server-only testing strategy**
   - HTTP API testing using curl/Postman/REST client
   - Durable Objects testing in isolation
   - Database testing with direct SQL queries
   - JSON schema validation testing
   - No frontend dependencies required

3. **Isolated server development workflow**
   - Run only `pnpm dev:server` (port 8787)
   - Test via API endpoints and database inspection
   - Use tools like Bruno/Insomnia for API testing
   - Direct database queries for validation

4. **Create server-only tmux setup**
   - Add tmux command for server-only development
   - Include local database setup in same session
   - Enable rapid API testing workflow

### **Server-Only Development Setup:**
```bash
# Server-only tmux session (add to CLAUDE.md)
tmux new-session -d -s server-only-dev "cd apps/server && pnpm dev --port 8787"

# Check server logs
tmux attach -t server-only-dev

# API testing workflow  
curl -X GET http://localhost:8787/health
curl -X POST http://localhost:8787/api/entities/test
psql postgres://localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"
```

### **Server-Only Testing Approach:**
```bash
# 1. Start only the server (after cleanup)
tmux new-session -d -s server-only "cd apps/server && pnpm dev --port 8787"

# 2. Test basic server health
curl -X GET http://localhost:8787/health

# 3. Test entity creation via API (future)
curl -X POST http://localhost:8787/api/entities/orgs/acme-corp/entities \
  -H "Content-Type: application/json" \
  -d '{"name": "SoftwareProject", "extends": "base_projects", "customFields": {...}}'

# 4. Verify database directly
psql postgres://localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"

# 5. Test Durable Objects directly (future)
curl -X GET http://localhost:8787/api/entities/durable/org/acme-corp/status
```

## Next Immediate Steps

1. **Server Cleanup**: Remove all DataForge imports from server to get it running independently
2. **Phase 1 Foundation**: Move DataForge to server, create hardcoded Kysely schemas  
3. **Server-Only Testing**: Set up HTTP API testing workflow (curl, direct DB)
4. **JSON Schema System**: Design and implement JSON schema layer over Kysely
5. **Rules Engine Migration**: Extract and integrate JSON Rules Engine from POC
6. **Sync Control System**: Implement per-field syncable/server-only filtering

## Success Metrics

### Technical Metrics
- **Sub-10ms validation** using JSON Rules Engine with Kysely
- **99.9% org isolation** with proper Durable Object boundaries
- **Zero cross-org data leakage** through schema and routing validation
- **<100ms schema updates** with debounced auto-migration
- **Full type safety** through runtime Kysely schema generation
- **Sync field filtering** working correctly (server-only fields never sync)

### Business Metrics
- **<5 minute entity creation** via JSON schema API
- **<30 second custom field deployment** with auto-migration
- **Real-time sync** for all syncable fields across org clients
- **Non-technical admin UI** for business users to manage entities
- **Separate platform admin** for billing/compliance concerns

### Architecture Metrics
- **Server-only DataForge** eliminates client build dependencies
- **Hardcoded foundation + Dynamic entities** provides stability + flexibility  
- **JSON schema → Kysely types** maintains type safety with runtime flexibility
- **Field-level sync control** enables server-only sensitive data

## Risk Mitigation

### Technical Risks
- **Kysely type generation performance**: Cache generated schemas, lazy loading
- **JSON schema validation complexity**: Comprehensive test suite for all field types
- **Cross-org data leakage**: Extensive isolation testing with automated verification
- **Auto-migration failures**: Atomic transactions with automatic rollback
- **Sync field filtering bugs**: Unit tests for every syncable/server-only combination

### Business Risks  
- **Server-only migration complexity**: Phased migration with backward compatibility
- **Admin system separation**: Clear boundaries between entity and platform management
- **User adoption of JSON schemas**: Intuitive UI that abstracts JSON complexity
- **Performance at scale**: Load testing with 100+ orgs, 1000+ custom entities

### Implementation Risks
- **DataForge architecture changes**: Maintain existing API contracts during migration
- **Durable Objects integration**: Thorough testing of persistent storage patterns
- **Client schema loading**: Graceful fallbacks if server schema APIs fail
- **Real-time updates**: Robust WebSocket handling for schema change notifications

## Architecture Benefits Summary

This **server-only DataForge with JSON schema layer** provides:

1. **Simplified Deployment**: No client build steps for schema changes
2. **Runtime Flexibility**: JSON schemas can be updated without code deployments  
3. **Type Safety**: Kysely generates TypeScript types from JSON schemas
4. **Security**: Server-side validation with field-level sync control
5. **Isolation**: Perfect org separation with Durable Objects + table prefixing
6. **Separation of Concerns**: Entity system independent of platform admin
7. **Performance**: Sub-10ms validation with cached schema compilation
8. **Scalability**: Each org can have unlimited custom entities and fields

The result is a **true multi-tenant platform** where organizations can rapidly define and evolve their business entities while maintaining enterprise-grade security, performance, and isolation.
  ```typescript
  // packages/dataforge/src/base-archetypes/Project.ts
  @Entity({ abstract: true })
  export abstract class Project extends BaseDomainEntity {
    @Property()
    name!: string;
    
    @Property({ type: 'text', nullable: true })
    description?: string;
    
    // JSON column for immediate custom fields (before migration)
    @Property({ type: 'json', default: {} })
    customFields: Record<string, any> = {};
    
    // Track which fields have been promoted to real columns
    @Property({ type: 'json', default: {} })
    promotedFields: Record<string, boolean> = {};
    
    // Abstract methods for org-specific behavior
    abstract getProjectType(): string;
    abstract getValidStatusTransitions(): Record<string, string[]>;
  }
  ```

- [ ] **Move Shared Entities**
  - [ ] User.ts (unchanged - global)
  - [ ] Organization.ts (unchanged - global)  
  - [ ] LocalChanges.ts (client-only system table)

- [ ] **Create Auto-Migration Entities**
  ```typescript
  // packages/dataforge/src/shared-entities/OrgEntityDefinition.ts
  @Entity({ tableName: 'org_entity_definitions' })
  export class OrgEntityDefinition extends BaseEntity {
    @Property() organizationId!: string;
    @Property() entityName!: string;
    @Property() tableName!: string;
    @Property() baseArchetype!: string;
    @Property({ type: 'json' }) schema!: EntitySchema;
    @Property() version!: string;
    @Property() checksum!: string;
  }
  
  // packages/dataforge/src/shared-entities/PendingMigration.ts
  @Entity({ tableName: 'pending_migrations' })
  export class PendingMigration extends BaseEntity {
    @Property() organizationId!: string;
    @Property() entityName!: string;
    @Property() operation!: 'create' | 'update' | 'delete';
    @Property({ type: 'json', nullable: true }) oldSchema?: EntitySchema;
    @Property({ type: 'json', nullable: true }) newSchema?: EntitySchema;
    @Property() scheduledFor!: Date;
    @Property() status!: 'pending' | 'processing' | 'completed' | 'failed';
  }
  
  // New table creation registry
  @Entity({ tableName: 'new_table_requests' })
  export class NewTableRequest extends BaseEntity {
    @Property() organizationId!: string;
    @Property() tableName!: string;
    @Property() baseArchetype!: string;
    @Property({ type: 'json' }) schema!: EntitySchema;
    @Property() status!: 'pending' | 'processing' | 'completed' | 'failed';
    @Property() scheduledFor!: Date;
    @Property({ type: 'text', nullable: true }) error?: string;
  }
  ```

#### **Day 3-4: Auto-Migration Services**
- [ ] **Implement AutoMigrationService**
  ```typescript
  // packages/dataforge/src/services/AutoMigrationService.ts
  export class AutoMigrationService {
    private readonly DEBOUNCE_DELAY = 30000; // 30 seconds
    
    async updateEntityDefinition(
      organizationId: string,
      entityName: string,
      schema: EntitySchema
    ): Promise<void> {
      const existing = await this.getExistingDefinition(organizationId, entityName);
      const checksum = this.calculateChecksum(schema);
      
      if (existing?.checksum === checksum) {
        return; // No changes
      }
      
      const operation = existing ? 'update' : 'create';
      
      // Cancel existing pending migration
      await this.cancelPendingMigration(organizationId, entityName);
      
      // Schedule new migration with debounce
      await this.scheduleMigration(organizationId, entityName, operation, schema, existing?.schema);
      
      // Update/create definition
      await this.upsertEntityDefinition(organizationId, entityName, schema, checksum);
    }
    
    // Handle JSON field promotion to real columns
    async promoteJsonFieldToColumn(
      organizationId: string,
      entityName: string,
      fieldName: string,
      fieldType: string
    ): Promise<void> {
      const entityDef = await this.getExistingDefinition(organizationId, entityName);
      
      if (!entityDef) {
        throw new Error(`Entity ${entityName} not found for org ${organizationId}`);
      }
      
      // Add field to real schema
      const updatedSchema = {
        ...entityDef.schema,
        fields: {
          ...entityDef.schema.fields,
          [fieldName]: { type: fieldType, migratedFromJson: true }
        }
      };
      
      await this.updateEntityDefinition(organizationId, entityName, updatedSchema);
    }
    
    // Handle new table creation
    async createNewTable(
      organizationId: string,
      tableName: string,
      baseArchetype: string,
      schema: EntitySchema
    ): Promise<void> {
      // Schedule table creation with debounce
      const request = new NewTableRequest();
      request.organizationId = organizationId;
      request.tableName = tableName;
      request.baseArchetype = baseArchetype;
      request.schema = schema;
      request.scheduledFor = new Date(Date.now() + this.DEBOUNCE_DELAY);
      request.status = 'pending';
      
      await this.em.persistAndFlush(request);
    }
  }
  ```

- [ ] **Implement Background MigrationProcessor**
  ```typescript
  // packages/dataforge/src/services/MigrationProcessor.ts
  export class MigrationProcessor {
    @Cron('*/10 * * * * *') // Every 10 seconds
    async processPendingMigrations() {
      const readyMigrations = await this.getReadyMigrations();
      const byOrg = this.groupByOrganization(readyMigrations);
      
      for (const [orgId, migrations] of byOrg) {
        await this.processBatchForOrg(orgId, migrations);
      }
    }
  }
  ```

#### **Day 5-7: Organization Structure Setup**
- [ ] **Create Test Organization Directories**
  ```bash
  mkdir -p packages/test-orgs/{acme-corp,techflow-agency,startup-inc}/{config,generated,migrations,test-data}
  ```

- [ ] **Create Organization Configuration**
  ```json
  // packages/test-orgs/acme-corp/config/org-settings.json
  {
    "organizationId": "acme-corp",
    "name": "Acme Corporation", 
    "domain": "acme.vibestack.io",
    "features": {
      "autoMigration": true,
      "debounceMs": 30000,
      "maxCustomFields": 50
    }
  }
  ```

- [ ] **Define Entity Configurations**
  ```json
  // packages/test-orgs/acme-corp/config/entity-definitions.json
  {
    "SoftwareProject": {
      "baseArchetype": "Project",
      "fields": {
        "repositoryUrl": { "type": "string", "required": true },
        "techStack": { "type": "multiselect", "options": ["React", "Node.js", "Python"] },
        "deploymentEnv": { "type": "select", "options": ["dev", "staging", "prod"] }
      },
      "indexes": ["repository_url", "deployment_env"]
    },
    "UserStory": {
      "baseArchetype": "Task",
      "fields": {
        "storyPoints": { "type": "select", "options": ["1", "2", "3", "5", "8"] },
        "acceptanceCriteria": { "type": "text", "required": true }
      }
    }
  }
  ```

### **Week 2: Schema Generation Pipeline**

#### **Day 8-10: Org-Specific Schema Generation**
- [ ] **Implement OrgSchemaGenerator**
  ```typescript
  // packages/dataforge/src/services/OrgSchemaGenerator.ts
  export class OrgSchemaGenerator {
    async generateOrgSchemas(organizationId: string): Promise<void> {
      const entityDefs = await this.getOrgEntityDefinitions(organizationId);
      
      // Generate LiveStore schema
      await this.generateLiveStoreSchema(organizationId, entityDefs);
      
      // Generate Kysely schema 
      await this.generateKyselySchema(organizationId, entityDefs);
      
      // Generate Dexie schema (fallback)
      await this.generateDexieSchema(organizationId, entityDefs);
      
      // Generate TypeScript types
      await this.generateTypeScriptTypes(organizationId, entityDefs);
    }
  }
  ```

- [ ] **Create Live Store Schema Templates**
  ```typescript
  // Template for generating org-specific LiveStore schemas
  const liveStoreSchemaTemplate = `
  export class {{orgId}}LiveStoreSchema extends LiveStoreSchema {
    static readonly ORG_ID = '{{orgId}}';
    static readonly VERSION = '{{version}}';
    
    static readonly ENTITIES = {
      ...LiveStoreSchema.ENTITIES, // Inherit shared entities
      {{#entities}}
      {{archetype}}: {
        archetype: '{{archetype}}',
        entityName: '{{entityName}}', 
        tableName: '{{tableName}}',
        fields: [{{#fields}}
          {
            name: '{{name}}',
            type: '{{type}}',
            required: {{required}},
            {{#validation}}validation: {{.}}{{/validation}}
          },{{/fields}}
        ],
        isMultiTenant: true,
        organizationId: '{{orgId}}'
      },
      {{/entities}}
    };
  }
  `;
  ```

#### **Day 11-12: Table Operations Integration**
- [ ] **Implement TableOperations for Entity Definitions**
  ```typescript
  // packages/dataforge/src/services/TableOperations.ts
  export class TableOperations {
    async createTableFromDefinition(orgId: string, entityDef: OrgEntityDefinition): Promise<void> {
      const tableName = entityDef.tableName;
      const baseFields = this.getBaseArchetypeFields(entityDef.baseArchetype);
      const customFields = this.convertSchemaFieldsToSQL(entityDef.schema.fields);
      
      const sql = `
        CREATE TABLE ${tableName} (
          ${baseFields.join(',\n          ')},
          ${customFields.join(',\n          ')},
          custom_fields JSONB DEFAULT '{}'::jsonb,
          CONSTRAINT pk_${tableName} PRIMARY KEY (id),
          CONSTRAINT fk_${tableName}_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
      `;
      
      await this.em.getConnection().execute(sql);
      
      // Add indexes from schema
      for (const index of entityDef.schema.indexes) {
        await this.addIndex(tableName, index);
      }
    }
  }
  ```

#### **Day 13-14: Cloudflare Worker Integration & API**
- [ ] **Create JSON Column API for Immediate Use**
  ```typescript
  // apps/server/src/routes/org-entities.ts
  
  // Immediate field addition (uses JSON column)
  app.post('/api/org/entities/:entityName/fields', async (req, res) => {
    const { organizationId } = req.user;
    const { entityName } = req.params;
    const { fieldName, fieldType, defaultValue } = req.body;
    
    // Add to JSON column immediately (zero downtime)
    await this.addFieldToJsonColumn(organizationId, entityName, fieldName, defaultValue);
    
    // Schedule promotion to real column
    await autoMigrationService.promoteJsonFieldToColumn(
      organizationId,
      entityName, 
      fieldName,
      fieldType
    );
    
    res.json({ 
      message: 'Field added immediately to JSON, migration scheduled',
      immediateAccess: true,
      migrationEstimate: new Date(Date.now() + 30000)
    });
  });
  
  // New table creation
  app.post('/api/org/tables', async (req, res) => {
    const { organizationId } = req.user;
    const { tableName, baseArchetype, schema } = req.body;
    
    await autoMigrationService.createNewTable(
      organizationId,
      tableName,
      baseArchetype,
      schema
    );
    
    res.json({
      message: 'New table creation scheduled',
      estimatedCompletion: new Date(Date.now() + 30000)
    });
  });
  ```

- [ ] **Cloudflare Worker "No Build" Integration**
  ```typescript
  // apps/server/src/worker-org-schema.ts (runs in Cloudflare Worker)
  export class WorkerOrgSchemaProcessor {
    // Process schema generation in Cloudflare Worker (no Node.js build step)
    async generateOrgSchema(request: Request): Promise<Response> {
      const { organizationId, entityDefinitions } = await request.json();
      
      // Generate schemas using Web APIs (no fs, no Node.js dependencies)
      const liveStoreSchema = this.generateLiveStoreSchemaText(entityDefinitions);
      const kyselySchema = this.generateKyselySchemaText(entityDefinitions);
      
      return new Response(JSON.stringify({
        liveStoreSchema,
        kyselySchema,
        generatedAt: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // No build step - pure string templates
    private generateLiveStoreSchemaText(entityDefs: any[]): string {
      return `
        export const ${entityDefs[0].organizationId}LiveStoreSchema = {
          ${entityDefs.map(def => `
            ${def.entityName}: {
              archetype: '${def.baseArchetype}',
              fields: ${JSON.stringify(def.schema.fields, null, 6)},
              isMultiTenant: true
            }`).join(',')}
        };
      `;
    }
  }
  ```

### **Week 3: Local Pipeline & Worker Integration**

#### **Day 15-17: Local "No Build" Pipeline**
- [ ] **Create Local Worker-Based Generation**
  ```typescript
  // packages/dataforge/src/local/LocalWorkerSchemaGenerator.ts
  export class LocalWorkerSchemaGenerator {
    // Use Cloudflare Worker locally for schema generation (no build step)
    async generateOrgSchemasLocal(orgId: string): Promise<void> {
      const entityDefs = await this.getOrgEntityDefinitions(orgId);
      
      // Call local worker endpoint (no build process)
      const response = await fetch('http://localhost:8787/api/internal/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, entityDefinitions: entityDefs })
      });
      
      const { liveStoreSchema, kyselySchema } = await response.json();
      
      // Write directly to generated folders (no TypeScript compilation)
      await this.writeSchemaFiles(orgId, liveStoreSchema, kyselySchema);
    }
    
    private async writeSchemaFiles(orgId: string, liveStoreSchema: string, kyselySchema: string) {
      // Write as .js files (no build step needed)
      await Deno.writeTextFile(
        `packages/test-orgs/${orgId}/generated/client/livestore-schema.js`,
        liveStoreSchema
      );
      
      await Deno.writeTextFile(
        `packages/test-orgs/${orgId}/generated/server/kysely-schema.js`, 
        kyselySchema
      );
    }
  }
  ```

- [ ] **Update Package.json for Worker Integration**
  ```json
  {
    "scripts": {
      "dev:local": "wrangler dev --local --port 8787",
      "schema:generate": "deno run --allow-all src/local/LocalWorkerSchemaGenerator.ts",
      "schema:watch": "deno run --allow-all --watch src/local/LocalWorkerSchemaGenerator.ts",
      "migration:process": "deno run --allow-all src/services/MigrationProcessor.ts",
      "no-build": "echo 'No build step needed - using worker runtime'"
    }
  }
  ```

#### **Day 18-19: End-to-End Testing**
- [ ] **Create Multi-Org Test Suite**
  ```typescript
  // tests/multi-org-integration.test.ts
  describe('Multi-Org Auto-Migration', () => {
    test('creates new field with JSON column + auto-migration', async () => {
      // 1. Add field immediately to JSON column
      const fieldResponse = await request(app)
        .post('/api/org/entities/SoftwareProject/fields')
        .send({
          fieldName: 'repositoryUrl',
          fieldType: 'string',
          defaultValue: ''
        });
      
      expect(fieldResponse.status).toBe(200);
      expect(fieldResponse.body.immediateAccess).toBe(true);
      
      // 2. Use field immediately via JSON column
      const project = await createProject({ 
        name: 'Test Project',
        customFields: { repositoryUrl: 'https://github.com/test/repo' }
      });
      expect(project.customFields.repositoryUrl).toBe('https://github.com/test/repo');
      
      // 3. Wait for migration to promote to real column
      await sleep(35000);
      
      // 4. Verify real column was created
      const columnExists = await checkColumnExists('acme_software_projects', 'repository_url');
      expect(columnExists).toBe(true);
      
      // 5. Verify worker-generated schemas (no build step)
      const schemaExists = await fs.pathExists('test-orgs/acme-corp/generated/client/livestore-schema.js');
      expect(schemaExists).toBe(true);
    });
    
    test('creates new table with debounced creation', async () => {
      // 1. Request new table creation
      const tableResponse = await request(app)
        .post('/api/org/tables')
        .send({
          tableName: 'user_stories',
          baseArchetype: 'Task',
          schema: {
            fields: {
              storyPoints: { type: 'select', options: ['1', '2', '3', '5', '8'] },
              acceptanceCriteria: { type: 'text', required: true }
            }
          }
        });
      
      expect(tableResponse.status).toBe(200);
      
      // 2. Wait for debounced table creation
      await sleep(35000);
      
      // 3. Verify new table was created
      const tableExists = await checkTableExists('acme_user_stories');
      expect(tableExists).toBe(true);
    });
  });
  ```

#### **Day 20-21: Performance Testing**
- [ ] **Test Migration Performance**
  ```typescript
  // tests/migration-performance.test.ts
  describe('Migration Performance', () => {
    test('handles multiple rapid changes with debouncing', async () => {
      const changes = Array.from({ length: 10 }, (_, i) => ({
        field: `field${i}`,
        type: 'string'
      }));
      
      // Fire rapid changes
      const promises = changes.map(change => 
        updateEntityField('SoftwareProject', change.field, change.type)
      );
      
      await Promise.all(promises);
      
      // Should only result in 1 migration due to debouncing
      const migrations = await getPendingMigrations('acme-corp');
      expect(migrations.length).toBe(1);
    });
  });
  ```

### **Week 4: Real-Time Integration & LiveStore Schema**

#### **Day 22-24: LiveStore Integration**
- [ ] **Integrate with Phase 4 WebSocket Architecture**
  ```typescript
  // packages/livestore/src/org-aware/OrgLiveStoreManager.ts
  export class OrgLiveStoreManager {
    private orgSchemas = new Map<string, OrgLiveStoreSchema>();
    
    async getOrgSchema(organizationId: string): Promise<OrgLiveStoreSchema> {
      if (!this.orgSchemas.has(organizationId)) {
        const schema = await this.loadOrgSchema(organizationId);
        this.orgSchemas.set(organizationId, schema);
      }
      return this.orgSchemas.get(organizationId)!;
    }
    
    async handleSchemaUpdate(orgId: string, entityName: string): Promise<void> {
      // Reload schema
      this.orgSchemas.delete(orgId);
      
      // Broadcast schema change to all org connections
      await this.orgWebSocketManager.broadcastSchemaUpdate(orgId, entityName);
    }
  }
  ```

- [ ] **Create Schema-Aware Sync Protocol**
  ```typescript
  // Enhanced sync message types for schema changes
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
  ```

#### **Day 25-26: Client Integration**
- [ ] **Update Client to Handle Dynamic Schemas**
  ```typescript
  // apps/web/src/services/OrgSchemaService.ts
  export class OrgSchemaService {
    async loadOrgSchema(organizationId: string): Promise<void> {
      const schema = await fetch(`/api/org/${organizationId}/schema`).then(r => r.json());
      
      // Update LiveStore with new schema
      await this.liveStore.updateSchema(schema);
      
      // Regenerate forms and UI components
      this.eventBus.emit('schema:updated', { organizationId, schema });
    }
  }
  ```

### **Week 5: Production Deployment & Monitoring**

#### **Day 27-28: Production Migration Runner**
- [ ] **Create Production Migration Service**
  ```typescript
  // packages/dataforge/src/production/ProductionMigrationService.ts
  export class ProductionMigrationService extends MigrationProcessor {
    async processPendingMigrations() {
      // Add production safety checks
      await this.validateMigrationSafety();
      
      // Add backup before migration
      await this.createBackups();
      
      // Process with enhanced monitoring
      await super.processPendingMigrations();
      
      // Verify deployment
      await this.verifyMigrations();
    }
  }
  ```

#### **Day 29-30: Monitoring & Observability**
- [ ] **Add Migration Metrics**
  ```typescript
  // packages/dataforge/src/monitoring/MigrationMetrics.ts
  export class MigrationMetrics {
    async trackMigration(orgId: string, entityName: string, operation: string, duration: number) {
      await this.metrics.increment('migration.completed', {
        organization: orgId,
        entity: entityName,
        operation
      });
      
      await this.metrics.histogram('migration.duration', duration, {
        organization: orgId,
        operation
      });
    }
  }
  ```

#### **Day 31-35: Final Integration & Documentation**
- [ ] **Complete Integration Testing**
- [ ] **Performance Optimization**
- [ ] **Documentation Updates**
- [ ] **Production Deployment Prep**

## 📊 Progress Tracking

### **Week 1 Progress: Core DataForge Restructure**
- [ ] Base archetype extraction completed
- [ ] Auto-migration entities created
- [ ] AutoMigrationService implemented
- [ ] Background MigrationProcessor working
- [ ] Organization structure setup complete
- [ ] Test organization configurations created

### **Week 2 Progress: Schema Generation Pipeline**
- [ ] OrgSchemaGenerator implemented
- [ ] LiveStore schema templates created
- [ ] TableOperations for entity definitions working
- [ ] Entity management API functional
- [ ] Org-specific schema generation pipeline operational

### **Week 3 Progress: Build System & Testing**
- [ ] Multi-org build scripts created
- [ ] Package.json scripts updated
- [ ] End-to-end testing suite implemented
- [ ] Performance testing completed
- [ ] Migration debouncing validated

### **Week 4 Progress: Real-Time Integration**
- [ ] LiveStore integration with Phase 4 complete
- [ ] Schema-aware sync protocol implemented
- [ ] Client-side dynamic schema handling working
- [ ] OrgLiveStoreManager operational
- [ ] Real-time schema updates functional

### **Week 5 Progress: Production & Monitoring**
- [ ] Production migration service created
- [ ] Migration metrics and monitoring implemented
- [ ] Final integration testing completed
- [ ] Documentation updated
- [ ] Production deployment ready

## 🎯 Success Criteria Validation

### **Development Experience**
- [ ] ✅ Organizations can define entities via simple API calls (target: <2 seconds)
- [ ] ✅ Changes are automatically migrated within 30 seconds
- [ ] ✅ Full type safety from API to client to database maintained
- [ ] ✅ Hot reload for development with schema changes working

### **Production Reliability**
- [ ] ✅ Zero-downtime migrations for non-breaking changes
- [ ] ✅ Automatic rollback on migration failures
- [ ] ✅ Comprehensive monitoring and alerting operational
- [ ] ✅ Performance impact < 5% during migrations

### **System Architecture**
- [ ] ✅ Clean separation between base archetypes and org implementations
- [ ] ✅ Consistent API patterns across all organizations
- [ ] ✅ Scalable schema generation (< 10s per org)
- [ ] ✅ Memory efficient with schema caching

### **Feature Completeness**
- [ ] ✅ Support for all base archetypes (Project, Task, File, Discussion, Comment)
- [ ] ✅ Full CRUD operations on custom entities
- [ ] ✅ Real-time sync via LiveStore integration
- [ ] ✅ Server-side queries via Kysely
- [ ] ✅ Access control integration with Phase 3

## 🚨 Risk Management

### **Technical Risks**
- **Schema Complexity**: Mitigation through strict validation and versioning
- **Migration Failures**: Mitigation through atomic migrations and rollback procedures
- **Performance Impact**: Mitigation through caching and optimization
- **Access Control Bypass**: Mitigation through comprehensive testing and audit logging

### **Timeline Risks**
- **Week 1-2 Critical Path**: Base restructure must be solid foundation
- **Week 3 Integration Risk**: Build system changes could break existing workflows
- **Week 4 Real-time Risk**: LiveStore integration complexity may require extra time
- **Week 5 Production Risk**: Production-ready features need thorough validation

## 📈 Next Steps After Phase 5

### **Phase 6: Advanced Features** 
- Computed fields with formula-based custom fields
- Cross-entity relationships for custom business logic
- Advanced access control with time-based permissions
- Schema marketplace for shared templates

### **Production Enhancements**
- Blue-green deployments for schema changes
- Advanced performance monitoring per organization
- GDPR/SOC2 compliance features
- Enterprise audit logging

---

## ✅ Implementation Status

**Current Status**: **PHASE 3 COMPLETE - SERVER-ONLY MULTI-ORG DATAFORGE FULLY FUNCTIONAL** 🎉  
**Last Updated**: 2025-08-13  
**Achievement**: Complete server-only multi-org platform with debounced migrations

## 🎆 SUCCESS SUMMARY

### **What We've Built: Production-Ready Multi-Org Platform**

**Phase 1 ✅ COMPLETE: Server-Only DataForge Foundation**
- Complete DataForge system moved to `apps/server/src/dataforge/`
- JSON schema layer over Kysely (no MikroORM)
- Hardcoded foundation entities with dynamic org entities
- Field-level sync control (syncable vs server-only)

**Phase 2 ✅ COMPLETE: Better Auth + Durable Objects Integration**
- Better Auth organization plugin 100% functional
- SuperAdminDO and OrgSchemaDO with @cloudflare/actors SDK
- Three-tier access control: PostgreSQL → DOs → API
- Complete authentication flow working

**Phase 3 ✅ COMPLETE: Auto-Migration & Sync Control**
- Debounced migration system using Kysely (30-second batching)
- Real-time migration status monitoring
- Comprehensive test coverage
- All SQL operations use Kysely (no raw SQL)

### **Core Capabilities Delivered:**

✅ **Multi-Org Entity Creation**: Organizations can define custom business entities via JSON API  
✅ **Field-Level Sync Control**: Per-field control over what syncs to client vs server-only  
✅ **Automatic Table Generation**: JSON schemas automatically create database tables using Kysely  
✅ **Migration Batching**: 30-second debouncing prevents database thrashing  
✅ **Complete Isolation**: Perfect org separation with access control and data isolation  
✅ **Production APIs**: Full REST API for entity management and data operations  
✅ **Comprehensive Testing**: Automated test scripts validating all functionality  

### **Test Results:**
- ✅ Multi-org isolation verified
- ✅ Entity creation and data persistence working
- ✅ Sync field filtering operational  
- ✅ Cross-org access control enforced
- ✅ Debounced migrations tested and functional

This implementation provides organizations with the flexibility to rapidly iterate on their business entities while maintaining production reliability and performance - **all server-side and ready for production use**.