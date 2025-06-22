# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development servers for web and server applications
- `pnpm build` - Build all packages and applications
- `pnpm lint` - Run ESLint with maximum 10000 warnings
- `pnpm lint:fix` - Fix ESLint issues automatically
- `pnpm type-check` - Run TypeScript type checking for server and web apps
- `pnpm format` - Format code with Prettier
- `pnpm quality` - Run code quality checks (must pass before build)

### Application-Specific Commands
- `pnpm dev:web` - Start only the web application
- `pnpm dev:debug` - Start development servers with debug logging
- `pnpm dev:info` - Start development servers with info logging

### DataForge Commands (Entity & Schema Management)
- `pnpm forge:build` - Generate entities and compile (from monorepo root)
- `pnpm forge:migrate:generate <MigrationName>` - Generate migrations from entity changes
- `pnpm forge:migrate:run` - Run pending migrations
- `pnpm forge:deploy <MigrationName>` - Full workflow: build → generate migration → run migrations

### Testing
- `pnpm --filter @repo/sync-test test` - Run sync functionality tests
- `pnpm --filter vibestack-web test:sync-isolation` - Run web sync isolation tests

### Deployment
- `pnpm deploy` - Deploy both server and web applications
- `pnpm deploy:server` - Deploy server worker to Cloudflare
- `pnpm deploy:web` - Deploy web application to Cloudflare Pages

## Architecture Overview

### High-Level Architecture
VibeStack is a full-stack, local-first framework with bi-directional sync capabilities:

**Server Architecture:**
- Single Cloudflare Worker with Hono HTTP framework
- Neon PostgreSQL database with WAL-based change capture
- ReplicationDO (Durable Object) for database replication management
- SyncDO (Durable Object) for per-client synchronization
- Same-origin authentication pattern to avoid CORS complexity

**Client Architecture:**
- React frontend with PGLite (PostgreSQL in WebAssembly)
- TypeORM integration for both server and client databases
- XState for state management and sync orchestration
- Real-time WebSocket sync with conflict resolution

### Key Technologies
- **Database**: PostgreSQL (server) + PGLite (client) with TypeORM
- **Sync**: WAL-based replication with LSN tracking
- **State Management**: XState stores with atomic selectors
- **Authentication**: Better Auth with same-origin cookies
- **Runtime**: Cloudflare Workers (server) + Vite (client)

## Core Workspace Packages

### @repo/dataforge - Entity & Schema Management
DataForge is the central hub for entity definitions, migrations, and code generation:

**Key Features:**
- **Single Source of Truth**: All entity definitions in `packages/dataforge/src/entities/`
- **Client/Server Separation**: Auto-generates separate entity exports using decorators
- **TanStack Table Integration**: Auto-generates column configurations for data tables
- **Migration Management**: TypeORM migrations for both server and client databases
- **CRDT Support**: Built-in client ID triggers for last-write-wins conflict resolution

**Entity Definition Patterns:**
```typescript
// In packages/dataforge/src/entities/Task.ts
import { EnumTypeName } from '../utils/decorators.js';
import { TableCategory } from '../utils/context.js';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress', 
  COMPLETED = 'completed'
}

@Entity()
@TableCategory('domain')
export class Task extends BaseDomainEntity {
  @Column({ type: 'enum', enum: TaskStatus })
  @EnumTypeName('TaskStatus')
  status!: TaskStatus;

  @Column({ nullable: true })
  @ServerOnly() // Excluded from client-entities.ts
  internalNotes?: string;
}
```

**Generated Exports:**
- `@repo/dataforge/client-entities` - Client-safe entities and enums
- `@repo/dataforge/server-entities` - Full server entities with server-only fields
- `@repo/dataforge/column-configurations` - TanStack table column definitions

**Table Categories:**
- `@TableCategory('domain')` - Business data, synced between client/server
- `@TableCategory('system')` - Internal state, authentication data
- `@TableCategory('utility')` - Logs, analytics, temporary data

### @repo/sync-types - Sync System Types
Centralized type definitions for the entire sync system:

**Message Types:**
- **Server Messages**: `srv_send_changes`, `srv_init_start`, `srv_catchup_completed`, etc.
- **Client Messages**: `clt_sync_request`, `clt_send_changes`, `clt_heartbeat`, etc.
- **Integrity Messages**: Validation requests, reset commands, statistics

**Core Types:**
```typescript
// TableChange - Core replication unit
interface TableChange {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>; // TypeORM entity format
  updatedAt: string;
  lsn?: string;
  clientId?: string;
  relationshipUpdates?: RelationshipUpdate[];
}

// WebSocket message structure
interface ServerChangesMessage {
  type: 'srv_live_changes';
  changes: TableChange[];
  lastLSN: string;
  sequence?: { chunk: number; total: number };
}
```

**Usage Patterns:**
- Import types in sync services: `import type { TableChange, ServerMessage } from '@repo/sync-types'`
- Type guards for message validation: `isTableChange()`, `isClientMessageType()`
- Relationship handling for junction tables and complex relations

## Code Architecture Patterns

### Domain-Driven Design
Each entity has its own domain module containing repository and service layers:
- `apps/web/src/domain/base.ts` - Base repository and service classes
- `apps/web/src/domain/task.ts` - Task domain with status management
- `apps/web/src/domain/project.ts` - Project domain with relationship management
- `apps/web/src/domain/user.ts` - User domain
- `apps/web/src/domain/index.ts` - Domain factory for centralized creation

### Database & Live Query Architecture
Three live query strategies based on dataset size:
1. **Traditional Live Query** (`useLiveEntity`) - Small datasets (<100 records)
2. **Incremental Live Query** (`useLiveEntityIncremental`) - Medium datasets (100-1000 records)
3. **Live Changes API** (`useLiveChanges`) - Large datasets (1000+ records)

Key directories:
- `apps/web/src/db/` - Database initialization and configuration
- `apps/web/src/db/hooks/` - Live query hooks for reactive data
- `apps/web/src/sync/` - Sync services and state management

### Universal Reactive Data Pattern (XState Edition)
Uses XState atomic stores for surgical precision updates:
- Normalized entity stores (`Record<id, Entity>`) for stable references
- `useSelector` with `shallowEqual` for precise subscriptions
- Router loaders use `ensureLoaded` pattern for instant loading
- Co-located domain actions with XState atoms

### Same-Origin Authentication Pattern
- Frontend and API share the same domain to avoid CORS issues
- API proxy pattern: `/api/*` requests proxied to backend worker
- Backend worker remains internal (not exposed to public internet)
- Simplified cookie management with `SameSite=Lax`

## Development Guidelines

### Performance Optimization
- Use single-query updates in repositories to reduce database round-trips
- Implement batch operations for bulk changes
- Choose appropriate live query strategy based on dataset size
- Use atomic state for shared, frequently-updated data
- Use direct database queries for analytics and one-time operations

### Code Quality Requirements
- All builds must pass `pnpm quality` checks before deployment
- TypeScript strict mode is enabled - fix all type errors
- ESLint allows up to 10000 warnings but prefer fixing issues
- Use Prettier for consistent code formatting

### Entity and Schema Management
- Entity definitions use TypeORM decorators with custom PGLite integration
- Schema migrations managed through DataForge entity manager
- Separate server and client entity exports with visibility decorators
- Automatic relationship discovery and dependency hierarchies

### Sync and State Management
- WebSocket-based bi-directional sync with conflict resolution
- LSN (Log Sequence Number) tracking for precise change detection
- Anti-echo protection to prevent infinite sync loops
- Three sync flow types: Initial, Catchup, and Live sync

## Testing Strategy

### Sync System Testing
The project includes comprehensive sync functionality tests:
- Isolation tests for sync components
- Integration tests for real-time data synchronization
- Performance tests for large dataset handling

### Development Testing
- Use `pnpm dev:debug` for detailed logging during development
- Monitor WebSocket connection status for sync debugging
- Verify anti-echo protection in sync operations
- Test with large datasets early in development

## File Structure Notes

### Key Configuration Files
- `turbo.json` - Monorepo build configuration
- `pnpm-workspace.yaml` - Package manager workspace configuration
- `apps/web/vite.config.ts` - Vite configuration for web app
- `apps/server/wrangler.toml` - Cloudflare Worker configuration
- `.cursor/rules/` - Cursor AI development rules and patterns

### Important Documentation
- `README.md` - Project overview and setup instructions
- `apps/web/src/db/README.md` - Complete database architecture documentation
- `docs/` - Comprehensive architectural documentation
- Various `*_PLAN.md` files - Implementation and refactoring guides

## Common Patterns

### Creating New Entities
1. **Define Entity in DataForge**: Create entity class in `packages/dataforge/src/entities/`
   - Use appropriate decorators: `@TableCategory()`, `@EnumTypeName()`, `@ServerOnly()`/`@ClientOnly()`
   - Define enums in the same file with proper naming
2. **Generate Code**: Run `pnpm forge:build` to generate client/server entities and column configs
3. **Create Migration**: Run `pnpm forge:migrate:generate <EntityName>Migration`
4. **Apply Migration**: Run `pnpm forge:migrate:run` or use full deploy workflow
5. **Create Domain Module**: Add repository + service in `apps/web/src/domain/`
6. **Add to Domain Factory**: Include in `apps/web/src/domain/index.ts`
7. **Choose Live Query Strategy**: Based on expected dataset size and usage patterns
8. **Add XState Atoms**: If real-time collaboration needed

### Adding New Features
1. Follow domain-driven design principles with DataForge entities as foundation
2. Use appropriate live query strategy for data size
3. Import entity types from `@repo/dataforge/client-entities` or `@repo/dataforge/server-entities`
4. Use `@repo/sync-types` for any sync-related messaging
5. Implement proper error handling and logging
6. Add sync tracking for data changes
7. Write tests for critical functionality

### DataForge Workflow
1. **Entity Changes**: Modify entities in `packages/dataforge/src/entities/`
2. **Build**: Run `pnpm forge:build` to regenerate all exports
3. **Migration**: Generate migration with descriptive name
4. **Deploy**: Apply migrations to both server and client databases
5. **Consume**: Import from generated exports in applications

### Performance Monitoring
- Check console logs for performance metrics
- Monitor WebSocket connection status  
- Verify sync system health
- Use database query logs for optimization
- Test with realistic data volumes
- Monitor DataForge build times and generated code size