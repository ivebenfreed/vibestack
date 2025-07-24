# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm build` - Build all packages and applications
- `pnpm lint` - Run ESLint with maximum 10000 warnings
- `pnpm lint:fix` - Fix ESLint issues automatically
- `pnpm type-check` - Run TypeScript type checking for server and web apps
- `pnpm format` - Format code with Prettier
- `pnpm quality` - Run code quality checks (must pass before build)

### CLI Tools
- `pnpm cli` - Interactive CLI tool for development tasks
  - `create-super-admin` - Creates super admin user with auto-login
  - `seed-users` - Seeds database with batch users
  - `init-dataforge` - Complete DataForge initialization workflow
  - `logout` - Logs out super admin session

### Application-Specific Commands
- `pnpm dev:web` - Start only the web application
- `pnpm dev:debug` - Start development servers with debug logging
- `pnpm dev:info` - Start development servers with info logging
- `pnpm dev:pwa-test` - Build and test PWA functionality

### DataForge Commands (Entity & Schema Management)
- `pnpm forge:build` - Generate entities and compile (from monorepo root)
- `pnpm forge:migrate:generate <MigrationName>` - Generate migrations from entity changes
- `pnpm forge:migrate:run` - Run pending migrations
- `pnpm forge:deploy <MigrationName>` - Full workflow: build → generate migration → run migrations

### Testing
- `pnpm --filter @repo/sync-test test` - Run sync functionality tests
- `pnpm --filter vibestack-web test:sync-isolation` - Run web sync isolation tests
- `pnpm test:sync-isolation` - Enhanced sync operation tests with framework

### Deployment
- `pnpm deploy` - Deploy both server and web applications
- `pnpm deploy:server` - Deploy server worker to Cloudflare
- `pnpm deploy:web` - Deploy web application to Cloudflare Pages

#### Production Deployment
- `pnpm deploy:production` - Deploy both server and web to production
- `pnpm deploy:server:production` - Deploy server to production environment
- `pnpm deploy:web:production` - Deploy web to production environment

#### Cloudflare-Specific Commands
- `pnpm cf:dev` - Run with Cloudflare wrangler locally
- `pnpm cf:build` - Build for Cloudflare deployment
- `pnpm cf:preview` - Preview Cloudflare deployment locally
- `pnpm cf:deploy` - Deploy to Cloudflare (default environment)
- `pnpm cf:deploy:staging` - Deploy web app to Cloudflare staging
- `pnpm cf:deploy:production` - Deploy web app to Cloudflare production
- `pnpm pages:deploy:production` - Deploy to Cloudflare Pages production

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

### @repo/cli - Interactive Development CLI
Interactive CLI tool for various monorepo utilities and development tasks:
- User management (create super admin, seed users)
- DataForge initialization workflows
- Session management (logout functionality)
- Development utility commands

### @repo/code-quality - Code Quality & Type Safety
Centralized code quality enforcement package:
- TypeScript strict mode validation
- Used by `pnpm quality` as prebuild requirement
- Cross-package type safety checks
- Enforced before all builds and deployments

### @repo/better-auth-cli - Authentication Management
CLI tools for Better Auth integration:
- Migration management for auth schema
- User management utilities
- Session handling tools

### @repo/cron-tester - Cron Job Testing
Utilities for testing scheduled tasks and cron jobs in the application.

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

### Database & Data Display Architecture
**Current Standard: XState Atoms**
- **XState Atomic Stores**: All data managed via XState atoms (`tasksAtom`, `projectsAtom`, etc.)
- **Surgical Selectors**: Use `useSelector` with `shallowEqual` for precise updates

**Legacy (Disabled in Debug Only):**
- Live query hooks (`useLiveEntity`, `useLiveEntityIncremental`, `useLiveChanges`) 
- Only used in debug components for testing, disabled by default

Key directories:
- `apps/web/src/db/` - Database initialization and configuration
- `apps/web/src/domain/` - XState atoms and business logic (3-layer architecture)
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

### Derived Atoms Pattern
Reactive computed values using XState atoms for performance optimization:
- **Location**: `apps/web/src/domain/derived-atoms.ts`
- **Examples**: `entityCountsAtom`, `taskStatsAtom`, `projectStatsAtom`, `commentStatsAtom`
- **Benefits**: Automatically updates when underlying atoms change, provides aggregated data
- **Usage**: `const stats = useSelector(taskStatsAtom, (stats) => stats, shallowEqual)`

### VibeKan - Kanban Component System
New kanban board implementation for task visualization:
- **Location**: `apps/web/src/components/custom/vibekan/`
- **Components**: `VibeKan.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`
- **Integration**: Works with XState atoms and task management
- **Features**: Drag-and-drop support, real-time updates, customizable columns

## Development Guidelines

### Performance Optimization
- Use single-query updates in repositories to reduce database round-trips
- Implement batch operations for bulk changes
- **Use XState atoms with surgical selectors** instead of live query hooks
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
- **Enhanced Sync Operation Tests**: `apps/web/src/sync/testing/`
  - `SyncTestFramework` class for structured testing
  - `SyncOperationTests` class with detailed test results
  - Progress reporting and comprehensive validation
- **Legacy Tests**: Isolation tests for sync components (still available)
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
7. **Use XState Atoms**: All entities automatically get atoms in domain layer

### Adding New Features
1. Follow domain-driven design principles with DataForge entities as foundation
2. **Use XState atoms for all data management** - no live query hooks
3. Import entity types from `@repo/dataforge/client-entities` or `@repo/dataforge/server-entities`
4. Use `@repo/sync-types` for any sync-related messaging
5. Implement proper error handling and logging
6. Add sync tracking for data changes
7. Write tests for critical functionality

### Data Visualization Components

#### New Task Visualization Components
**Kanban View**: `apps/web/src/features/tasks/TasksKanban.tsx`
- Drag-and-drop task management
- Status-based columns with real-time updates
- Integration with VibeKan component system


**Enhanced Task Cards**: `apps/web/src/features/tasks/TaskCard.tsx`
- Reusable task display component
- Rich metadata display and quick actions
- Optimized for both kanban and list views

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

## Key Dependencies & Technologies

### State Management & UI
- **XState**: Primary state management with atomic stores
- **Jotai**: Secondary atomic state management option
- **Zustand**: Additional state management for specific use cases
- **@dnd-kit/core, @dnd-kit/sortable**: Drag and drop functionality for kanban boards

### Data Visualization
- **TanStack Table**: Foundation for all data grid components
- **rich-textarea**: Enhanced text editing capabilities

### Development & Quality
- **Model Context Protocol (MCP)**: 
  - `@modelcontextprotocol/server-brave-search` - Web search integration
  - `@modelcontextprotocol/server-postgres` - Database integration
- **position-observer**: Position tracking utilities for UI components

## Important Architectural Patterns

### VibeGridNative Usage
- **Performance**: 42.54ms universal cell renderer
- **Generated Columns**: Auto-generated from DataForge entities
- **Usage**: Import from `@repo/dataforge/column-configurations`
- **Selection Pattern**: Define `SELECTED_COLUMNS` array for column ordering
- **Benefits**: Full business logic, complete enums, relationship support

### Domain Service Architecture
- **3-Layer Pattern**: Repository → Service → Controller
- **Base Classes**: `BaseRepository` and `BaseService` for consistency
- **Performance**: Single-query updates, batch operations
- **Error Handling**: Custom error types and transaction safety
- **Integration**: Non-blocking sync tracking and event emission

### Task Feature Patterns
- **Live Queries**: Use `useLiveEntity` for real-time data updates
- **Service Methods**: All data modifications through service layer
- **Auto-Updates**: No manual event handling needed - live queries handle updates
- **ID Handling**: Be aware of entity ID field naming conventions