# Multi-Organization DataForge Restructure Plan

## Overview

This plan restructures the entire DataForge generation, migration, and build system to support multiple organizations with their own business entity extensions. Each organization defines business entities that extend base archetypes, generating both client-side (LiveStore) and server-side (Kysely) schemas.

## Current State Analysis

### Current DataForge Structure
```
packages/dataforge/
├── src/
│   ├── entities/           # Mixed base + concrete entities
│   ├── generated/          # Single schema output
│   ├── scripts/            # Generation scripts
│   └── migrations/         # Global migrations
├── dist/
└── package.json
```

### Current Generation Pipeline
1. Single MikroORM config for all entities
2. Single schema generation (Dexie, Kysely, etc.)
3. Global migrations
4. No org-specific business logic

## Target Architecture

### New Structure
```
packages/
├── dataforge/                    # Core archetype system
│   ├── src/
│   │   ├── base-archetypes/      # Abstract base classes
│   │   │   ├── Project.ts
│   │   │   ├── Task.ts
│   │   │   ├── File.ts
│   │   │   ├── Discussion.ts
│   │   │   └── Comment.ts
│   │   ├── shared-entities/      # Global entities
│   │   │   ├── User.ts
│   │   │   ├── Organization.ts
│   │   │   └── LocalChanges.ts   # Client-only system table
│   │   ├── services/             # Access control services
│   │   │   └── access-control/
│   │   ├── utils/                # Entity utilities
│   │   └── scripts/              # Core generation scripts
│   ├── generated/                # Shared schema outputs
│   │   ├── client/
│   │   │   ├── shared-livestore-schema.ts
│   │   │   └── shared-entities.ts
│   │   └── server/
│   │       ├── shared-kysely-schema.ts
│   │       └── shared-types.ts
│   └── migrations/
│       └── shared/               # Global/shared migrations
├── test-orgs/                    # Organization-specific implementations
│   ├── acme-corp/
│   │   ├── entities/             # Business entity extensions
│   │   │   ├── SoftwareProject.ts
│   │   │   ├── UserStory.ts
│   │   │   ├── CodeRepository.ts
│   │   │   └── TechnicalDiscussion.ts
│   │   ├── config/
│   │   │   ├── mikro-orm.config.ts
│   │   │   └── org-settings.json
│   │   ├── generated/            # Org-specific schemas
│   │   │   ├── client/
│   │   │   │   ├── acme-livestore-schema.ts
│   │   │   │   ├── acme-entities.ts
│   │   │   │   └── acme-dexie-schema.ts
│   │   │   └── server/
│   │   │       ├── acme-kysely-schema.ts
│   │   │       ├── acme-types.ts
│   │   │       └── acme-drizzle-schema.ts
│   │   ├── migrations/           # Org-specific migrations
│   │   │   ├── server/
│   │   │   └── client/
│   │   ├── test-data/            # Org-specific test data
│   │   │   ├── software-projects.json
│   │   │   ├── user-stories.json
│   │   │   └── code-repos.json
│   │   └── package.json          # Org-specific dependencies
│   ├── techflow-agency/
│   │   ├── entities/
│   │   │   ├── MarketingCampaign.ts
│   │   │   ├── ClientTask.ts
│   │   │   ├── CreativeAsset.ts
│   │   │   └── ClientFeedback.ts
│   │   ├── config/
│   │   ├── generated/
│   │   ├── migrations/
│   │   ├── test-data/
│   │   └── package.json
│   └── startup-inc/
│       └── ... # Similar structure
└── server/                       # Updated server integration
    ├── src/
    │   ├── org-configs/          # Organization configurations
    │   │   ├── acme-corp.ts
    │   │   ├── techflow-agency.ts
    │   │   └── startup-inc.ts
    │   └── routes/
    │       └── org-aware/        # Organization-aware routing
    └── migrations/
        └── per-org/              # Per-org migration tracking
```

## Implementation Phases

### Phase 1: Core Restructure (Week 1-2)

#### 1.1 DataForge Core Separation
- [ ] **Extract Base Archetypes**
  - [ ] Move abstract classes to `src/base-archetypes/`
  - [ ] Ensure proper inheritance and type safety
  - [ ] Add archetype registration system
  - [ ] Update import paths throughout codebase

- [ ] **Separate Shared Entities**
  - [ ] Move global entities (User, Organization, etc.) to `src/shared-entities/`
  - [ ] Keep client-only system tables (LocalChanges) in shared
  - [ ] Update entity relationships and imports

- [ ] **Update Access Control Services**
  - [ ] Modify services to work with base archetypes
  - [ ] Add org-aware permission checking
  - [ ] Ensure type safety with generic archetype handling

#### 1.2 Organization Structure Setup
- [ ] **Create Test Organizations**
  - [ ] Set up `packages/test-orgs/` structure
  - [ ] Create sample organizations (acme-corp, techflow-agency, startup-inc)
  - [ ] Define business entity extensions for each org
  - [ ] Add org-specific configuration files

- [ ] **Organization Configuration System**
  - [ ] Create org settings schema
  - [ ] Add MikroORM config per organization
  - [ ] Define entity discovery patterns
  - [ ] Add validation for org-specific entities

### Phase 2: Generation Pipeline Overhaul (Week 2-3)

#### 2.1 Multi-Org Generation Scripts
- [ ] **Update Core Generation Scripts**
  - [ ] Modify `generate-entities.ts` for multi-org support
  - [ ] Update `generate-dexie-schema.ts` for org-specific schemas
  - [ ] Create `generate-org-schemas.ts` orchestrator script
  - [ ] Add org-specific LiveStore schema generation

- [ ] **Kysely Schema Generation**
  - [ ] Create `generate-kysely-org-schema.ts`
  - [ ] Support org-specific database schemas
  - [ ] Handle shared vs org-specific tables
  - [ ] Generate type-safe Kysely types per org

- [ ] **LiveStore Schema Generation**
  - [ ] Adapt existing LiveStore generator for multi-org
  - [ ] Generate org-specific client schemas
  - [ ] Handle archetype inheritance in schemas
  - [ ] Add multi-tenant validation rules

#### 2.2 Build System Integration
- [ ] **Package.json Scripts**
  - [ ] Add org-specific build commands
  - [ ] Create `build:all-orgs` orchestrator
  - [ ] Add validation and testing scripts
  - [ ] Support selective org building

- [ ] **Generation Orchestration**
  - [ ] Create `scripts/build-all-orgs.ts`
  - [ ] Add parallel/sequential generation options
  - [ ] Include validation and error handling
  - [ ] Add progress reporting and logging

### Phase 3: Migration System Overhaul (Week 3-4)

#### 3.1 Multi-Org Migration Framework
- [ ] **Shared Migration System**
  - [ ] Keep global migrations for shared entities
  - [ ] Add org-aware migration tracking
  - [ ] Support cross-org migration dependencies
  - [ ] Handle migration rollbacks safely

- [ ] **Org-Specific Migrations**
  - [ ] Generate migrations per organization
  - [ ] Track migration state per org
  - [ ] Support org-specific schema changes
  - [ ] Add migration validation tools

#### 3.2 Migration Tooling
- [ ] **Migration Generation**
  - [ ] Create `generate-org-migration.ts`
  - [ ] Support entity schema changes
  - [ ] Generate both server and client migrations
  - [ ] Add migration validation and testing

- [ ] **Migration Execution**
  - [ ] Update migration runner for multi-org
  - [ ] Add org-specific migration application
  - [ ] Support selective org migrations
  - [ ] Add migration status reporting

### Phase 4: Testing & Validation (Week 4-5)

#### 4.1 Multi-Org Testing Framework
- [ ] **Test Data Management**
  - [ ] Create org-specific test data sets
  - [ ] Add test data generation tools
  - [ ] Support cross-org isolation testing
  - [ ] Add data validation utilities

- [ ] **Integration Testing**
  - [ ] Test schema generation for all orgs
  - [ ] Validate migration consistency
  - [ ] Test access control isolation
  - [ ] Add performance testing for multi-org

#### 4.2 Validation Tools
- [ ] **Schema Validation**
  - [ ] Validate org-specific schemas
  - [ ] Check archetype inheritance
  - [ ] Verify multi-tenant isolation
  - [ ] Add schema compatibility checks

- [ ] **End-to-End Testing**
  - [ ] Test complete generation pipeline
  - [ ] Validate client-server schema sync
  - [ ] Test real-time LiveStore integration
  - [ ] Add performance benchmarks

### Phase 5: Documentation & Tooling (Week 5-6)

#### 5.1 Developer Experience
- [ ] **CLI Tools**
  - [ ] Create `create-org` command
  - [ ] Add `generate-org-schemas` CLI
  - [ ] Create `migrate-org` command
  - [ ] Add validation and testing CLIs

- [ ] **Development Workflow**
  - [ ] Update development documentation
  - [ ] Create org setup guides
  - [ ] Add troubleshooting guides
  - [ ] Create best practices documentation

#### 5.2 Monitoring & Debugging
- [ ] **Schema Diff Tools**
  - [ ] Compare schemas across orgs
  - [ ] Detect schema drift
  - [ ] Validate migration consistency
  - [ ] Add schema visualization tools

- [ ] **Development Tools**
  - [ ] Add schema introspection
  - [ ] Create entity relationship visualization
  - [ ] Add performance profiling
  - [ ] Create debugging utilities

## Technical Considerations

### Entity Inheritance Pattern
```typescript
// Base archetype (in dataforge/src/base-archetypes/)
@Entity({ abstract: true })
export abstract class Project extends BaseDomainEntity {
  @Property()
  name!: string;
  
  @Property({ type: 'text', nullable: true })
  description?: string;
  
  // Abstract methods that orgs must implement
  abstract getProjectType(): string;
  abstract getBusinessRules(): ProjectRule[];
}

// Org-specific implementation (in test-orgs/acme-corp/entities/)
@Entity({ tableName: 'acme_software_projects' })
export class SoftwareProject extends Project {
  @Property()
  repositoryUrl!: string;
  
  @Property()
  techStack!: string[];
  
  @Property()
  deploymentEnvironment!: string;
  
  getProjectType(): string {
    return 'software_development';
  }
  
  getBusinessRules(): ProjectRule[] {
    return [
      new CodeQualityRule(),
      new SecurityComplianceRule(),
      new TechnicalDebtRule()
    ];
  }
}
```

### Schema Generation Coordination
```typescript
// Generate schemas for all organizations
async function generateAllOrgSchemas() {
  const orgs = await discoverOrganizations();
  
  for (const org of orgs) {
    console.log(`Generating schemas for ${org.name}...`);
    
    // Generate client-side schemas
    await generateLiveStoreSchema(org);
    await generateDexieSchema(org);
    
    // Generate server-side schemas
    await generateKyselySchema(org);
    await generateDrizzleSchema(org);
    
    // Generate migrations
    await generateOrgMigrations(org);
    
    console.log(`✅ ${org.name} schemas generated`);
  }
}
```

### Migration Coordination
```typescript
// Handle migrations across shared and org-specific schemas
class MultiOrgMigrationRunner {
  async runMigrations(targetOrg?: string) {
    // Run shared migrations first
    await this.runSharedMigrations();
    
    // Run org-specific migrations
    if (targetOrg) {
      await this.runOrgMigrations(targetOrg);
    } else {
      const orgs = await this.discoverOrganizations();
      for (const org of orgs) {
        await this.runOrgMigrations(org.id);
      }
    }
  }
}
```

## Success Criteria

### Development Experience
- [ ] Developers can easily create new organizations
- [ ] Schema generation works seamlessly for all orgs
- [ ] Clear separation between shared and org-specific code
- [ ] Fast iteration on org-specific business logic

### System Architecture
- [ ] Proper multi-tenant isolation
- [ ] Type safety across all generated schemas
- [ ] Consistent API patterns across organizations
- [ ] Scalable schema generation pipeline

### Testing & Validation
- [ ] Comprehensive test coverage for multi-org scenarios
- [ ] Automated validation of schema consistency
- [ ] Performance testing with multiple organizations
- [ ] Clear debugging and troubleshooting tools

### Production Readiness
- [ ] Migration system handles org-specific changes safely
- [ ] Schema versioning and compatibility management
- [ ] Monitoring and observability for multi-org systems
- [ ] Documentation for operational procedures

## Migration Strategy

### From Current to Target
1. **Gradual migration** - Keep current system working while building new structure
2. **Parallel development** - Test new multi-org approach alongside existing system
3. **Validation phase** - Ensure feature parity before switching over
4. **Cutover** - Replace current system with new multi-org architecture

### Risk Mitigation
- [ ] Maintain backward compatibility during transition
- [ ] Create rollback procedures for each phase
- [ ] Add comprehensive testing at each stage
- [ ] Document all changes and migration steps

This plan provides a comprehensive roadmap for restructuring DataForge to support multiple organizations with their own business entity extensions while maintaining the core archetype system and generating both client and server schemas.