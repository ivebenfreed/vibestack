# Unified Multi-Org DataForge Implementation Plan

## Overview

This plan combines the multi-org DataForge restructure with the auto-migration system to create a complete solution for organizations to define custom business entities that automatically generate real database tables, client schemas, and server schemas with seamless background migrations.

## 🏗️ Target Architecture

### **Package Structure**
```
packages/
├── dataforge/                           # Core archetype system
│   ├── src/
│   │   ├── base-archetypes/             # Abstract base classes
│   │   │   ├── Project.ts               # Base project archetype
│   │   │   ├── Task.ts                  # Base task archetype
│   │   │   ├── File.ts                  # Base file archetype
│   │   │   ├── Discussion.ts            # Base discussion archetype
│   │   │   └── Comment.ts               # Base comment archetype
│   │   ├── shared-entities/             # Global entities
│   │   │   ├── User.ts                  # Global shared entity
│   │   │   ├── Organization.ts          # Global shared entity
│   │   │   ├── LocalChanges.ts          # Client-only system table
│   │   │   ├── OrgEntityDefinition.ts   # NEW: Org entity registry
│   │   │   └── PendingMigration.ts      # NEW: Migration queue
│   │   ├── services/                    # Core services
│   │   │   ├── access-control/          # Base access control
│   │   │   ├── AutoMigrationService.ts  # NEW: Auto-migration
│   │   │   ├── MigrationProcessor.ts    # NEW: Background processor
│   │   │   ├── TableOperations.ts       # NEW: Table management
│   │   │   └── OrgSchemaGenerator.ts    # NEW: Org schema generation
│   │   ├── utils/                       # Entity utilities
│   │   │   ├── entity-context.ts        # Client/server filtering
│   │   │   └── org-resolver.ts          # NEW: Org entity resolution
│   │   └── scripts/                     # Generation scripts
│   │       ├── generate-base-schemas.ts # Base schema generation
│   │       └── build-all-orgs.ts        # NEW: Multi-org build
│   ├── generated/                       # Base schema outputs
│   │   ├── client/
│   │   │   ├── base-livestore-schema.ts
│   │   │   └── shared-entities.ts
│   │   └── server/
│   │       ├── base-kysely-schema.ts
│   │       └── shared-types.ts
│   └── migrations/
│       └── shared/                      # Global/shared migrations
├── test-orgs/                          # Organization implementations
│   ├── acme-corp/
│   │   ├── config/
│   │   │   ├── org-settings.json       # Organization configuration
│   │   │   └── entity-definitions.json # Entity definitions (JSON API)
│   │   ├── generated/                  # Auto-generated artifacts
│   │   │   ├── client/
│   │   │   │   ├── acme-livestore-schema.ts
│   │   │   │   ├── acme-entities.ts
│   │   │   │   └── acme-dexie-schema.ts
│   │   │   └── server/
│   │   │       ├── acme-kysely-schema.ts
│   │   │       ├── acme-types.ts
│   │   │       └── acme-drizzle-schema.ts
│   │   ├── migrations/                 # Auto-generated migrations
│   │   │   ├── 001_create_software_projects.ts
│   │   │   ├── 002_add_tech_stack_field.ts
│   │   │   └── 003_add_user_stories.ts
│   │   └── test-data/                  # Org-specific test data
│   │       ├── software-projects.json
│   │       └── user-stories.json
│   ├── techflow-agency/
│   │   └── ... # Similar structure
│   └── startup-inc/
│       └── ... # Similar structure
└── server/                            # Updated server integration
    ├── src/
    │   ├── routes/
    │   │   ├── org-entities.ts         # NEW: Entity management API
    │   │   └── org-aware/              # Organization-aware routing
    │   ├── services/
    │   │   ├── OrgEntityManager.ts     # NEW: Entity CRUD operations
    │   │   └── DynamicEntityResolver.ts # NEW: Runtime entity resolution
    │   └── middleware/
    │       └── org-schema-loader.ts    # NEW: Load org schemas
    └── migrations/
        └── per-org/                    # Auto-generated org migrations
```

## 📋 Implementation Phases

### **Phase 1: Core DataForge Restructure (Week 1)**

#### 1.1 Base Archetype Extraction
- [ ] **Extract Base Archetypes**
  ```typescript
  // dataforge/src/base-archetypes/Project.ts
  @Entity({ abstract: true })
  export abstract class Project extends BaseDomainEntity {
    @Property()
    name!: string;
    
    @Property({ type: 'text', nullable: true })
    description?: string;
    
    // JSON column for dynamic fields (immediate use)
    @Property({ type: 'json', default: {} })
    customFields: Record<string, any> = {};
    
    // Abstract methods for org-specific behavior
    abstract getProjectType(): string;
    abstract getValidStatusTransitions(): Record<string, string[]>;
  }
  ```

- [ ] **Separate Shared Entities**
  ```typescript
  // dataforge/src/shared-entities/User.ts (unchanged)
  @Entity()
  export class User extends BaseEntity {
    @Property()
    name!: string;
    
    @Property()
    email!: string;
    // ... remains global
  }
  ```

- [ ] **Add Auto-Migration Entities**
  ```typescript
  // dataforge/src/shared-entities/OrgEntityDefinition.ts
  @Entity({ tableName: 'org_entity_definitions' })
  export class OrgEntityDefinition extends BaseEntity {
    @Property()
    organizationId!: string;
    
    @Property()
    entityName!: string;
    
    @Property()
    tableName!: string;
    
    @Property()
    baseArchetype!: string;
    
    @Property({ type: 'json' })
    schema!: EntitySchema;
    
    @Property()
    version!: string;
    
    @Property()
    checksum!: string;
  }
  
  // dataforge/src/shared-entities/PendingMigration.ts
  @Entity({ tableName: 'pending_migrations' })
  export class PendingMigration extends BaseEntity {
    @Property()
    organizationId!: string;
    
    @Property()
    entityName!: string;
    
    @Property()
    operation!: 'create' | 'update' | 'delete';
    
    @Property({ type: 'json', nullable: true })
    oldSchema?: EntitySchema;
    
    @Property({ type: 'json', nullable: true })
    newSchema?: EntitySchema;
    
    @Property()
    scheduledFor!: Date;
    
    @Property()
    status!: 'pending' | 'processing' | 'completed' | 'failed';
  }
  ```

#### 1.2 Auto-Migration Services
- [ ] **AutoMigrationService**
  ```typescript
  // dataforge/src/services/AutoMigrationService.ts
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
  }
  ```

- [ ] **MigrationProcessor (Background)**
  ```typescript
  // dataforge/src/services/MigrationProcessor.ts
  export class MigrationProcessor {
    @Cron('*/10 * * * * *') // Every 10 seconds
    async processPendingMigrations() {
      const readyMigrations = await this.getReadyMigrations();
      const byOrg = this.groupByOrganization(readyMigrations);
      
      for (const [orgId, migrations] of byOrg) {
        await this.processBatchForOrg(orgId, migrations);
      }
    }
    
    private async processBatchForOrg(orgId: string, migrations: PendingMigration[]) {
      for (const migration of migrations) {
        try {
          await this.executeMigration(migration);
          await this.markCompleted(migration);
        } catch (error) {
          await this.markFailed(migration, error);
        }
      }
      
      // Regenerate all schemas for this org
      await this.regenerateOrgSchemas(orgId);
    }
  }
  ```

### **Phase 2: Organization Structure Setup (Week 1-2)**

#### 2.1 Test Organization Structure
- [ ] **Create Test Organizations**
  ```bash
  mkdir -p packages/test-orgs/{acme-corp,techflow-agency,startup-inc}/{config,generated,migrations,test-data}
  ```

- [ ] **Organization Configuration**
  ```json
  // test-orgs/acme-corp/config/org-settings.json
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
  
  // test-orgs/acme-corp/config/entity-definitions.json
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

#### 2.2 API Integration
- [ ] **Entity Management API**
  ```typescript
  // server/src/routes/org-entities.ts
  app.put('/api/org/entities/:entityName', async (req, res) => {
    const { organizationId } = req.user;
    const { entityName } = req.params;
    const { baseArchetype, fields, indexes } = req.body;
    
    const schema: EntitySchema = {
      baseArchetype,
      fields,
      indexes: indexes || []
    };
    
    await autoMigrationService.updateEntityDefinition(
      organizationId,
      entityName,
      schema
    );
    
    res.json({ 
      message: 'Entity definition updated',
      estimatedMigration: new Date(Date.now() + 30000)
    });
  });
  
  app.delete('/api/org/entities/:entityName', async (req, res) => {
    await autoMigrationService.deleteEntityDefinition(
      req.user.organizationId,
      req.params.entityName
    );
    
    res.json({ message: 'Entity deletion scheduled' });
  });
  ```

### **Phase 3: Schema Generation Pipeline (Week 2)**

#### 3.1 Org-Specific Schema Generation
- [ ] **OrgSchemaGenerator**
  ```typescript
  // dataforge/src/services/OrgSchemaGenerator.ts
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
    
    private async generateLiveStoreSchema(orgId: string, entityDefs: OrgEntityDefinition[]) {
      const schema = {
        version: this.getOrgSchemaVersion(orgId),
        organizationId: orgId,
        entities: this.convertToLiveStoreEntities(entityDefs)
      };
      
      const schemaCode = this.renderLiveStoreSchema(schema);
      await this.writeOrgFile(orgId, 'client/livestore-schema.ts', schemaCode);
    }
  }
  ```

#### 3.2 Table Operations Integration
- [ ] **TableOperations with Entity Definitions**
  ```typescript
  // dataforge/src/services/TableOperations.ts
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
      
      console.log(`✅ Created table ${tableName} for org ${orgId}`);
    }
    
    async updateTableFromDefinition(orgId: string, entityDef: OrgEntityDefinition, oldSchema: EntitySchema): Promise<void> {
      const changes = this.compareSchemas(oldSchema, entityDef.schema);
      
      for (const change of changes) {
        await this.applySchemaChange(entityDef.tableName, change);
      }
      
      console.log(`✅ Updated table ${entityDef.tableName} with ${changes.length} changes`);
    }
  }
  ```

### **Phase 4: Build System Integration (Week 2-3)**

#### 4.1 Multi-Org Build Scripts
- [ ] **Build All Organizations**
  ```typescript
  // dataforge/src/scripts/build-all-orgs.ts
  export async function buildAllOrgs(): Promise<void> {
    const orgs = await discoverOrganizations();
    
    console.log(`🏗️ Building schemas for ${orgs.length} organizations...`);
    
    // Build base schemas first
    await generateBaseSchemas();
    
    // Build org-specific schemas in parallel
    await Promise.all(orgs.map(async (org) => {
      try {
        await buildOrgSchemas(org.id);
        console.log(`✅ Built schemas for ${org.name}`);
      } catch (error) {
        console.error(`❌ Failed to build ${org.name}:`, error);
      }
    }));
    
    console.log('🎉 All organization schemas built successfully');
  }
  
  async function buildOrgSchemas(orgId: string): Promise<void> {
    const generator = new OrgSchemaGenerator();
    await generator.generateOrgSchemas(orgId);
  }
  ```

- [ ] **Package.json Integration**
  ```json
  {
    "scripts": {
      "build": "npm run build:base && npm run build:orgs",
      "build:base": "tsx src/scripts/generate-base-schemas.ts",
      "build:orgs": "tsx src/scripts/build-all-orgs.ts",
      "build:org": "tsx src/scripts/build-org.ts",
      "dev:watch": "concurrently \"npm run build:base -- --watch\" \"npm run build:orgs -- --watch\"",
      "migration:process": "tsx src/services/MigrationProcessor.ts"
    }
  }
  ```

### **Phase 5: Testing & Integration (Week 3)**

#### 5.1 End-to-End Testing
- [ ] **Multi-Org Test Suite**
  ```typescript
  // tests/multi-org-integration.test.ts
  describe('Multi-Org Auto-Migration', () => {
    test('creates new entity with auto-migration', async () => {
      // 1. Define new entity via API
      const response = await request(app)
        .put('/api/org/entities/SoftwareProject')
        .send({
          baseArchetype: 'Project',
          fields: {
            repositoryUrl: { type: 'string', required: true }
          }
        });
      
      expect(response.status).toBe(200);
      
      // 2. Wait for debounced migration
      await sleep(35000);
      
      // 3. Verify table was created
      const tableExists = await checkTableExists('acme_software_projects');
      expect(tableExists).toBe(true);
      
      // 4. Verify schemas were generated
      const schemaExists = await fs.pathExists('test-orgs/acme-corp/generated/client/livestore-schema.ts');
      expect(schemaExists).toBe(true);
      
      // 5. Test entity CRUD operations
      const project = await createEntity('SoftwareProject', {
        name: 'Test Project',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      expect(project.repositoryUrl).toBe('https://github.com/test/repo');
    });
    
    test('updates entity with field changes', async () => {
      // Test schema evolution...
    });
    
    test('deletes entity and cleans up table', async () => {
      // Test entity deletion...
    });
  });
  ```

#### 5.2 Performance Testing
- [ ] **Migration Performance**
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

### **Phase 6: Production Deployment (Week 3-4)**

#### 6.1 Production Migration Runner
- [ ] **Production Service**
  ```typescript
  // production-migration-service.ts
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
    
    private async validateMigrationSafety() {
      // Check for breaking changes
      // Validate data integrity
      // Estimate downtime
    }
  }
  ```

#### 6.2 Monitoring & Observability
- [ ] **Migration Metrics**
  ```typescript
  // monitoring/migration-metrics.ts
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
    
    async trackSchemaGeneration(orgId: string, type: 'client' | 'server', duration: number) {
      await this.metrics.histogram('schema.generation.duration', duration, {
        organization: orgId,
        type
      });
    }
  }
  ```

## 🎯 Success Criteria

### **Development Experience**
- [ ] Organizations can define entities via simple API calls
- [ ] Changes are automatically migrated within 30 seconds
- [ ] Full type safety from API to client to database
- [ ] Hot reload for development with schema changes

### **Production Reliability**
- [ ] Zero-downtime migrations for non-breaking changes
- [ ] Automatic rollback on migration failures
- [ ] Comprehensive monitoring and alerting
- [ ] Performance impact < 5% during migrations

### **System Architecture**
- [ ] Clean separation between base archetypes and org implementations
- [ ] Consistent API patterns across all organizations
- [ ] Scalable schema generation (< 10s per org)
- [ ] Memory efficient with schema caching

### **Feature Completeness**
- [ ] Support for all base archetypes (Project, Task, File, Discussion, Comment)
- [ ] Full CRUD operations on custom entities
- [ ] Real-time sync via LiveStore
- [ ] Server-side queries via Kysely
- [ ] Access control integration

## 📅 Timeline Summary

**Week 1**: Core restructure + auto-migration foundation
**Week 2**: Schema generation pipeline + API integration  
**Week 3**: Testing + production deployment prep
**Week 4**: Production deployment + monitoring

## 🚀 Immediate Benefits

### **For Organizations**
- ✅ **Self-service entity definition** via API
- ✅ **30-second change deployment** with debouncing
- ✅ **No downtime** for schema changes
- ✅ **Immediate fallback** with customFields JSON

### **For Developers**
- ✅ **Full type safety** throughout the stack
- ✅ **Hot reload** with schema changes in development
- ✅ **Standard patterns** - everything works like normal MikroORM/LiveStore
- ✅ **Zero configuration** - everything auto-generated

### **For Production**
- ✅ **Automatic scaling** - new orgs get isolated schemas
- ✅ **Performance optimization** - real columns for common fields
- ✅ **Safe migrations** - comprehensive validation and rollback
- ✅ **Monitoring** - full observability of schema changes

This unified plan provides a complete solution for multi-org DataForge with automatic migrations, giving organizations the flexibility to rapidly iterate on their business entities while maintaining production reliability and performance.