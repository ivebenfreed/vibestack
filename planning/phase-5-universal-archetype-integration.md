# Phase 5: Universal Archetype Integration Plan
*True Integration of 8 Universal Archetypes with Multi-Org DataForge Architecture*

## Critical Analysis: Current Architecture vs Requirements

### What We Have Built (Phase 1-3 Complete)
1. **Complete Server-Only DataForge** in `apps/server/src/dataforge/`
2. **Multi-Org Platform** with Better Auth + Durable Objects
3. **Debounced Migration System** using Kysely (30-second batching)
4. **Foundation Entity System** with 6 archetypes (Record, Document, File, Activity, Discussion, Collection)
5. **Universal Archetype API** that bypasses the existing systems

### Critical Integration Gap Identified

**🚨 PROBLEM**: The Universal Archetype API (`universal-archetype-api.ts`) is **completely disconnected** from the existing Phase 5 architecture:

- **Bypasses EntityManager**: Direct SQL execution instead of using debounced migrations
- **Bypasses Durable Objects**: No integration with OrgSchemaDO or SuperAdminDO
- **Bypasses Access Control**: No auth middleware or permission checks
- **Bypasses Migration System**: Causes "multiple commands in prepared statement" errors
- **Missing 2 Archetypes**: Only has 6/8 archetypes (missing Project, Task)

**🎯 SOLUTION**: Properly integrate Universal Archetype system with existing Phase 5 architecture

## Phase 5 Integration Architecture

### Core Principle: Use Existing Infrastructure
The Universal Archetype system must use the existing Phase 5 components, not replace them:

```
CLIENT REQUEST
    ↓
Universal Archetype API ← NEW: Just the interface layer
    ↓
EntityManager ← EXISTING: Uses debounced migrations
    ↓  
DebouncedMigrationService ← EXISTING: 30-second batching
    ↓
Kysely + RuntimeSchemaGenerator ← EXISTING: SQL generation
    ↓
PostgreSQL ← EXISTING: Database layer
```

### Integration Components

#### 1. Universal Archetype Interface Layer (NEW)
```typescript
// apps/server/src/routes/universal-archetype-api.ts
export const universalArchetypeRouter = new Hono<AppContext>();

// Health check and archetype discovery
universalArchetypeRouter.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    system: 'universal-archetype-api',
    archetypes: FoundationEntityRegistry.getAllArchetypes(), // 8 archetypes
    timestamp: new Date().toISOString()
  });
});

// Entity creation - INTEGRATED with existing systems
universalArchetypeRouter.post('/orgs/:orgId/entities', async (c) => {
  // 1. Auth check (use existing middleware)
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // 2. Convert Universal format to DataForge format
  const { entityName, definition } = await c.req.json();
  const dataforgeDefinition = convertUniversalToDataForge(definition);

  // 3. Use existing EntityManager (with debounced migrations)
  const entityManager = await getEntityManager(c.env);
  const result = await entityManager.createOrgEntity(
    c.req.param('orgId'),
    entityName,
    dataforgeDefinition
  );

  return c.json(result);
});
```

#### 2. Complete Foundation Entity Registry (ENHANCED)
```typescript
// apps/server/src/dataforge/entities/foundation/index.ts
export class FoundationEntityRegistry {
  /**
   * Get all 8 universal archetypes
   */
  static getAllArchetypes(): string[] {
    return [
      'project',    // NEW: Add missing archetypes
      'task',       // NEW: Add missing archetypes
      'record',     // EXISTING
      'document',   // EXISTING
      'file',       // EXISTING
      'activity',   // EXISTING
      'discussion', // EXISTING
      'collection'  // EXISTING
    ];
  }

  /**
   * Get archetype pattern class for all 8 archetypes
   */
  static getArchetypePatternClass(archetype: string) {
    const entities = this.getEntityClasses();
    
    switch (archetype) {
      case 'project': return entities.Project;     // NEW
      case 'task': return entities.Task;           // NEW
      case 'record': return entities.Record;       // EXISTING
      case 'document': return entities.Document;   // EXISTING
      case 'file': return entities.File;           // EXISTING
      case 'activity': return entities.Activity;   // EXISTING
      case 'discussion': return entities.Discussion; // EXISTING
      case 'collection': return entities.Collection; // EXISTING
      default: return null;
    }
  }
}
```

#### 3. Missing Archetype Implementations (NEW)
```typescript
// apps/server/src/dataforge/entities/foundation/archetypes/Project.ts
export class ProjectArchetype extends BaseDomainEntity {
  static fields = {
    name: { type: 'text', required: true },
    description: { type: 'longtext', required: false },
    priority: { type: 'priority_option', required: true, defaultValue: 'medium' },
    start_date: { type: 'date', required: false },
    end_date: { type: 'date', required: false },
    owner_id: { type: 'user_reference', required: false }
  };

  static getKyselySchema() {
    return {
      id: 'string',
      organization_id: 'string',
      name: 'string',
      description: 'string | null',
      priority: 'string',
      start_date: 'Date | null',
      end_date: 'Date | null',
      owner_id: 'string | null',
      status: 'string',
      created_at: 'Date',
      updated_at: 'Date'
    };
  }

  static getDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS {tableName} (
        id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        start_date DATE,
        end_date DATE,
        owner_id UUID,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
  }
}

// apps/server/src/dataforge/entities/foundation/archetypes/Task.ts
export class TaskArchetype extends BaseDomainEntity {
  static fields = {
    title: { type: 'text', required: true },
    description: { type: 'longtext', required: false },
    priority: { type: 'priority_option', required: true, defaultValue: 'medium' },
    status: { type: 'status_option', required: true, defaultValue: 'todo' },
    assignee_id: { type: 'user_reference', required: false },
    due_date: { type: 'date', required: false },
    estimated_hours: { type: 'number', required: false }
  };

  static getKyselySchema() {
    return {
      id: 'string',
      organization_id: 'string',
      title: 'string',
      description: 'string | null',
      priority: 'string',
      status: 'string',
      assignee_id: 'string | null',
      due_date: 'Date | null',
      estimated_hours: 'number | null',
      created_at: 'Date',
      updated_at: 'Date'
    };
  }

  static getDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS {tableName} (
        id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'todo',
        assignee_id UUID,
        due_date DATE,
        estimated_hours INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
  }
}
```

#### 4. Format Conversion Layer (NEW)
```typescript
// apps/server/src/dataforge/universal/format-converter.ts
export class UniversalFormatConverter {
  /**
   * Convert Universal Archetype format to DataForge OrgEntityDefinition
   */
  static convertUniversalToDataForge(
    entityName: string,
    universalDefinition: UniversalArchetypeDefinition
  ): OrgEntityDefinition {
    const { fields, archetype, syncable } = universalDefinition;

    // Get base archetype fields
    const baseFields = FoundationEntityRegistry.getArchetypePatternClass(archetype)?.fields || {};

    // Convert fields array to DataForge customFields format
    const customFields: Record<string, FieldDefinition> = {};
    fields.forEach(field => {
      customFields[field.name] = {
        type: field.type,
        required: field.required || false,
        default: field.defaultValue,
        syncable: field.syncable !== false, // Default to true unless explicitly false
        serverOnly: field.serverOnly || false
      };
    });

    return {
      entityName,
      baseArchetype: archetype,
      tableName: '', // Will be generated by EntityManager
      customFields,
      syncable: syncable !== false,
      validation: {
        rules: [] // Can be enhanced later
      }
    };
  }

  /**
   * Convert DataForge format back to Universal format
   */
  static convertDataForgeToUniversal(
    definition: OrgEntityDefinition
  ): UniversalArchetypeDefinition {
    const fields = Object.entries(definition.customFields).map(([name, fieldDef]) => ({
      name,
      type: fieldDef.type,
      required: fieldDef.required,
      defaultValue: fieldDef.default,
      syncable: fieldDef.syncable,
      serverOnly: fieldDef.serverOnly
    }));

    return {
      fields,
      archetype: definition.baseArchetype as any,
      syncable: definition.syncable
    };
  }
}
```

#### 5. Multi-Statement SQL Execution Fix (ENHANCED)
```typescript
// apps/server/src/dataforge/kysely-generator/runtime-schema-generator.ts
export class RuntimeSchemaGenerator {
  /**
   * Generate individual SQL statements (fix for Neon HTTP dialect)
   */
  generateCreateTableStatements(definition: OrgEntityDefinition): string[] {
    const statements: string[] = [];

    // 1. CREATE TABLE statement
    const baseColumns = this.getBaseArchetypeColumns(definition.baseArchetype);
    const customColumns = this.generateCustomColumns(definition.customFields);
    
    statements.push(`
      CREATE TABLE ${definition.tableName} (
        ${baseColumns}${customColumns ? ',\n  ' + customColumns : ''}
      );
    `);

    // 2. Individual INDEX statements
    statements.push(`
      CREATE INDEX idx_${definition.tableName}_org_status 
      ON ${definition.tableName}(organization_id, status);
    `);

    statements.push(`
      CREATE INDEX idx_${definition.tableName}_created_at 
      ON ${definition.tableName}(created_at);
    `);

    return statements;
  }

  /**
   * Execute multiple statements individually (fix for Neon HTTP)
   */
  async executeCreateTableStatements(
    kysely: Kysely<any>, 
    definition: OrgEntityDefinition
  ): Promise<void> {
    const statements = this.generateCreateTableStatements(definition);
    
    // Execute each statement individually
    for (const statement of statements) {
      await kysely.executeQuery(sql`${sql.raw(statement)}`.compile(kysely));
    }
  }
}
```

## Implementation Plan

### Week 1: Foundation Integration

#### Day 1-2: Add Missing Archetypes
- [ ] Create `ProjectArchetype` and `TaskArchetype` entities
- [ ] Update `FoundationEntityRegistry` to include all 8 archetypes
- [ ] Test archetype pattern classes with Kysely schema generation

#### Day 3-4: Format Conversion Layer
- [ ] Implement `UniversalFormatConverter` class
- [ ] Add comprehensive field type mapping
- [ ] Create validation for Universal → DataForge conversion
- [ ] Test conversion with all 8 archetype patterns

#### Day 5-7: SQL Execution Fix
- [ ] Update `RuntimeSchemaGenerator` to generate individual statements
- [ ] Fix Neon HTTP dialect compatibility
- [ ] Test with debounced migration system
- [ ] Ensure backward compatibility

### Week 2: API Integration

#### Day 8-10: Universal API Integration
- [ ] Rewrite `universal-archetype-api.ts` to use existing EntityManager
- [ ] Add authentication middleware integration
- [ ] Integrate with Durable Objects (OrgSchemaDO)
- [ ] Remove direct SQL execution

#### Day 11-12: Migration System Integration
- [ ] Ensure Universal API uses debounced migration system
- [ ] Test 30-second batching with Universal API calls
- [ ] Verify migration status tracking
- [ ] Add migration completion webhooks

#### Day 13-14: Access Control Integration
- [ ] Add permission checks to Universal API
- [ ] Integrate with existing access control middleware
- [ ] Test org-level isolation
- [ ] Verify cross-org data protection

### Week 3: Comprehensive Testing

#### Day 15-17: End-to-End Testing
- [ ] Create comprehensive test suite for all 8 archetypes
- [ ] Test Universal API → EntityManager → Migration flow
- [ ] Verify SQL execution with Neon HTTP dialect
- [ ] Test concurrent entity creation with debouncing

#### Day 18-19: Performance Testing
- [ ] Load test with multiple orgs creating entities simultaneously
- [ ] Test migration system under high load
- [ ] Verify debouncing effectiveness
- [ ] Monitor database connection usage

#### Day 20-21: Integration Validation
- [ ] Test integration with existing Phase 1-3 systems
- [ ] Verify backward compatibility
- [ ] Test with existing DataForge API endpoints
- [ ] Validate sync field filtering

### Week 4: Production Readiness

#### Day 22-24: Error Handling & Monitoring
- [ ] Add comprehensive error handling to Universal API
- [ ] Implement detailed logging for debugging
- [ ] Add metrics for archetype creation and migration
- [ ] Create health check endpoints

#### Day 25-26: Documentation & Developer Experience
- [ ] Update API documentation with Universal Archetype endpoints
- [ ] Create examples for all 8 archetype patterns
- [ ] Document the integration architecture
- [ ] Add troubleshooting guides

#### Day 27-28: Production Deployment
- [ ] Deploy integrated system to staging
- [ ] Run production readiness tests
- [ ] Verify monitoring and alerting
- [ ] Create deployment runbook

## Success Metrics

### Technical Integration
- [ ] ✅ All 8 universal archetypes working with EntityManager
- [ ] ✅ Universal API fully integrated with debounced migration system
- [ ] ✅ Neon HTTP dialect compatibility (no multi-statement errors)
- [ ] ✅ Complete integration with existing access control
- [ ] ✅ Zero architectural bypasses (everything uses Phase 5 systems)

### Performance Targets
- [ ] ✅ Entity creation < 100ms (immediate response, migration scheduled)
- [ ] ✅ Migration completion < 30 seconds (debounced batching)
- [ ] ✅ No database connection failures with proper pooling
- [ ] ✅ Concurrent entity creation scales linearly

### Business Functionality
- [ ] ✅ Organizations can create entities via Universal API format
- [ ] ✅ All field types supported (text, longtext, user_reference, etc.)
- [ ] ✅ Sync field control working (syncable vs server-only)
- [ ] ✅ Cross-archetype relationships functional
- [ ] ✅ Access control enforced at org and entity level

## Risk Mitigation

### Technical Risks
- **Multi-statement SQL execution**: Fixed with individual statement execution
- **Migration system integration**: Use existing EntityManager, don't bypass
- **Access control bypass**: Integrate auth middleware properly
- **Performance degradation**: Use existing debounced migration system

### Integration Risks
- **Breaking existing functionality**: Comprehensive backward compatibility testing
- **Durable Objects integration**: Follow existing patterns from Phase 2
- **Data corruption**: Use existing transaction patterns from Phase 3
- **Cross-org leakage**: Leverage existing isolation from Phase 1-3

## Architecture Benefits

### Proper Integration
1. **Uses Existing Infrastructure**: No architectural bypasses or duplicate systems
2. **Maintains Performance**: Leverages debounced migration system
3. **Preserves Security**: Full integration with access control and auth
4. **Scales Properly**: Uses existing Durable Objects and database patterns

### Universal Archetype Benefits
1. **Complete Coverage**: All 8 archetypes supported (project, task, record, document, file, activity, discussion, collection)
2. **Consistent API**: Single interface for all archetype creation patterns
3. **Type Safety**: Full integration with Kysely type generation
4. **Field Control**: Proper sync field filtering maintained

### Developer Experience
1. **Familiar Patterns**: Uses existing Phase 5 architecture patterns
2. **Easy Testing**: Integrates with existing test infrastructure
3. **Clear Documentation**: Single architecture to understand
4. **Debugging**: Uses existing logging and monitoring systems

## Next Steps After Integration

### Phase 6: Advanced Universal Features
- Cross-archetype relationships and dependencies
- Computed fields with formula-based validation
- Advanced access control with archetype-specific permissions
- Real-time schema updates via WebSocket

### Production Enhancements
- Performance optimization for high-volume entity creation
- Advanced monitoring and alerting for migration system
- Schema versioning and rollback capabilities
- Enterprise features for large organizations

---

## ✅ Integration Success Definition

**COMPLETE SUCCESS**: Universal Archetype system fully integrated with Phase 5 architecture where:

1. **All 8 archetypes** work through existing EntityManager
2. **Debounced migration system** handles all table creation
3. **Access control** protects all Universal API endpoints
4. **Neon HTTP dialect** works without multi-statement errors
5. **Comprehensive test suite** validates all integration points
6. **Zero architectural bypasses** - everything uses Phase 5 systems

The result will be a **true unified platform** where Universal Archetypes are not a separate system, but the natural interface to the robust Phase 5 multi-org DataForge architecture.