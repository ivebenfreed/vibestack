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
- **Database-Level `CHECK` Constraints**: For ensuring data integrity directly within PostgreSQL, TypeORM's `@Check()` decorator can be applied at the entity level. This is particularly useful for complex validation rules or cross-field validations that must be enforced by the database.
    - Example: `@Check('chk_task_start_date_before_due_date', '("start_date" IS NULL OR "due_date" IS NULL) OR ("start_date" < "due_date")')` on an entity ensures that if both `start_date` and `due_date` are provided, the start date must be before the due date.
    - These constraints are translated into SQL `CHECK` constraints in the generated migrations.
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
- The core compilation is done by `tsup` (via `pnpm run compile` in [`package.json`](packages/dataforge/package.json:36)). However, the recommended command for a full build including entity generation is `pnpm run forge:build` (defined in [`package.json`](packages/dataforge/package.json:42)), which runs `pnpm run generate:entities` and then `pnpm run compile`.
- **Entity Generation Script**: Before the main build, `pnpm run generate:entities` (defined in [`package.json`](packages/dataforge/package.json:35)) is run. This script executes [`packages/dataforge/src/build/generate-entities.ts`](packages/dataforge/src/build/generate-entities.ts) and is responsible for preparing or generating entity-related files, likely including client-specific and server-specific versions. (Note: this script is part of `forge:build`).
- **Output Directory**: Compiled files and type definitions are placed in the [`packages/dataforge/dist/`](packages/dataforge/dist/) directory.
- **TSUP Configuration**: The [`tsup.config.cts`](packages/dataforge/tsup.config.cts:1) file defines the build entry points, including:
    - `src/index.ts`
    - `src/generated/client-entities.ts`
    - `src/generated/server-entities.ts`
    This configuration ensures separate bundles/types for client and server entities.

**Consumed Files for Application Development (within this monorepo):**
- **Client Entities**: Developers should import entities and enums using the package alias: `import { MyEntity, MyEnum } from '@repo/dataforge/client-entities';`
- **Server Entities**: Developers should import entities, enums, and generated constants using the package alias: `import { MyEntity, MyEnum, SERVER_DOMAIN_TABLES } from '@repo/dataforge/server-entities';`
- Note: These package aliases (`@repo/dataforge/client-entities` and `@repo/dataforge/server-entities`) are defined in `packages/dataforge/package.json` and resolve to the compiled output in the `packages/dataforge/dist/` directory. They provide plain TypeScript classes, TypeORM `EntitySchema` objects, and re-exported enums.

## 3. Migration Process

TypeORM is used for managing database schema migrations for both server (PostgreSQL) and client (PGlite) databases.

**Migration File Location:**
- Server migrations: [`packages/dataforge/src/migrations/server/`](packages/dataforge/src/migrations/server/)
- Client migrations: [`packages/dataforge/src/migrations/client/`](packages/dataforge/src/migrations/client/)

**Generating Migrations:**
- After making changes to entities, **first run `pnpm run forge:build`** (from within `packages/dataforge`) to ensure generated entities and compiled code are up-to-date.
- Then, generate migration files for both server and client simultaneously using the `forge:migrate` script:
    - `pnpm run forge:migrate generate <YourMigrationName>` (from within `packages/dataforge`, defined in [`package.json`](packages/dataforge/package.json:43))
    - Or from the monorepo root: `pnpm run forge:migrate:generate <YourMigrationName>`
- This command utilizes the [`packages/dataforge/src/scripts/manage-migrations.ts`](packages/dataforge/src/scripts/manage-migrations.ts) script, which in turn calls the underlying TypeORM CLI commands for server and client with the appropriate datasource configurations ([`src/datasources/server.ts`](packages/dataforge/src/datasources/server.ts:1) or [`src/datasources/client.ts`](packages/dataforge/src/datasources/client.ts:1)).
- Migration files are timestamped automatically.

**Running Migrations:**
- Apply all pending server migrations, then all pending client migrations, and upload client migrations using the `forge:migrate` script:
    - `pnpm run forge:migrate run` (from within `packages/dataforge`, defined in [`package.json`](packages/dataforge/package.json:43))
    - Or from the monorepo root: `pnpm run forge:migrate:run`
- This command utilizes the [`packages/dataforge/src/scripts/manage-migrations.ts`](packages/dataforge/src/scripts/manage-migrations.ts) script, which executes `pnpm run migration:run:server`, then `pnpm run migration:run:client`, then `pnpm run migration:upload-client`.
- The individual commands (`migration:run:server`, `migration:run:client`, `migration:upload-client`) still exist in [`package.json`](packages/dataforge/package.json) (lines 39, 40, 41 respectively) and are used by the `manage-migrations.ts` script.

**Client Migration Upload:**
- For client databases that might be initialized or updated remotely (e.g., in a web worker environment):
    - `pnpm run migration:upload-client` (from [`package.json`](packages/dataforge/package.json:47))
    - This script ([`packages/dataforge/src/scripts/upload-client-migrations.ts`](packages/dataforge/src/scripts/upload-client-migrations.ts)) handles the process of making client migrations available.

**New Deployment Workflow Command:**
- A comprehensive `deploy` command is now available in `packages/dataforge` to streamline the full process of building, generating a new migration, and running all migrations.
    - From `packages/dataforge`: `pnpm run deploy <YourMigrationName>` (defined in [`package.json`](packages/dataforge/package.json:44))
    - From monorepo root: `pnpm run forge:deploy <YourMigrationName>`
- This command executes the following sequence:
    1. `pnpm run forge:build` (generates entities and compiles)
    2. `pnpm run forge:migrate generate <YourMigrationName>` (generates server and client migration files)
    3. `pnpm run forge:migrate run` (runs all server and client migrations, and uploads client migrations)
- This new `deploy` command replaces any previous `deploy` and `deploy:client` scripts that might have existed.

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
## 4. Developer Workflow Aids

### Utilizing Documentation Search Tools

To enhance development efficiency and ensure best practices are followed, especially when implementing new features or exploring unfamiliar patterns within TypeORM or related libraries:

- **Leverage Documentation Search Tools**: Tools like the Context7 MCP server can be invaluable for quickly finding relevant documentation snippets and understanding library capabilities.
- **Example Workflow (Context7)**:
    1.  Use the `resolve-library-id` tool to get the Context7-compatible ID for the target library (e.g., "TypeORM" -> `/typeorm/typeorm`).
    2.  Use the `get-library-docs` tool with the resolved ID and relevant keywords (e.g., "validation, PostgreSQL constraints, check constraints") to find specific examples and explanations.
    3.  This approach was successfully used to identify TypeORM's `@Check()` decorator for implementing database-level constraints for the `Task.startDate` and `Task.dueDate` validation.
- **Recommendation**: For complex entity modifications, new validation requirements, or when unsure about the best TypeORM patterns, consider using such tools to research options before finalizing implementation plans. This can lead to more robust and maintainable solutions.
### Direct Database Testing with Neon MCP

After migrations have been run, especially when new constraints or complex schema changes are introduced, it's beneficial to directly test the database behavior. The Neon MCP provides tools for this.

- **Purpose**: To verify that database constraints (like `CHECK`, `UNIQUE`, `FOREIGN KEY`) and other schema elements are behaving as expected after a migration.
- **Tools**:
    - Use the `run_sql` tool for single SQL statements (e.g., `INSERT`, `UPDATE`, `DELETE` operations that test specific valid or invalid data scenarios).
    - Use the `run_sql_transaction` tool for a series of SQL statements that should be tested atomically.
- **Workflow**:
    1.  Identify the `projectId` for your Neon database (e.g., using `list_projects`).
    2.  Craft SQL statements to test edge cases, valid inputs, and inputs that *should* violate the new constraints.
    3.  Execute these statements using the Neon MCP.
    4.  Observe the results: successful operations for valid data, and appropriate database errors (e.g., "violates check constraint") for invalid data.
    5.  This was used to confirm the `chk_task_start_date_before_due_date` constraint on the `tasks` table by attempting valid and invalid `INSERT` operations.
- **Benefit**: Provides an additional layer of confidence that migrations and schema definitions are correct, catching issues directly at the database level. Remember to clean up any test data inserted.