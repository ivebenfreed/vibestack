# MikroORM + Drizzle Migration Plan

## Goal
Replace TypeORM entirely with:
- **MikroORM**: Entity definitions, migrations, code generation
- **Drizzle**: All runtime queries (server)
- **Generic Sync**: Table-agnostic sync engine
- **Dexie**: Client-side (unchanged)

## Architecture Vision

```
MikroORM Entities
    ↓
Generate: Drizzle Schema + Sync Metadata + Type Definitions
    ↓
Runtime: Generic Sync Engine + Direct Drizzle Queries
```

## Phase 1: Complete MikroORM Setup (Day 1-2)

### 1.1 Move MikroORM to Main DataForge
```bash
# Copy dataforge-next into dataforge
cp -r packages/dataforge-next/src/entities packages/dataforge/src/entities-mikro
cp -r packages/dataforge-next/src/scripts packages/dataforge/src/scripts-mikro
```

### 1.2 Add Missing Entities
Check TypeORM entities vs MikroORM and add any missing:
- Tag, TagSet
- StatusDefinition, StatusSet  
- Verification
- Any other domain entities

### 1.3 Configure MikroORM
```typescript
// packages/dataforge/mikro-orm.config.ts
export default {
  entities: ['./src/entities-mikro/**/*.ts'],
  dbName: process.env.DATABASE_NAME,
  type: 'postgresql',
  migrations: {
    path: './src/migrations-mikro',
    glob: '!(*.d).{js,ts}',
  }
};
```

## Phase 2: Enhanced Generators (Day 2-3)

### 2.1 Create Sync Metadata Generator
```typescript
// packages/dataforge/src/scripts-mikro/generate-sync-metadata.ts
// Generates:
// - Table registry with metadata (hasClientId, hasVersion, softDelete)
// - Sync operations config per table
// - Type-safe table lookup functions
// - Conflict resolution strategies
```

### 2.2 Enhance Drizzle Schema Generator
```typescript
// Add to existing generator:
// - Export table name mappings
// - Export column name mappings  
// - Export relationship metadata
// - Export index definitions
```

### 2.3 Create Generic Query Generator
```typescript
// packages/dataforge/src/scripts-mikro/generate-generic-queries.ts
// Generates type-safe functions:
// - findById(table, id)
// - findMany(table, where, options)
// - upsert(table, data)
// - softDelete(table, id)
```

### 2.4 Update Build Pipeline
```json
// package.json
"scripts": {
  "generate": "npm run generate:entities && npm run generate:drizzle && npm run generate:sync && npm run generate:queries",
  "generate:entities": "tsx src/scripts-mikro/generate-entities.ts",
  "generate:drizzle": "tsx src/scripts-mikro/generate-drizzle-schema.ts",
  "generate:sync": "tsx src/scripts-mikro/generate-sync-metadata.ts",
  "generate:queries": "tsx src/scripts-mikro/generate-generic-queries.ts"
}
```

## Phase 3: Generic Sync Engine (Day 3-4)

### 3.1 Create Core Sync Engine
```typescript
// apps/server/src/sync/sync-engine.ts
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@repo/dataforge/drizzle-schema';
import { syncMetadata } from '@repo/dataforge/sync-metadata';

export class SyncEngine {
  constructor(private db: DrizzleClient) {}
  
  async processLocalChanges() {
    const changes = await this.db.select().from(schema.localchanges);
    
    for (const change of changes) {
      const tableConfig = syncMetadata[change.table_name];
      if (!tableConfig) continue;
      
      await this.applyChange(tableConfig, change);
    }
  }
  
  async applyChange(config: TableConfig, change: LocalChange) {
    const table = schema[config.tableName];
    
    switch(change.operation_type) {
      case 'UPSERT':
        await this.db.insert(table)
          .values(change.data)
          .onConflictDoUpdate({
            target: config.conflictColumns,
            set: change.data
          });
        break;
      
      case 'DELETE':
        if (config.softDelete) {
          await this.db.update(table)
            .set({ deleted: true })
            .where(eq(table.id, change.record_id));
        } else {
          await this.db.delete(table)
            .where(eq(table.id, change.record_id));
        }
        break;
    }
    
    // Update sync metadata
    await this.updateSyncMetadata(config.tableName, change);
  }
}
```

### 3.2 Replace Domain-Specific Sync
```typescript
// Before: apps/server/src/domains/tasks.ts
// Has TaskRepository with specific sync logic

// After: Removed - handled by generic sync engine
```

### 3.3 Create Sync API
```typescript
// apps/server/src/api/sync.ts
const syncRouter = new Hono();

syncRouter.post('/sync', async (c) => {
  const engine = new SyncEngine(drizzleClient);
  await engine.processLocalChanges();
  return c.json({ success: true });
});

syncRouter.post('/sync/:table', async (c) => {
  const { table } = c.params;
  const data = await c.req.json();
  
  // Generic upsert for any table
  const tableSchema = schema[table];
  await db.insert(tableSchema).values(data)
    .onConflictDoUpdate({ 
      target: tableSchema.id,
      set: data 
    });
    
  return c.json({ success: true });
});
```

## Phase 4: API Migration (Day 4-5)

### 4.1 Create Generic CRUD API
```typescript
// apps/server/src/api/crud.ts
const crudRouter = new Hono();

// Works for ANY table
crudRouter.get('/:table', async (c) => {
  const { table } = c.params;
  const results = await db.select().from(schema[table]);
  return c.json(results);
});

crudRouter.get('/:table/:id', async (c) => {
  const { table, id } = c.params;
  const result = await db.select()
    .from(schema[table])
    .where(eq(schema[table].id, id))
    .limit(1);
  return c.json(result[0]);
});

crudRouter.post('/:table', async (c) => {
  const { table } = c.params;
  const data = await c.req.json();
  const result = await db.insert(schema[table])
    .values(data)
    .returning();
  return c.json(result[0]);
});
```

### 4.2 Custom Endpoints Only When Needed
```typescript
// apps/server/src/api/custom/task-gantt.ts
// Only for complex business logic that can't be generic

export async function getTasksWithDependencies(projectId: string) {
  // Complex query with joins and custom logic
  const tasks = await db.query.tasks.findMany({
    where: eq(tasks.projectId, projectId),
    with: {
      dependencies: true,
      assignee: true
    }
  });
  
  // Custom gantt-specific transformations
  return transformForGantt(tasks);
}
```

## Phase 5: Migration System (Day 5)

### 5.1 Set Up MikroORM Migrations
```bash
# Initialize MikroORM migrations
npx mikro-orm migration:create Initial

# This creates a snapshot of current schema
npx mikro-orm schema:create --dump
```

### 5.2 Migration Commands
```json
// package.json
"migration:create": "mikro-orm migration:create",
"migration:up": "mikro-orm migration:up",
"migration:down": "mikro-orm migration:down",
"migration:fresh": "mikro-orm schema:fresh"
```

### 5.3 Convert Critical Migrations
Only convert migrations that contain:
- Triggers
- Functions  
- Complex constraints
- Data transformations

Let TypeORM migration history remain as-is.

## Phase 6: Remove TypeORM (Day 6)

### 6.1 Remove Dependencies
```bash
pnpm remove typeorm reflect-metadata @nestjs/typeorm
pnpm remove class-validator class-transformer
pnpm remove typeorm-extension
```

### 6.2 Delete TypeORM Files
```bash
rm -rf packages/dataforge/src/entities  # TypeORM entities
rm -rf packages/dataforge/src/repositories
rm -rf apps/server/src/domains  # Domain-specific repositories
```

### 6.3 Update Imports
```typescript
// Before
import { Task } from '@repo/dataforge/server-entities';
import { TaskRepository } from '@/domains/tasks';

// After  
import * as schema from '@repo/dataforge/drizzle-schema';
import { SyncEngine } from '@/sync/sync-engine';
```

## Phase 7: Testing & Validation (Day 6-7)

### 7.1 Create Test Suite
```typescript
// tests/sync-engine.test.ts
describe('Generic Sync Engine', () => {
  it('should sync any table without domain files', async () => {
    // Insert local change for a task
    await db.insert(schema.localchanges).values({
      table_name: 'task',
      record_id: 'task-1',
      operation_type: 'UPSERT',
      data: { title: 'Test Task' }
    });
    
    // Run sync
    await syncEngine.processLocalChanges();
    
    // Verify task was created
    const task = await db.select()
      .from(schema.task)
      .where(eq(schema.task.id, 'task-1'));
    expect(task[0].title).toBe('Test Task');
  });
});
```

### 7.2 Validate Core Flows
- [ ] User CRUD operations
- [ ] Task creation with dependencies
- [ ] Project management
- [ ] Sync from client to server
- [ ] Conflict resolution
- [ ] Soft deletes

## Benefits of This Approach

1. **No Domain Files Required**: New entities are automatically syncable
2. **Type Safety**: Generated types ensure compile-time safety
3. **Smaller Bundle**: ~70% reduction in server bundle size
4. **Simpler Mental Model**: Entities → Schema → Generic Operations
5. **Faster Development**: No boilerplate for new entities
6. **Better Performance**: Drizzle's lightweight runtime

## Success Metrics

- [ ] All tests passing
- [ ] Bundle size reduced by >60%
- [ ] No TypeORM imports remaining
- [ ] Generic sync working for all tables
- [ ] New entity can be added without writing any domain code

## Quick Start After Migration

```bash
# Add new entity
1. Create entity in packages/dataforge/src/entities-mikro/NewEntity.ts
2. Run: pnpm generate
3. Run: pnpm migration:create AddNewEntity
4. Run: pnpm migration:up

# Entity is now:
- Queryable via Drizzle
- Syncable via generic engine  
- Available in API via /:table endpoints
- No domain file needed!
```

## Rollback Plan

Since we're not doing parallel systems:
```bash
git checkout main
pnpm install
# Back to TypeORM
```

The key is to commit at each phase completion for easy rollback points.