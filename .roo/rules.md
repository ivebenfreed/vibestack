# DataForge Package Rules (`packages/dataforge`)

This document outlines the rules and processes for managing entities, client/server export file generation, and the migration process within the `packages/dataforge` package.

## 1. Entity Management

Entities are the core of the data model and are defined in TypeScript.

**Location:**
- Entity definition files are located in [`packages/dataforge/src/entities/`](packages/dataforge/src/entities/).

**Definition:**
- Entities are TypeScript classes.
- They typically extend a base entity class like `BaseDomainEntity` (e.g., [`Task.ts`](packages/dataforge/src/entities/Task.ts:18) extends `BaseDomainEntity`) which provides common fields (e.g., `id`, `created_at`, `updated_at`, `client_id`).
- **TypeORM Decorators**: Standard TypeORM decorators (`@Entity()`, `@Column()`, `@ManyToOne()`, `@ManyToMany()`, `@JoinColumn()`, `@JoinTable()`, etc.) are used to define the database schema, relationships, and column types. (See [`Task.ts`](packages/dataforge/src/entities/Task.ts:1) for examples).
- **Validation Decorators**: `class-validator` decorators (e.g., `@IsString()`, `@MinLength()`, `@IsOptional()`, `@IsEnum()`, `@IsUUID()`) are used for data validation. (See [`Task.ts`](packages/dataforge/src/entities/Task.ts:2) for examples).
- **Enum Type Names**: For enum properties, use the `@EnumTypeName('YourEnumName')` decorator (imported from [`packages/dataforge/src/utils/decorators.ts`](packages/dataforge/src/utils/decorators.ts:1)) to ensure correct type generation. (e.g. [`Task.status`](packages/dataforge/src/entities/Task.ts:58)).
- **Client/Server Designation**:
    - Entities and their properties can be designated as server-only or client-only using `@ServerOnly()` and `@ClientOnly()` decorators, respectively. These are imported from [`packages/dataforge/src/utils/context.ts`](packages/dataforge/src/utils/context.ts:1).
    - `@ServerOnly()`: Marks an entity or property to be included only in server-side generated files.
    - `@ClientOnly()`: Marks an entity or property to be included only in client-side generated files.
    - If an entity is not explicitly marked with `@ServerOnly()` or `@ClientOnly()`, it is considered a shared entity (e.g., [`Task.ts`](packages/dataforge/src/entities/Task.ts:19) notes it's a shared entity).
    - The build script ([`packages/dataforge/src/build/generate-entities.ts`](packages/dataforge/src/build/generate-entities.ts:1)) uses helper functions like `shouldIncludeInServer()` and `shouldIncludeInClient()` (from [`packages/dataforge/src/utils/context.ts`](packages/dataforge/src/utils/context.ts:146)) to determine inclusion based on these decorators.
- **Relationships & Circular Dependencies**: For relationships, especially to avoid circular dependencies during type generation, related entities can be typed as `Promise<import('./OtherEntity.js').OtherEntity>`. (e.g. [`Task.project`](packages/dataforge/src/entities/Task.ts:102)).
- **Table Categories**: Entities should be categorized using the `@TableCategory()` decorator (from [`packages/dataforge/src/utils/context.ts`](packages/dataforge/src/utils/context.ts:94)) as described in [`README.md`](packages/dataforge/README.md:70):
    - `'domain'`: Business data, replicated.
    - `'system'`: Internal state.
    - `'utility'`: Logs, analytics.

**File Naming:**
- Entity files should be named descriptively, e.g., `User.ts`, `Project.ts`, [`Task.ts`](packages/dataforge/src/entities/Task.ts:1).

## 2. Client/Server Export File Generation

The package generates different sets of files and types for client-side and server-side usage.

**Build Process:**
- The primary build command is `pnpm run build` (defined in [`package.json`](packages/dataforge/package.json:38)), which executes `tsup`.
- **Entity Generation Script**: Before the main build, `pnpm run generate:entities` (defined in [`package.json`](packages/dataforge/package.json:39)) is run. This script executes [`packages/dataforge/src/build/generate-entities.ts`](packages/dataforge/src/build/generate-entities.ts) and is responsible for preparing or generating entity-related files, likely including client-specific and server-specific versions.
- **Output Directory**: Compiled files and type definitions are placed in the [`packages/dataforge/dist/`](packages/dataforge/dist/) directory.
- **TSUP Configuration**: The [`tsup.config.cts`](packages/dataforge/tsup.config.cts:1) file defines the build entry points, including:
    - `src/index.ts`
    - `src/generated/client-entities.ts`
    - `src/generated/server-entities.ts`
    This configuration ensures separate bundles/types for client and server entities.
- **ESM Import Fixing**: The script [`packages/dataforge/fix-imports.js`](packages/dataforge/fix-imports.js:1) is available to add `.js` extensions to relative imports in TypeScript files, ensuring ESM compatibility. This might be part of an automated build step or run manually if needed.

**Consumed Files for Application Development (within this monorepo):**
- **Client Entities**: Developers should import directly from [`packages/dataforge/src/generated/client-entities.ts`](packages/dataforge/src/generated/client-entities.ts:1).
- **Server Entities**: Developers should import directly from [`packages/dataforge/src/generated/server-entities.ts`](packages/dataforge/src/generated/server-entities.ts:1).
- Note: While the package is built to `dist/` and has [`package.json`](packages/dataforge/package.json:6) "exports" for potential external consumption, internal application development within this monorepo typically consumes the entities directly from the `src/generated/` directory.

## 3. Migration Process

TypeORM is used for managing database schema migrations for both server (PostgreSQL) and client (PGlite) databases.

**Migration File Location:**
- Server migrations: [`packages/dataforge/src/migrations/server/`](packages/dataforge/src/migrations/server/)
- Client migrations: [`packages/dataforge/src/migrations/client/`](packages/dataforge/src/migrations/client/)

**Generating Migrations:**
- After making changes to entities, **first run `pnpm run generate:entities`** to ensure the generated entity files are up-to-date. Then, generate migration files using:
    - **Server**: `pnpm run migration:generate:server src/migrations/server/YourMigrationName` (from [`package.json`](packages/dataforge/package.json:43))
    - **Client**: `pnpm run migration:generate:client src/migrations/client/YourMigrationName` (from [`package.json`](packages/dataforge/package.json:44))
- These commands utilize the TypeORM CLI with the appropriate datasource configuration ([`src/datasources/server.ts`](packages/dataforge/src/datasources/server.ts:1) or [`src/datasources/client.ts`](packages/dataforge/src/datasources/client.ts:1)).
- Migration files are timestamped automatically (e.g., [`1743537361332-SnakeCaseColumnsRename.ts`](packages/dataforge/1743537361332-SnakeCaseColumnsRename.ts:1)).

**Running Migrations:**
- Apply pending migrations using:
    - **Server**: `pnpm run migration:run:server` (from [`package.json`](packages/dataforge/package.json:45))
    - **Client**: `pnpm run migration:run:client` (from [`package.json`](packages/dataforge/package.json:46))

**Client Migration Upload:**
- For client databases that might be initialized or updated remotely (e.g., in a web worker environment):
    - `pnpm run migration:upload-client` (from [`package.json`](packages/dataforge/package.json:47))
    - This script ([`packages/dataforge/src/scripts/upload-client-migrations.ts`](packages/dataforge/src/scripts/upload-client-migrations.ts)) handles the process of making client migrations available.

**Deployment Commands:**
- **Full Deploy**: `pnpm run deploy` (from [`package.json`](packages/dataforge/package.json:48))
    - Runs server migrations.
    - Runs client migrations.
    - Uploads client migrations.
- **Client-Only Deploy**: `pnpm run deploy:client` (from [`package.json`](packages/dataforge/package.json:49))
    - Runs client migrations.
    - Uploads client migrations.

**CRDT `client_id` Trigger (Server Migrations):**
- For domain tables (`@TableCategory('domain')`) that participate in CRDT operations, a special database trigger is required to manage the `client_id` column correctly for last-write-wins semantics.
- **Procedure** (from [`README.md`](packages/dataforge/README.md:123)):
    1. Copy the template file [`packages/dataforge/src/triggers/client-id-trigger.template.ts`](packages/dataforge/src/triggers/client-id-trigger.template.ts:1) to `packages/dataforge/src/migrations/server/` with a new, current timestamp in its filename (e.g., `[timestamp]-AddMyTableClientIdTrigger.ts`).
    2. Edit the copied migration file: Update the class name and the `name` property within the class to reflect the new timestamp.
    3. Run the server migration: `pnpm run migration:run:server`.

**Best Practices for Migrations (from [`README.md`](packages/dataforge/README.md:100)):**
- Keep migrations atomic (each migration should represent a single, reversible change).
- Define schemas clearly and completely before generating migrations.
- Document dependencies if a migration relies on another.