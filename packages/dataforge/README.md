# @repo/dataforge

A powerful data layer factory that forges the foundation of VibeStack's data architecture. DataForge crafts schemas, types, migrations, and sync tools for both server and client databases.

## Features

🔨 **Schema Forging**
- Database schema definitions
- Type-safe interfaces
- Migration management
- Dual-database support (PostgreSQL/PGlite)

⚡ **Type Generation**
- Build-time type safety
- Generated TypeScript interfaces
- IDE support
- Zero runtime overhead

🔄 **Sync Architecture**
- CRDT support
- Last-write-wins semantics
- Change tracking
- Conflict resolution

🏗️ **Future Capabilities**
- API endpoint generation
- Client SDK forging
- Query builder crafting
- State management tools
- Development utilities

## Quick Start

1. Define your schema in `src/entities/`
2. Forge your types with `pnpm run forge:build`
3. Generate migrations with `pnpm run forge:migrate generate <YourMigrationName>`
4. Deploy with `pnpm run deploy <YourMigrationName>` (or use root command `pnpm run forge:deploy <YourMigrationName>`)

## Architecture

DataForge provides type safety through multiple layers:

1. **Build Time**
   - TypeScript interfaces
   - Schema validation
   - Relationship checking

2. **Runtime**
   - Database constraints
   - Foreign key integrity
   - Unique constraints
   - Check constraints

3. **Deployment**
   - Migration safety
   - Schema verification
   - Type consistency

## Development Guide

### Creating Schemas

1. Create file in `src/entities/`
2. Define your schema with decorators
3. Run `pnpm run forge:build` to forge types
4. Generate migrations (`pnpm run forge:migrate generate <YourMigrationName>`) and then run them (`pnpm run forge:migrate run` or use the full `pnpm run deploy <YourMigrationName>` flow).

### Defining Enums

Enums (e.g., `TaskStatus`) are typically defined within the same TypeScript file as the primary entity that uses them (e.g., [`Task.ts`](src/entities/Task.ts) in `src/entities/`).

For all properties that are enums, it is **mandatory** to use the `@EnumTypeName({ name: 'YourEnumName', sourcePath: './YourEntityFileWithoutExtension' })` decorator. This decorator is imported from `../utils/decorators.js` (relative to the entity file where it's used).

-   `name`: This must be a string that exactly matches the TypeScript enum's name (e.g., `'TaskStatus'`).
-   `sourcePath`: This is a string representing the relative path to the file containing the enum definition, from the entity file where `@EnumTypeName` is used.
    -   For enums co-located with their entity (e.g., `TaskStatus` defined in `Task.ts` and used in `Task.ts`), the `sourcePath` would be `'./Task'`.
    -   For enums defined in a shared location: If an enum `MySharedEnum` is defined in `packages/dataforge/src/enums/my-shared-enums.ts` and used in an entity `packages/dataforge/src/entities/SomeEntity.ts`, the `sourcePath` in `SomeEntity.ts` would be `'../enums/my-shared-enums'`.

This decorator is crucial for the entity generation process to correctly reference and re-export enum types.

### Table Categories

- **Domain**: `@TableCategory('domain')` - Business data, replicated
- **System**: `@TableCategory('system')` - Internal state
- **Utility**: `@TableCategory('utility')` - Logs, analytics

### Client and Server Contexts

DataForge allows you to define entities and their properties specifically for client-side or server-side consumption using decorators imported from `../utils/context.js` (relative to the entity file where they are used):

-   `@ServerOnly()`: Marks an entity class or a property within an entity to be included only in server-side generated files (e.g., for fields that should not be exposed to the client).
-   `@ClientOnly()`: Marks an entity class or a property to be included only in client-side generated files.

If an entity class is not decorated with either `@ServerOnly()` or `@ClientOnly()`, it is considered a "shared" entity. Shared entities are included in both client-side (`client-entities.ts`) and server-side (`server-entities.ts`) generated files. However, individual properties within a shared entity can still be marked with `@ServerOnly()` or `@ClientOnly()` to control their inclusion in respective contexts.

The entity generation script, [`packages/dataforge/src/build/generate-entities.ts`](src/build/generate-entities.ts), utilizes these decorators to filter which entities and properties are included in the final `src/generated/client-entities.ts` and `src/generated/server-entities.ts` modules.

### Consuming Entities and Enums

The primary way to consume entities, their associated enums, and other generated artifacts within the monorepo applications is through the generated modules:

**Client-Side (e.g., `apps/web`)**

For client-side applications like `apps/web`, import entities and enums from `@repo/dataforge/client-entities`:

```typescript
// Example for apps/web/src/...
import { Task, TaskStatus, User } from '@repo/dataforge/client-entities';
```

**Server-Side (e.g., `apps/server`)**

For server-side applications like `apps/server`, import entities, enums, and server-specific constants (like `SERVER_DOMAIN_TABLES`) from `@repo/dataforge/server-entities`:

```typescript
// Example for apps/server/src/...
import { Account, UserRole, SERVER_DOMAIN_TABLES } from '@repo/dataforge/server-entities';
```

**Explanation:**

These package aliases (`@repo/dataforge/client-entities` and `@repo/dataforge/server-entities`) are configured to resolve to the compiled output located in the `packages/dataforge/dist/` directory.

The generated modules provide:
-   Plain TypeScript classes for entities, ensuring type-checking and IntelliSense.
-   TypeORM `EntitySchema` objects for each entity, which are used internally by TypeORM DataSources.
-   Re-exported enums that were originally defined in `src/entities/` or `src/enums/`, making them easily accessible alongside their related entities.

### Commands

All commands can be run from the root of the monorepo using `pnpm run <root_script_name> <args>` (e.g., `pnpm run forge:build`) or from within the `packages/dataforge` directory using `pnpm run <package_script_name> <args>` (e.g., `pnpm run forge:build`).

**Build & Compile:**
-   Purpose: Generates entities based on your schema definitions and compiles the TypeScript code. This is the first step after changing entities.
-   From `packages/dataforge`:
    ```bash
    pnpm run forge:build
    ```
-   From monorepo root:
    ```bash
    pnpm run forge:build
    ```

**Migrations:**
-   **Generate Migration Files:**
    -   Purpose: Creates new migration files in `src/migrations/server/` and `src/migrations/client/` based on changes detected in your entities. Requires a descriptive migration name.
    -   From `packages/dataforge`:
        ```bash
        pnpm run forge:migrate generate <YourMigrationName>
        ```
    -   From monorepo root:
        ```bash
        pnpm run forge:migrate:generate <YourMigrationName>
        ```
-   **Run Pending Migrations:**
    -   Purpose: Applies all pending server migrations, then all pending client migrations, and finally uploads client migrations (if applicable).
    -   From `packages/dataforge`:
        ```bash
        pnpm run forge:migrate run
        ```
    -   From monorepo root:
        ```bash
        pnpm run forge:migrate:run
        ```

**Deploy (Full Workflow):**
-   Purpose: A comprehensive command that bundles building entities, generating a new migration based on current entity changes, and then running all pending migrations. Requires a descriptive migration name for the generation step.
-   From `packages/dataforge`:
    ```bash
    pnpm run deploy <YourMigrationName>
    ```
    *(This internally runs: `forge:build` → `forge:migrate generate <YourMigrationName>` → `forge:migrate run`)*
-   From monorepo root:
    ```bash
    pnpm run forge:deploy <YourMigrationName>
    ```

## Project Structure

```
src/
  ├── entities/           # Schema definitions
  ├── migrations/         # Forged migrations
  │   ├── server/        # Server migrations
  │   └── client/        # Client migrations
  └── generated/         # Forged types and exports
```

## Best Practices

1. Define schemas clearly and completely
2. Let TypeScript and Postgres handle validation
3. Use appropriate deployment commands
4. Keep migrations atomic
5. Document dependencies
6. Trust the type system

## CRDT Support

DataForge provides built-in CRDT support through:
- Automatic client ID management
- Last-write-wins conflict resolution
- Change tracking and history
- Trigger-based integrity

### Client ID Trigger

Domain tables that participate in CRDT operations require a special trigger to handle `client_id` behavior. This trigger ensures proper last-write-wins semantics by:
- Preserving `client_id` only when explicitly set in an update
- Resetting `client_id` to NULL when not changed in an update

After creating new domain tables, you must create a migration to add this trigger. A template is provided in `src/triggers/client-id-trigger.template.ts`. To use it:

1. Copy the template to `src/migrations/server/` with a new timestamp
2. Update the timestamp in the class name and `name` property
3. Run `pnpm run migration:run:server`

Example usage:
```bash
# Copy template (replace timestamp with current)
cp src/triggers/client-id-trigger.template.ts src/migrations/server/1742067963372-AddDomainTableClientIdTriggers.ts

# Update timestamp in the file
# Run migration
pnpm run migration:run:server
```

### Testing Trigger Behavior

You can test the trigger behavior using the TypeORM datasource:

```typescript
// Update with new client_id (will be preserved)
const result = await serverDataSource.query(
  "UPDATE users SET name = $1, client_id = uuid_generate_v4() WHERE id = $2 RETURNING *",
  ["Test User", userId]
);

// Update without client_id (will be reset to NULL)
const followup = await serverDataSource.query(
  "UPDATE users SET name = $1 WHERE id = $2 RETURNING *",
  ["Another Update", userId]
);
```

## License

Private and proprietary.