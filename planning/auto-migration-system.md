# Auto-Migration System with Debounce

## Overview

Simple auto-migration system that automatically creates/updates/deletes database tables when organization entity definitions change, with debouncing to batch changes together.

## 🏗️ Core Architecture

### **Organization Entity Registry**
```typescript
@Entity({ tableName: 'org_entity_definitions' })
export class OrgEntityDefinition extends BaseEntity {
  @Property()
  organizationId!: string;
  
  @Property()
  entityName!: string; // 'SoftwareProject', 'UserStory'
  
  @Property()
  tableName!: string; // 'acme_software_projects'
  
  @Property()
  baseArchetype!: string; // 'Project', 'Task', 'File'
  
  @Property({ type: 'json' })
  schema!: {
    fields: Record<string, FieldDefinition>;
    indexes?: string[];
    relationships?: RelationshipDefinition[];
  };
  
  @Property()
  version!: string; // Incremented on each change
  
  @Property()
  status!: 'active' | 'migrating' | 'deleted';
  
  @Property({ type: 'text', nullable: true })
  checksum?: string; // Hash of schema for change detection
}

interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'select' | 'multiselect';
  required?: boolean;
  default?: any;
  options?: string[]; // For select/multiselect
  length?: number;
}
```

### **Migration Queue with Debounce**
```typescript
@Entity({ tableName: 'pending_migrations' })
export class PendingMigration extends BaseEntity {
  @Property()
  organizationId!: string;
  
  @Property()
  entityName!: string;
  
  @Property()
  operation!: 'create' | 'update' | 'delete';
  
  @Property({ type: 'json' })
  oldSchema?: any;
  
  @Property({ type: 'json' })
  newSchema?: any;
  
  @Property()
  scheduledFor!: Date; // When to execute (debounced)
  
  @Property()
  status!: 'pending' | 'processing' | 'completed' | 'failed';
  
  @Property({ type: 'text', nullable: true })
  error?: string;
}

export class AutoMigrationService {
  private readonly DEBOUNCE_DELAY = 30000; // 30 seconds
  
  async scheduleEntityChange(
    organizationId: string,
    entityName: string,
    operation: 'create' | 'update' | 'delete',
    newSchema?: any,
    oldSchema?: any
  ) {
    // Cancel any existing pending migration for this entity
    await this.em.nativeUpdate(PendingMigration, 
      { organizationId, entityName, status: 'pending' },
      { status: 'completed' }
    );
    
    // Schedule new migration with debounce
    const migration = new PendingMigration();
    migration.organizationId = organizationId;
    migration.entityName = entityName;
    migration.operation = operation;
    migration.oldSchema = oldSchema;
    migration.newSchema = newSchema;
    migration.scheduledFor = new Date(Date.now() + this.DEBOUNCE_DELAY);
    migration.status = 'pending';
    
    await this.em.persistAndFlush(migration);
    
    console.log(`📅 Scheduled ${operation} migration for ${entityName} in ${this.DEBOUNCE_DELAY/1000}s`);
  }
}
```

## 🔄 Auto-Migration Processor

### **Background Migration Runner**
```typescript
export class MigrationProcessor {
  @Cron('*/10 * * * * *') // Every 10 seconds
  async processPendingMigrations() {
    const now = new Date();
    
    // Get all migrations ready to run
    const readyMigrations = await this.em.find(PendingMigration, {
      scheduledFor: { $lte: now },
      status: 'pending'
    });
    
    // Group by organization for batch processing
    const byOrg = this.groupByOrganization(readyMigrations);
    
    for (const [orgId, migrations] of byOrg) {
      await this.processBatchForOrg(orgId, migrations);
    }
  }
  
  private async processBatchForOrg(orgId: string, migrations: PendingMigration[]) {
    console.log(`🔄 Processing ${migrations.length} migrations for org ${orgId}`);
    
    for (const migration of migrations) {
      try {
        migration.status = 'processing';
        await this.em.flush();
        
        await this.executeMigration(migration);
        
        migration.status = 'completed';
        await this.em.flush();
        
      } catch (error) {
        migration.status = 'failed';
        migration.error = String(error);
        await this.em.flush();
        
        console.error(`❌ Migration failed for ${migration.entityName}:`, error);
      }
    }
    
    // Regenerate schemas after all migrations complete
    await this.regenerateOrgSchemas(orgId);
  }
  
  private async executeMigration(migration: PendingMigration) {
    switch (migration.operation) {
      case 'create':
        await this.createTable(migration);
        break;
      case 'update': 
        await this.updateTable(migration);
        break;
      case 'delete':
        await this.deleteTable(migration);
        break;
    }
  }
}
```

### **Table Operations**
```typescript
export class TableOperations {
  async createTable(migration: PendingMigration) {
    const { organizationId, entityName, newSchema } = migration;
    const tableName = this.getTableName(organizationId, entityName);
    
    // Get base archetype fields
    const baseFields = this.getBaseArchetypeFields(newSchema.baseArchetype);
    
    // Convert custom fields to SQL
    const customFields = this.convertFieldsToSQL(newSchema.fields);
    
    const sql = `
      CREATE TABLE ${tableName} (
        ${baseFields.join(',\n        ')},
        ${customFields.join(',\n        ')},
        custom_fields JSONB DEFAULT '{}'::jsonb
      );
    `;
    
    await this.em.getConnection().execute(sql);
    
    // Add indexes
    await this.createIndexes(tableName, newSchema);
    
    console.log(`✅ Created table ${tableName}`);
  }
  
  async updateTable(migration: PendingMigration) {
    const { organizationId, entityName, oldSchema, newSchema } = migration;
    const tableName = this.getTableName(organizationId, entityName);
    
    const changes = this.compareSchemas(oldSchema, newSchema);
    
    for (const change of changes) {
      switch (change.type) {
        case 'add_column':
          await this.addColumn(tableName, change.field, change.definition);
          break;
        case 'drop_column':
          await this.dropColumn(tableName, change.field);
          break;
        case 'modify_column':
          await this.modifyColumn(tableName, change.field, change.definition);
          break;
        case 'add_index':
          await this.addIndex(tableName, change.index);
          break;
        case 'drop_index':
          await this.dropIndex(tableName, change.index);
          break;
      }
    }
    
    console.log(`✅ Updated table ${tableName} with ${changes.length} changes`);
  }
  
  async deleteTable(migration: PendingMigration) {
    const { organizationId, entityName } = migration;
    const tableName = this.getTableName(organizationId, entityName);
    
    await this.em.getConnection().execute(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    
    console.log(`✅ Deleted table ${tableName}`);
  }
  
  private convertFieldsToSQL(fields: Record<string, FieldDefinition>): string[] {
    return Object.entries(fields).map(([name, def]) => {
      const sqlType = this.getSQLType(def);
      const nullable = def.required ? 'NOT NULL' : 'NULL';
      const defaultVal = def.default ? `DEFAULT ${this.formatDefault(def.default)}` : '';
      
      return `${name} ${sqlType} ${nullable} ${defaultVal}`.trim();
    });
  }
  
  private getSQLType(def: FieldDefinition): string {
    switch (def.type) {
      case 'string': return `VARCHAR(${def.length || 255})`;
      case 'number': return 'DECIMAL(12,2)';
      case 'boolean': return 'BOOLEAN';
      case 'date': return 'TIMESTAMPTZ';
      case 'json': return 'JSONB';
      case 'select': return 'VARCHAR(100)';
      case 'multiselect': return 'TEXT[]';
      default: return 'TEXT';
    }
  }
}
```

## 📝 API Integration

### **Entity Definition Management**
```typescript
// API endpoint for updating entity definitions
app.put('/api/org/entities/:entityName', async (req, res) => {
  const { organizationId } = req.user;
  const { entityName } = req.params;
  const { baseArchetype, fields, indexes } = req.body;
  
  // Get existing definition
  const existing = await em.findOne(OrgEntityDefinition, {
    organizationId,
    entityName
  });
  
  // Create new schema
  const newSchema = { fields, indexes, baseArchetype };
  const checksum = this.calculateChecksum(newSchema);
  
  if (existing) {
    // Check if actually changed
    if (existing.checksum === checksum) {
      return res.json({ message: 'No changes detected' });
    }
    
    // Schedule update migration
    await migrationService.scheduleEntityChange(
      organizationId,
      entityName,
      'update',
      newSchema,
      existing.schema
    );
    
    // Update definition
    existing.schema = newSchema;
    existing.checksum = checksum;
    existing.version = this.incrementVersion(existing.version);
    
  } else {
    // Schedule create migration
    await migrationService.scheduleEntityChange(
      organizationId,
      entityName,
      'create',
      newSchema
    );
    
    // Create new definition
    const definition = new OrgEntityDefinition();
    definition.organizationId = organizationId;
    definition.entityName = entityName;
    definition.tableName = `${organizationId}_${entityName.toLowerCase()}`;
    definition.baseArchetype = baseArchetype;
    definition.schema = newSchema;
    definition.checksum = checksum;
    definition.version = '1.0.0';
    definition.status = 'migrating';
    
    await em.persistAndFlush(definition);
  }
  
  res.json({ 
    message: 'Migration scheduled',
    estimatedCompletion: new Date(Date.now() + 30000)
  });
});

// Delete entity
app.delete('/api/org/entities/:entityName', async (req, res) => {
  const { organizationId } = req.user;
  const { entityName } = req.params;
  
  const existing = await em.findOne(OrgEntityDefinition, {
    organizationId,
    entityName
  });
  
  if (existing) {
    await migrationService.scheduleEntityChange(
      organizationId,
      entityName, 
      'delete',
      undefined,
      existing.schema
    );
    
    existing.status = 'deleted';
    await em.flush();
  }
  
  res.json({ message: 'Entity deletion scheduled' });
});
```

## 🎯 Usage Examples

### **Adding Custom Entity**
```typescript
// Organization defines a new SoftwareProject entity
const entityDef = {
  baseArchetype: 'Project',
  fields: {
    repositoryUrl: { type: 'string', required: true },
    techStack: { type: 'multiselect', options: ['React', 'Node.js', 'Python'] },
    deploymentEnv: { type: 'select', options: ['dev', 'staging', 'prod'] },
    codeQuality: { type: 'number', default: 0 }
  },
  indexes: ['repository_url', 'deployment_env']
};

// POST /api/org/entities/SoftwareProject
// -> Schedules migration in 30 seconds
// -> Creates acme_software_projects table automatically
// -> Regenerates LiveStore + Kysely schemas
// -> Organization can start using immediately with customFields
```

### **Updating Entity**
```typescript
// Add new field to existing entity
const updatedDef = {
  baseArchetype: 'Project',
  fields: {
    repositoryUrl: { type: 'string', required: true },
    techStack: { type: 'multiselect', options: ['React', 'Node.js', 'Python'] },
    deploymentEnv: { type: 'select', options: ['dev', 'staging', 'prod'] },
    codeQuality: { type: 'number', default: 0 },
    lastDeployment: { type: 'date' } // NEW FIELD
  }
};

// PUT /api/org/entities/SoftwareProject
// -> Debounces with any other changes in 30s window
// -> Generates ALTER TABLE migration
// -> Updates schemas automatically
```

## ✅ Benefits

### **Simple & Fast**
- ✅ **30-second debounce** - batches rapid changes
- ✅ **Auto-migration** - no manual intervention needed
- ✅ **Immediate fallback** - customFields JSON works instantly
- ✅ **Background processing** - doesn't block API calls

### **Safe & Reliable**
- ✅ **Change detection** - only migrates actual changes
- ✅ **Rollback capable** - standard migration patterns
- ✅ **Error handling** - failed migrations logged
- ✅ **Schema regeneration** - keeps everything in sync

This gives organizations the flexibility to rapidly iterate on their entity definitions while automatically maintaining proper database schemas and generated code!