# Production Multi-Org Deployment & JSON-to-Migration Architecture

## Overview

This plan outlines how the multi-org DataForge system works in production with hosted packages, seamless background migrations, and the JSON-to-migration structure for custom business entity extensions.

## 🏗️ Production Architecture

### **Hosted Package Structure**
```
@vibestack/dataforge-core               # Base archetypes + shared entities
├── base-archetypes/                    # Project, Task, File, Discussion
├── shared-entities/                    # User, Organization, LocalChanges
├── access-control/                     # Base access control services
└── migration-tools/                    # Core migration utilities

@vibestack/dataforge-generator          # Schema generation service
├── json-to-entity/                     # JSON config → TypeScript entities
├── entity-to-schema/                   # Entities → DB migrations
├── client-schema-gen/                  # LiveStore schema generation
└── server-schema-gen/                  # Kysely schema generation

@vibestack/dataforge-runtime            # Production runtime
├── org-resolver/                       # Organization routing
├── schema-loader/                      # Dynamic schema loading
├── migration-runner/                   # Background migrations
└── validation/                         # Runtime schema validation
```

### **Organization Configuration Service**
```
vibestack-config-service (hosted)
├── /org/{orgId}/schema.json            # Business entity configuration
├── /org/{orgId}/generated/             # Generated artifacts
│   ├── entities.ts                     # TypeScript entities
│   ├── migrations/                     # Database migrations
│   ├── client-schema.ts                # LiveStore schema
│   └── server-schema.ts                # Kysely schema
└── /org/{orgId}/versions/              # Schema version history
    ├── v1.json
    ├── v2.json
    └── current.json
```

## 🔄 JSON-to-Migration Flow

### **1. Organization Schema Configuration**
Organizations define their business entities via JSON configuration:

```json
// /org/acme-corp/schema.json
{
  "version": "2.1.0",
  "organization": {
    "id": "acme-corp",
    "name": "Acme Corporation",
    "domain": "acme.vibestack.io"
  },
  "entities": {
    "SoftwareProject": {
      "extends": "Project",
      "tableName": "acme_software_projects", 
      "fields": {
        "repositoryUrl": {
          "type": "url",
          "required": true,
          "description": "Git repository URL"
        },
        "techStack": {
          "type": "multiselect",
          "options": ["React", "Node.js", "PostgreSQL", "TypeScript"],
          "description": "Technology stack"
        },
        "deploymentEnvironment": {
          "type": "select", 
          "options": ["development", "staging", "production"],
          "default": "development"
        },
        "codeQualityScore": {
          "type": "number",
          "min": 0,
          "max": 100,
          "description": "Automated code quality score"
        }
      },
      "businessRules": {
        "autoAssignment": {
          "condition": "techStack.includes('React')",
          "assignTo": "frontend-team"
        },
        "statusTransitions": {
          "planning": ["development", "cancelled"],
          "development": ["testing", "planning", "cancelled"],
          "testing": ["deployment", "development"],
          "deployment": ["completed", "testing"],
          "completed": [],
          "cancelled": ["planning"]
        }
      },
      "accessControl": {
        "defaultPermissions": {
          "engineering": ["read", "write", "delete"],
          "product": ["read", "write"],
          "management": ["read"]
        },
        "fieldAccess": {
          "codeQualityScore": ["engineering", "management"]
        }
      }
    },
    "UserStory": {
      "extends": "Task",
      "tableName": "acme_user_stories",
      "fields": {
        "storyPoints": {
          "type": "select",
          "options": ["1", "2", "3", "5", "8", "13", "21"],
          "description": "Agile story points"
        },
        "acceptanceCriteria": {
          "type": "long_text",
          "required": true,
          "description": "User story acceptance criteria"
        },
        "epicId": {
          "type": "reference",
          "references": "SoftwareProject",
          "description": "Parent epic/project"
        }
      }
    }
  },
  "workflows": {
    "sprintPlanning": {
      "trigger": "UserStory.status === 'ready'",
      "actions": ["assignToSprint", "updateCapacity"]
    }
  }
}
```

### **2. Automated Entity Generation**
The hosted generator service converts JSON to TypeScript entities:

```typescript
// Generated: /org/acme-corp/generated/entities.ts
import { Project, Task } from '@vibestack/dataforge-core';
import { Entity, Property, Enum } from '@mikro-orm/core';

@Entity({ tableName: 'acme_software_projects' })
export class SoftwareProject extends Project {
  @Property({ type: 'varchar', length: 500 })
  repositoryUrl!: string;

  @Property({ type: 'text', array: true })
  techStack!: string[];

  @Enum(() => DeploymentEnvironment)
  deploymentEnvironment: DeploymentEnvironment = DeploymentEnvironment.DEVELOPMENT;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  codeQualityScore?: number;

  // Auto-generated business rule methods
  async autoAssignBasedOnTechStack(): Promise<void> {
    if (this.techStack.includes('React')) {
      await this.assignToTeam('frontend-team');
    }
  }

  // Auto-generated validation
  validateStatusTransition(newStatus: string): boolean {
    const validTransitions = this.getValidStatusTransitions();
    return validTransitions[this.status]?.includes(newStatus) ?? false;
  }
}

@Entity({ tableName: 'acme_user_stories' })
export class UserStory extends Task {
  @Enum(() => StoryPoints)
  storyPoints?: StoryPoints;

  @Property({ type: 'text' })
  acceptanceCriteria!: string;

  @Property({ type: 'uuid', nullable: true })
  epicId?: string;

  @ManyToOne(() => SoftwareProject, { nullable: true })
  epic?: SoftwareProject;
}

export enum DeploymentEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging', 
  PRODUCTION = 'production'
}

export enum StoryPoints {
  ONE = '1',
  TWO = '2',
  THREE = '3',
  FIVE = '5',
  EIGHT = '8',
  THIRTEEN = '13',
  TWENTYONE = '21'
}
```

### **3. Migration Generation**
Automatic database migration generation:

```typescript
// Generated: /org/acme-corp/generated/migrations/v2_add_software_project_fields.ts
import { Migration } from '@mikro-orm/migrations';

export class Migration20240813000001 extends Migration {
  async up(): Promise<void> {
    // Add new fields to existing project table with org prefix
    this.addSql(`
      ALTER TABLE acme_software_projects 
      ADD COLUMN repository_url VARCHAR(500) NOT NULL DEFAULT '',
      ADD COLUMN tech_stack TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN deployment_environment VARCHAR(20) NOT NULL DEFAULT 'development',
      ADD COLUMN code_quality_score DECIMAL(5,2) NULL;
    `);

    // Add constraints and indexes
    this.addSql(`
      ALTER TABLE acme_software_projects 
      ADD CONSTRAINT chk_deployment_env 
      CHECK (deployment_environment IN ('development', 'staging', 'production'));
    `);

    this.addSql(`
      CREATE INDEX idx_acme_projects_tech_stack ON acme_software_projects USING GIN(tech_stack);
      CREATE INDEX idx_acme_projects_deployment ON acme_software_projects(deployment_environment);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP INDEX IF EXISTS idx_acme_projects_tech_stack;
      DROP INDEX IF EXISTS idx_acme_projects_deployment;
      ALTER TABLE acme_software_projects 
      DROP COLUMN IF EXISTS repository_url,
      DROP COLUMN IF EXISTS tech_stack,
      DROP COLUMN IF EXISTS deployment_environment,
      DROP COLUMN IF EXISTS code_quality_score;
    `);
  }
}
```

### **4. Client Schema Generation**
LiveStore schema for real-time sync:

```typescript
// Generated: /org/acme-corp/generated/client-schema.ts
export class AcmeLiveStoreSchema extends LiveStoreSchema {
  static readonly ORG_ID = 'acme-corp';
  static readonly VERSION = '2.1.0';
  
  static readonly ENTITIES = {
    ...LiveStoreSchema.ENTITIES, // Inherit shared entities
    softwareProject: {
      archetype: 'softwareProject',
      entityName: 'SoftwareProject',
      tableName: 'acme_software_projects',
      fields: [
        // ... base Project fields
        {
          name: 'repositoryUrl',
          type: 'url',
          required: true,
          validation: { pattern: '^https?://.+' }
        },
        {
          name: 'techStack', 
          type: 'array',
          required: true,
          validation: { 
            enum: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'] 
          }
        }
      ],
      businessRules: {
        autoAssignment: true,
        statusTransitions: {
          planning: ['development', 'cancelled'],
          development: ['testing', 'planning', 'cancelled']
        }
      },
      isMultiTenant: true,
      organizationId: 'acme-corp'
    }
  };
}
```

## 🚀 Deployment Pipeline

### **Continuous Schema Deployment**
```yaml
# .github/workflows/schema-deployment.yml
name: Multi-Org Schema Deployment

on:
  push:
    paths: ['orgs/*/schema.json']

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      changed-orgs: ${{ steps.changes.outputs.orgs }}
    steps:
      - uses: actions/checkout@v3
      - name: Detect changed organizations
        id: changes
        run: |
          CHANGED_ORGS=$(git diff --name-only HEAD^ HEAD | grep 'orgs/.*/schema.json' | cut -d'/' -f2 | sort -u | jq -R . | jq -s .)
          echo "orgs=$CHANGED_ORGS" >> $GITHUB_OUTPUT

  deploy-org-schemas:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        org: ${{ fromJson(needs.detect-changes.outputs.changed-orgs) }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate entities for ${{ matrix.org }}
        run: |
          npx @vibestack/dataforge-generator generate-entities \
            --org ${{ matrix.org }} \
            --config orgs/${{ matrix.org }}/schema.json \
            --output generated/${{ matrix.org }}/
      
      - name: Generate migrations for ${{ matrix.org }}
        run: |
          npx @vibestack/dataforge-generator generate-migrations \
            --org ${{ matrix.org }} \
            --from-version $(cat orgs/${{ matrix.org }}/current-version.txt) \
            --to-version $(jq -r '.version' orgs/${{ matrix.org }}/schema.json)
      
      - name: Validate generated artifacts
        run: |
          npx @vibestack/dataforge-generator validate \
            --org ${{ matrix.org }} \
            --check-migrations \
            --check-schemas \
            --check-types
      
      - name: Deploy to staging
        run: |
          npx @vibestack/dataforge-runtime deploy \
            --org ${{ matrix.org }} \
            --environment staging \
            --dry-run
      
      - name: Run migration tests
        run: |
          npx @vibestack/dataforge-runtime test-migrations \
            --org ${{ matrix.org }} \
            --environment staging
      
      - name: Deploy to production (background)
        if: github.ref == 'refs/heads/main'
        run: |
          npx @vibestack/dataforge-runtime deploy \
            --org ${{ matrix.org }} \
            --environment production \
            --background \
            --notify-webhook ${{ secrets.DEPLOYMENT_WEBHOOK }}
```

### **Background Migration System**
```typescript
// Production migration runner
export class BackgroundMigrationRunner {
  private queue = new Bull('schema-migrations', {
    redis: process.env.REDIS_URL
  });

  async scheduleOrgMigration(orgId: string, fromVersion: string, toVersion: string) {
    // Add to queue with priority and retry logic
    await this.queue.add('migrate-org-schema', {
      organizationId: orgId,
      fromVersion,
      toVersion,
      artifacts: await this.loadMigrationArtifacts(orgId, toVersion)
    }, {
      priority: this.getMigrationPriority(orgId),
      attempts: 3,
      backoff: 'exponential',
      delay: this.calculateMigrationDelay(orgId)
    });
  }

  async processMigration(job: Job) {
    const { organizationId, fromVersion, toVersion, artifacts } = job.data;
    
    try {
      // 1. Backup current schema
      await this.createSchemaBackup(organizationId);
      
      // 2. Apply migrations in transaction
      await this.runMigrationsInTransaction(organizationId, artifacts.migrations);
      
      // 3. Update client schemas (LiveStore + Dexie)
      await this.deployClientSchemas(organizationId, artifacts.clientSchemas);
      
      // 4. Update server schemas (Kysely)
      await this.deployServerSchemas(organizationId, artifacts.serverSchemas);
      
      // 5. Validate deployment
      await this.validateMigration(organizationId, toVersion);
      
      // 6. Update version tracking
      await this.updateOrgVersion(organizationId, toVersion);
      
      // 7. Notify organization
      await this.notifyMigrationComplete(organizationId, toVersion);
      
    } catch (error) {
      // Rollback on failure
      await this.rollbackMigration(organizationId, fromVersion);
      throw error;
    }
  }

  private async runMigrationsInTransaction(orgId: string, migrations: Migration[]) {
    const db = await this.getOrgDatabase(orgId);
    
    await db.transaction(async (trx) => {
      for (const migration of migrations) {
        console.log(`Applying migration ${migration.name} for org ${orgId}`);
        await migration.up(trx);
        
        // Record migration in org-specific migration table
        await trx('org_migration_history').insert({
          organization_id: orgId,
          migration_name: migration.name,
          applied_at: new Date(),
          checksum: migration.checksum
        });
      }
    });
  }
}
```

## 🔧 Runtime Schema Loading

### **Dynamic Organization Resolution**
```typescript
// Runtime schema resolver
export class OrgSchemaResolver {
  private schemaCache = new Map<string, OrgSchema>();
  
  async resolveOrgSchema(organizationId: string): Promise<OrgSchema> {
    // Check cache first
    if (this.schemaCache.has(organizationId)) {
      return this.schemaCache.get(organizationId)!;
    }
    
    // Load from hosted config service
    const schemaConfig = await fetch(
      `${process.env.CONFIG_SERVICE_URL}/org/${organizationId}/current.json`
    ).then(r => r.json());
    
    // Load generated artifacts
    const artifacts = await this.loadOrgArtifacts(organizationId, schemaConfig.version);
    
    const orgSchema = new OrgSchema({
      organizationId,
      version: schemaConfig.version,
      entities: artifacts.entities,
      migrations: artifacts.migrations,
      clientSchema: artifacts.clientSchema,
      serverSchema: artifacts.serverSchema,
      businessRules: schemaConfig.businessRules
    });
    
    // Cache with TTL
    this.schemaCache.set(organizationId, orgSchema);
    setTimeout(() => this.schemaCache.delete(organizationId), 5 * 60 * 1000); // 5 min TTL
    
    return orgSchema;
  }
}

// Request middleware for org-aware routing
export class OrgAwareMiddleware {
  async resolveOrganization(req: Request): Promise<string> {
    // Extract org from subdomain: acme.vibestack.io -> acme-corp
    const subdomain = req.hostname.split('.')[0];
    const orgMapping = await this.getOrgMapping(subdomain);
    return orgMapping.organizationId;
  }

  async injectOrgSchema(req: Request, res: Response, next: NextFunction) {
    const orgId = await this.resolveOrganization(req);
    const orgSchema = await this.schemaResolver.resolveOrgSchema(orgId);
    
    // Make available to request context
    req.org = {
      id: orgId,
      schema: orgSchema,
      entities: orgSchema.getEntities(),
      accessControl: orgSchema.getAccessControl()
    };
    
    next();
  }
}
```

### **Type-Safe Runtime Validation**
```typescript
// Runtime entity validation using generated schemas
export class OrgEntityValidator {
  async validateEntity(
    orgId: string, 
    archetype: string, 
    data: any
  ): Promise<ValidationResult> {
    const orgSchema = await this.schemaResolver.resolveOrgSchema(orgId);
    const entityDef = orgSchema.getEntity(archetype);
    
    if (!entityDef) {
      return { valid: false, errors: [`Unknown entity type: ${archetype}`] };
    }
    
    // Validate using generated schema
    const result = orgSchema.validateEntity(archetype, data);
    
    // Apply org-specific business rules
    if (result.valid) {
      const businessRuleResult = await this.validateBusinessRules(
        orgId, 
        archetype, 
        data, 
        entityDef.businessRules
      );
      result.valid = businessRuleResult.valid;
      result.errors.push(...businessRuleResult.errors);
    }
    
    return result;
  }
}
```

## 📊 Monitoring & Observability

### **Schema Deployment Metrics**
```typescript
// Migration monitoring
export class MigrationMetrics {
  async trackMigration(orgId: string, migration: string, duration: number, success: boolean) {
    await this.metrics.increment('migration.completed', {
      organization: orgId,
      migration,
      success: success.toString()
    });
    
    await this.metrics.histogram('migration.duration', duration, {
      organization: orgId,
      migration
    });
  }
  
  async trackSchemaGeneration(orgId: string, type: 'client' | 'server', duration: number) {
    await this.metrics.histogram('schema.generation.duration', duration, {
      organization: orgId,
      type
    });
  }
}

// Health checks for org-specific schemas
export class OrgSchemaHealthCheck {
  async checkOrgHealth(orgId: string): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkSchemaVersion(orgId),
      this.checkDatabaseConnectivity(orgId),
      this.checkMigrationStatus(orgId),
      this.checkClientSchemaSync(orgId)
    ]);
    
    return {
      organization: orgId,
      healthy: checks.every(c => c.status === 'fulfilled'),
      checks: checks.map((c, i) => ({
        name: ['schema', 'database', 'migrations', 'client-sync'][i],
        status: c.status,
        error: c.status === 'rejected' ? c.reason : undefined
      }))
    };
  }
}
```

## 🎯 Key Production Benefits

### **Seamless Multi-Tenancy**
- ✅ **JSON Configuration** - Easy business entity definition
- ✅ **Automatic Generation** - TypeScript entities, migrations, schemas
- ✅ **Background Deployment** - Zero-downtime schema updates
- ✅ **Type Safety** - Full type safety from config to runtime
- ✅ **Validation** - Runtime validation using generated schemas

### **Developer Experience**
- ✅ **Self-Service** - Organizations configure their own entities
- ✅ **Version Control** - All schema changes tracked in Git
- ✅ **Testing** - Comprehensive validation before deployment
- ✅ **Rollback** - Safe rollback procedures for failed migrations

### **Production Reliability**
- ✅ **Incremental Deployment** - Only changed organizations updated
- ✅ **Migration Safety** - Transactional migrations with backups
- ✅ **Monitoring** - Comprehensive metrics and health checks
- ✅ **Scalability** - Independent scaling per organization

This architecture provides a production-ready multi-org system with the JSON-to-migration pattern, enabling organizations to define custom business entities while maintaining type safety, performance, and reliability across the entire stack.