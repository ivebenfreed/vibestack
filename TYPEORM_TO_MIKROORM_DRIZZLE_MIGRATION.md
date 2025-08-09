# TypeORM → MikroORM + Drizzle Migration Plan

## Goal
Remove TypeORM completely, using:
- **MikroORM**: For entity definitions, build-time generation, and migrations
- **Drizzle**: For runtime queries on the server
- **Dexie**: Remains unchanged for client-side

## Architecture Overview

```
Current:
TypeORM Entities → TypeORM Generators → TypeORM Runtime Queries
                 → Dexie Generators  → Dexie Runtime

Target:
MikroORM Entities → MikroORM Generators → Drizzle Runtime Queries
                  → Dexie Generators    → Dexie Runtime (unchanged)
                  → Migration System
```

## Phase 1: Parallel Setup (Week 1)
**Goal**: Run MikroORM alongside TypeORM without breaking anything

### Step 1.1: Configure MikroORM in dataforge
```bash
cd packages/dataforge
pnpm add @mikro-orm/core @mikro-orm/postgresql @mikro-orm/cli @mikro-orm/migrations
```

### Step 1.2: Create MikroORM config
- Copy mikro-orm.config.ts from dataforge-next
- Point to same database as TypeORM
- Configure to read TypeORM's migration table to avoid conflicts

### Step 1.3: Dual Entity Definitions
```typescript
// Keep existing: src/entities/Task.ts (TypeORM)
// Add parallel:   src/entities-mikro/Task.ts (MikroORM)
```

### Step 1.4: Test Generation
- Run MikroORM generators alongside TypeORM
- Compare outputs to ensure parity
- Both should generate identical schemas

**Validation**: `pnpm test` still passes, both ORMs generate same schema

## Phase 2: Replace Generators (Week 2)
**Goal**: Use MikroORM for all code generation, TypeORM only for runtime

### Step 2.1: Update generate-entities.ts
```typescript
// Replace TypeORM metadata extraction with MikroORM
import { MikroORM } from '@mikro-orm/core';
// Use MikroORM.init() and metadata.get()
```

### Step 2.2: Update generate-dexie-schema.ts
- Use MikroORM metadata for Dexie schema generation
- Ensure indexes match current behavior

### Step 2.3: Generate Drizzle Schema
- Use MikroORM's complete field information
- Generate drizzle-schema.ts with all inherited fields

### Step 2.4: Update build scripts
```json
// package.json
"generate": "tsx generate-with-mikroorm.ts",
"generate:validate": "tsx compare-outputs.ts" // Ensure outputs match
```

**Validation**: Generated files identical except Drizzle has complete fields

## Phase 3: Server Query Migration (Week 3-4)
**Goal**: Replace TypeORM queries with Drizzle, one domain at a time

### Step 3.1: Create Drizzle Repository Pattern
```typescript
// src/repositories/drizzle/TaskRepository.ts
export class TaskDrizzleRepository {
  constructor(private db: DrizzleClient) {}
  
  async findOne(id: string) {
    return db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  }
  
  // Match existing TypeORM repository methods
}
```

### Step 3.2: Parallel Repository System
```typescript
// Keep existing: src/repositories/TaskRepository.ts (TypeORM)
// Add parallel:   src/repositories-drizzle/TaskRepository.ts (Drizzle)

// In test files or new endpoints:
import { TaskRepository as TaskDrizzleRepo } from '@/repositories-drizzle/TaskRepository';
import { TaskRepository as TaskTypeORMRepo } from '@/repositories/TaskRepository';
```

### Step 3.3: Migrate One Domain at a Time
Order of migration (least risky first):
1. **User** - Simple queries, fewer relationships
2. **Comment** - Straightforward CRUD
3. **Project** - Moderate complexity
4. **Task** - Most complex, many relationships
5. **System tables** - LocalChanges, SyncMetadata, etc.

### Step 3.4: Parallel Testing
```typescript
// src/test/compare-implementations.test.ts
describe('TypeORM vs Drizzle Comparison', () => {
  it('should return identical results for user queries', async () => {
    const typeormResult = await typeormUserRepo.findOne(userId);
    const drizzleResult = await drizzleUserRepo.findOne(userId);
    expect(drizzleResult).toEqual(typeormResult);
  });
});
```

**Validation**: Each domain works identically with both ORMs

## Phase 4: Migration System (Week 4)
**Goal**: Use MikroORM for migrations, retire TypeORM migrations

### Step 4.1: Set up MikroORM Migrations
```typescript
// mikro-orm.config.ts
migrations: {
  path: './src/migrations',
  glob: '!(*.d).{js,ts}',
  snapshot: false, // Use explicit migrations like TypeORM
}
```

### Step 4.2: Convert Existing Migrations
- Keep migration history intact
- Create MikroORM migration that marks all TypeORM migrations as run
- Future migrations use MikroORM CLI

### Step 4.3: Migration Commands
```json
"migration:create": "mikro-orm migration:create",
"migration:up": "mikro-orm migration:up",
"migration:down": "mikro-orm migration:down"
```

**Validation**: Can run migrations up and down without data loss

## Phase 5: Remove TypeORM (Week 5)
**Goal**: Complete removal of TypeORM dependencies

### Step 5.1: Remove TypeORM Entities
```bash
rm -rf src/entities
mv src/entities-mikro src/entities
```

### Step 5.2: Remove TypeORM Dependencies
```bash
pnpm remove typeorm @nestjs/typeorm
pnpm remove class-validator class-transformer
```

### Step 5.3: Clean up Imports
- Update all imports from 'typeorm' to MikroORM/Drizzle
- Remove decorators from server code
- Update repository patterns

### Step 5.4: Final Validation
- Full test suite passes
- Build succeeds
- All endpoints working
- Migrations run successfully

**Validation**: No TypeORM references remain, all tests pass

## Incremental Testing Strategy

### After Each Step:
1. **Unit Tests**: Run existing test suite
2. **Integration Tests**: Test API endpoints
3. **Build Test**: Ensure `pnpm build` succeeds
4. **Generation Test**: Verify generated files are correct
5. **Migration Test**: Run migrations up and down

### Rollback Plan for Each Phase:
- **Phase 1**: Remove MikroORM files, no impact
- **Phase 2**: Revert generator changes, use git
- **Phase 3**: Feature flags allow instant rollback
- **Phase 4**: Keep TypeORM migrations as backup
- **Phase 5**: Full git revert if needed

## Success Metrics

### Performance:
- [ ] Bundle size reduced by >60%
- [ ] Query performance same or better
- [ ] Build time improved

### Code Quality:
- [ ] Generated files 80% smaller
- [ ] No circular dependencies
- [ ] Better TypeScript inference

### Functionality:
- [ ] All tests passing
- [ ] All endpoints working
- [ ] Migrations functioning
- [ ] No data loss

## Risk Mitigation

### High Risk Areas:
1. **Complex Queries**: Task dependencies, recursive queries
   - Mitigation: Implement these first in test environment
   
2. **Migration History**: Preserving existing migrations
   - Mitigation: Keep TypeORM migration table, reference in MikroORM

3. **Relationship Loading**: Eager/lazy loading differences
   - Mitigation: Explicit joins in Drizzle, test thoroughly

4. **Transaction Handling**: Different transaction APIs
   - Mitigation: Abstract transaction logic, test edge cases

## Timeline

- **Week 1**: Parallel setup, no production impact
- **Week 2**: Generator replacement, validate outputs
- **Week 3-4**: Incremental query migration with feature flags
- **Week 4**: Migration system transition
- **Week 5**: TypeORM removal and cleanup
- **Week 6**: Buffer for testing and fixes

Total: 6 weeks with incremental validation at each step

## Commands Quick Reference

```bash
# Development flow
pnpm mikro:generate    # Generate from MikroORM entities
pnpm drizzle:validate  # Ensure Drizzle schema is correct
pnpm test:parallel     # Run tests with both ORMs

# Migration flow  
pnpm mikro:migration:create AddFieldToTask
pnpm mikro:migration:up
pnpm mikro:migration:status

# Validation
pnpm compare:outputs   # Compare TypeORM vs MikroORM generation
pnpm test:drizzle      # Test Drizzle queries
pnpm audit:deps        # Ensure no TypeORM remains
```

## Next Immediate Steps

1. Create `src/entities-mikro/` folder with first entity (User)
2. Set up MikroORM config to read this entity
3. Generate outputs and compare with TypeORM
4. Create test to ensure both produce same results
5. Proceed to next entity only after validation