# CLAUDE.md - DataForge Package Guide

This file provides guidance to Claude Code when working with the DataForge package.

## Package Overview

DataForge is the data layer factory for VibeStack that generates schemas, types, migrations, and sync tools for both server (PostgreSQL) and client (Dexie/IndexedDB) databases.

## Key Architecture Decisions

### Database Strategy
- **Server**: PostgreSQL (via TypeORM)
- **Client**: Dexie (IndexedDB wrapper)
- **No PGlite**: We removed PGlite in favor of Dexie for better performance and simpler architecture

### Entity Organization
- Entities are defined in `src/entities/` using TypeORM decorators
- Three categories: `@TableCategory('domain')`, `@TableCategory('system')`, `@TableCategory('utility')`
- Context-specific entities: `@ServerOnly()`, `@ClientOnly()`, or shared (default)

## Code Generation Flow

### 1. Entity Generation (`generate-entities`)
- Reads TypeORM entities from `src/entities/`
- Generates `client-entities.ts` and `server-entities.ts`
- Handles enums with `@EnumTypeName()` decorator
- Respects `@ServerOnly()` and `@ClientOnly()` decorators

### 2. CRUD Operations (`generate-crud-operations`)
- Generates type-safe CRUD operations for domain entities
- Creates individual operation files per entity
- Handles relationships and many-to-many junction tables

### 3. Client Schema (`generate-client-schema`)
- Generates Dexie schema with TypeScript types
- Auto-detects indexes from:
  - `@DexieIndex()` decorator (custom client indexes)
  - Foreign key relationships
  - Common fields (updatedAt, clientId)
- Manages schema versioning automatically

### 4. Client Services (`generate-client-services`)
- Generates Dexie domain services for client-side data operations
- Provides hooks and reactive queries
- Handles relationships and data fetching

## Index Strategy

### Server Indexes (PostgreSQL)
- **Automatic by TypeORM**:
  - Primary keys (`id`)
  - Foreign keys (all relationships)
  - Unique constraints (`unique: true`)
- **Custom indexes**: Add via migrations or `@Index()` decorator

### Client Indexes (Dexie)
- **Automatic detection**:
  - Primary key (`id`)
  - Foreign keys from relationships
  - Common query fields (updatedAt, clientId)
- **Custom indexes**: Use `@DexieIndex()` decorator on entity properties
- **Entity-specific**: Hardcoded in `generateEntityIndexes()` for special cases

## Environment Management

### Development Environments

DataForge maintains two development database configurations:

- **`.env.development`** - Primary development configuration (typically points to remote/Neon)
- **`.env.local`** - Local PostgreSQL configuration (used by migration:*:local commands)

### Development Philosophy

In development, we always keep both local and remote databases in sync. When making entity changes:
- Migrations are generated once (using remote schema)
- Migrations are run on BOTH databases automatically
- This ensures consistency across all development environments

## Important Commands

### Development Workflow
```bash
# Full generation pipeline
pnpm generate

# Individual generation steps
pnpm generate-entities        # Generate entity exports
pnpm generate-crud-operations # Generate CRUD operations
pnpm generate-client-schema   # Generate Dexie schema
pnpm generate-client-services # Generate Dexie services

# Shortcuts
pnpm forge:build   # Full build (generate + compile)
pnpm forge:client  # Just regenerate client schema
```

### Migration Commands
```bash
# Generate new migration
pnpm migration:generate:server -- src/migrations/server/MigrationName

# Run migrations
pnpm migration:run:server
pnpm migration:run:server:dev
pnpm migration:run:server:staging
pnpm migration:run:server:prod

# Show migration status
pnpm migration:show:server
```

## Testing

### Running Tests
```bash
pnpm test                          # Run all tests
pnpm test dexie-schema-generation  # Test Dexie schema generation
```

### Key Test Areas
- Dexie schema generation and index detection
- Entity metadata extraction
- CRUD operation generation
- Schema versioning

## Common Tasks

### Entity Change Workflow

When making any changes to entities (adding new entities, modifying fields, changing relationships), follow this workflow:

#### Quick Commands

```bash
# Option 1: Semi-automated (recommended)
# Rebuilds everything and reminds you about migrations
pnpm entity:update

# Option 2: Fully automated with confirmation
# Rebuilds, generates migration, asks for confirmation, then runs on BOTH databases
pnpm entity:update:full

# Option 3: Fully automated without confirmation (use with caution!)
# Rebuilds, generates migration, and runs on both databases immediately
pnpm entity:update:full --yes

# Option 4: With custom migration name
pnpm entity:update:full AddPriorityToTask
pnpm entity:update:full AddPriorityToTask --yes  # Skip confirmation

# Option 5: Manual steps (for complex changes)
# Follow the detailed workflow below
```

The `entity:update:full` command ensures both your local and remote databases stay in sync by:
1. Generating a single migration from the remote schema
2. Running the migration on BOTH local and remote databases
3. This prevents schema drift between development environments

#### 1. Make Entity Changes
```bash
# Edit entity files in src/entities/
# Examples:
# - Add new fields with @Column()
# - Add new relationships with @ManyToOne(), @OneToMany(), etc.
# - Add new entities extending BaseDomainEntity or BaseSystemEntity
# - Modify existing fields or relationships
```

#### 2. Generate Updated Code
```bash
# From packages/dataforge directory:
pnpm forge:build

# Or run steps individually:
pnpm generate-entities        # Updates client-entities.ts and server-entities.ts
pnpm generate-crud-operations # Updates CRUD operations for domain entities
pnpm generate-client-schema   # Updates Dexie schema (may increment version)
pnpm generate-client-services # Updates Dexie domain services
pnpm compile                  # Compiles TypeScript
```

#### 3. Generate Migration (IMPORTANT!)
```bash
# Generate a migration to update the database schema
pnpm migration:generate:server -- src/migrations/server/DescriptiveMigrationName

# Example:
pnpm migration:generate:server -- src/migrations/server/AddPriorityToTask
```

#### 4. Review Generated Migration
- Check the generated migration file in `src/migrations/server/`
- Ensure it contains the expected changes
- Add any custom SQL if needed (indexes, constraints, data migrations)

#### 5. Run Migration
```bash
# Run on local database
pnpm migration:run:server

# Or for specific environments:
pnpm migration:run:server:dev
pnpm migration:run:server:staging
pnpm migration:run:server:prod
```

#### 6. Update Trigger (if adding domain tables)
If you added new domain tables, create a trigger migration:
```bash
# Copy the template
cp src/triggers/client-id-trigger.template.ts src/migrations/server/$(date +%s000)-AddClientIdTriggerForNewTables.ts

# Edit the file to update the timestamp in class name and name property
# Run the migration
pnpm migration:run:server
```

#### 7. Test Your Changes
```bash
# Run tests
pnpm test

# Build everything to ensure no TypeScript errors
cd ../.. # to monorepo root
pnpm build
```

#### 8. Commit Your Changes
```bash
# Ensure all generated files are included
git add .
git commit -m "feat: add priority field to tasks"
```

### Common Scenarios

#### Adding a New Field
```typescript
// In src/entities/Task.ts
@Column({ type: 'integer', default: 0 })
priority: number;

// Then run:
pnpm forge:build
pnpm migration:generate:server -- src/migrations/server/AddPriorityToTask
pnpm migration:run:server
```

#### Adding a New Relationship
```typescript
// In src/entities/Task.ts
@ManyToOne(() => Category, category => category.tasks)
@JoinColumn({ name: 'category_id' })
category: Category;

@Column({ type: 'uuid', nullable: true })
categoryId: string;

// Then run the full workflow above
```

#### Adding a New Entity
1. Create entity file in `src/entities/`
2. Extend `BaseDomainEntity` or `BaseSystemEntity`
3. Add `@TableCategory()` decorator
4. Add `@EnumTypeName()` for enum properties
5. Export from `src/entities/index.ts`
6. Run the full workflow above

### Adding Custom Client Index
```typescript
import { DexieIndex } from '../utils/context.js';

@Entity('my_table')
export class MyEntity extends BaseDomainEntity {
  @Column()
  @DexieIndex() // This field will be indexed in Dexie
  myIndexedField: string;
}
```

### Adding Server Index
Use TypeORM's `@Index()` decorator or add in migration:
```typescript
// In entity
@Index(['field1', 'field2'])
@Entity('my_table')
export class MyEntity { ... }

// Or in migration
await queryRunner.query(`CREATE INDEX idx_name ON table(column)`);
```

## Troubleshooting

### Generation Issues
- Check `DEBUG_ORM=true` in `.env` for TypeORM logging
- Verify entity imports in `src/entities/index.ts`
- Check for circular dependencies in relationships

### Index Detection
- Client indexes require `@DexieIndex()` decorator
- Server indexes are auto-created for PKs, FKs, and unique fields
- Check `generateEntityIndexes()` in `generate-dexie-schema.ts` for hardcoded indexes

### Migration Errors
- Ensure database connection is correct
- Check for pending migrations with `migration:show:server`
- Verify entity changes before generating migrations

## Architecture Notes

### CRDT Support
- All domain entities have `client_id` field
- Last-write-wins conflict resolution
- Trigger-based integrity (see trigger templates)

### Relationship Handling
- Many-to-many creates junction tables automatically
- Junction tables get compound indexes
- Use `inverseSide` for bidirectional relationships

### Performance Considerations
- Indexes are crucial for sync performance
- Keep indexed fields minimal but sufficient
- Monitor Dexie schema size (affects initial load)

## Recent Changes (Issue #3)

### Removed
- PGlite support and dependencies
- Unused scripts (4 files)
- Unused package.json commands (18 total)
- All client migration commands

### Renamed
- `generate-dexie-*` → `generate-client-*`
- `forge:dexie` → `forge:client`

### Key Decision
We standardized on "client" naming for all Dexie-related operations to improve discoverability and reduce confusion between server and client code generation.