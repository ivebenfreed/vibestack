# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Vite (includes integrated Cloudflare Workers runtime)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run knip` - Find unused dependencies and exports

### Cloudflare Workers
- `wrangler deploy` - Deploy to Cloudflare Workers
- `wrangler d1 execute <DB_NAME> --file=<FILE>` - Execute SQL against D1 database
- `wrangler d1 migrations apply <DB_NAME>` - Apply database migrations

**IMPORTANT**: Do NOT run `wrangler dev` separately. The `@cloudflare/vite-plugin` handles the Workers runtime integration directly in Vite.

## Architecture

This is a full-stack React admin dashboard built for Cloudflare Workers with the following architecture:

### Frontend Stack
- **React 19** with **TypeScript** for the UI
- **TanStack Router** for file-based routing with type safety
- **TanStack Query** for server state management
- **Zustand** for client state management
- **ShadcnUI** + **TailwindCSS** for styling with RTL support
- **Radix UI** for accessible components

### Backend Stack
- **Cloudflare Workers** for serverless compute
- **Hono** with **OpenAPI** integration for the web framework
- **PostgreSQL** for the database (with Hyperdrive optimization)
- **KV** for key-value storage
- **Better Auth** for authentication with OpenAPI documentation
- **Kysely** for type-safe database operations
- **Cloudflare AI** for AI chat functionality

### Key Architecture Patterns

1. **Feature-Based Organization**: Code is organized by features in `src/features/` (auth, dashboard, tasks, users, etc.)

2. **Routing Structure**: 
   - TanStack Router with file-based routing in `src/routes/`
   - `_authenticated/` routes require authentication
   - `(auth)/` and `(errors)/` are route groups

3. **Component Architecture**:
   - Reusable UI components in `src/components/ui/` (ShadcnUI)
   - Layout components in `src/components/layout/`
   - Feature-specific components within each feature directory

4. **Data Layer**:
   - TanStack Query for server state with React Query DevTools
   - Custom hooks for data fetching patterns
   - Type-safe API calls with Zod validation

5. **Authentication Flow**:
   - Better Auth configured for email/password and OAuth (Google, GitHub)
   - Protected routes with authentication context
   - Session management with KV storage

6. **Cloudflare Integration**:
   - Worker entry point in `worker.ts` using Hono
   - API functions in `functions/api/` directory
   - Environment bindings for PostgreSQL, KV, AI, and auth secrets

## AI Universe Architecture

Elevra implements an **AI Universe** model for organizing life and work across major areas with lore and canon frameworks:

### Universe Hierarchy
```
User's Universe → Worlds (Organizations) → Projects → Tasks
```

- **Universe**: The complete scope of a user's life and work
- **Worlds**: Major life/business areas (5-6 max) - these ARE organizations
- **Projects**: Specific work initiatives within worlds (formerly called "worlds" before architectural fix)
- **Tasks**: Individual action items within projects

### World Framework
Each world (organization) has:
- **Lore**: Purpose, mission, and story ("why this world exists")
- **Canon**: Non-negotiable rules and standards that govern the world
- **Health Metrics**: Momentum, satisfaction, and alignment tracking
- **Role-based Access**: Owner, Admin, Manager, Member permissions

### Key Features
- **Multi-tenant**: Users belong to multiple organizations/worlds
- **Universe Context**: Legend State manages cross-organization state
- **World Types**: Personal worlds (life areas) vs Business worlds (companies)
- **Real-time Sync**: WebSocket synchronization across worlds and devices

### Implementation Notes
- Organizations table contains `lore` (TEXT) and `canon` (JSONB) fields
- Former "worlds" table was dropped - those micro-worlds became projects
- Universe API (`/api/universe/complete`) returns organizations as worlds
- Frontend components (`WorldManager`, `WorldCard`) display organization data as worlds

## Important Configuration

### Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)

### ESLint Rules
- Uses TypeScript ESLint with React hooks and TanStack Query plugins
- Enforces type-only imports with inline syntax
- No console.log statements in production
- Strict unused variable checking with underscore prefix exception

### Database
- Uses PostgreSQL with Kysely ORM for type-safe queries
- Cloudflare Hyperdrive for connection pooling and optimization in production
- Schema and migrations in `apps/worker/src/server/migrations/` directory
- Local development uses Docker PostgreSQL with git-tracked data

### Modified ShadcnUI Components
The following components have been customized for RTL support and should not be updated via Shadcn CLI without reviewing changes:
- **Modified**: scroll-area, sonner, separator
- **RTL Updated**: alert-dialog, calendar, command, dialog, dropdown-menu, select, table, sheet, sidebar, switch

### Development Integration
The `@cloudflare/vite-plugin` provides seamless integration between Vite and the Cloudflare Workers runtime:

- **Native HMR**: Hot Module Replacement works for both client and server code
- **Integrated Runtime**: Worker code runs in workerd (same as production) during development
- **No Proxy Needed**: API routes are handled directly by Vite, no separate wrangler dev process required
- **Environment Parity**: Development environment matches production Cloudflare Workers runtime
- **SPA Fallback**: Client-side routing works correctly - direct URL navigation is supported

**Critical Configuration**:
- Remove any server proxy configuration from vite.config.ts - the plugin handles routing internally
- Set `appType: 'spa'` in vite.config.ts for proper SPA fallback
- The worker handles SPA fallback by serving index.html for non-API routes when ASSETS is unavailable (development)

## API Documentation

The application uses OpenAPI documentation with interactive testing:

- **API Docs**: `http://localhost:5174/api/ui` - Swagger UI for all endpoints
- **Auth Docs**: `http://localhost:5174/api/auth/reference` - Better Auth endpoints
- **OpenAPI Schema**: `http://localhost:5174/api/docs` - JSON specification

New routes defined in `src/server/routes/` with Zod schemas automatically appear in documentation.

## Authentication & Testing

### Test User Credentials
**Wide Corp Solutions Test Users** (Organization ID: `01920000-1000-7000-8000-000000000001`):
- **Owner**: `ceo@widecorp.com` / `WideCorp2024!CEO` (Alice CEO)
- **Admin**: `cto@widecorp.com` / `WideCorp2024!CTO` (Bob CTO)  
- **Manager**: `pm1@widecorp.com` / `WideCorp2024!PM1` (Carol PM)
- **Member**: `dev1@widecorp.com` / `WideCorp2024!DEV1` (Eve Developer)

**Legacy Demo User**:
- **Email**: `demo@example.com` / **Password**: `password123`

**Creating New Users**:
```bash
curl -X POST http://localhost:5174/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123", "name": "New User"}'
```

### Sign-in Methods
1. **OAuth (GitHub/Google)**: Currently returns 404 - OAuth providers need configuration
2. **Email/Password**: Working with test credentials above
3. **Account Creation**: Better Auth handles user registration automatically on first successful OAuth or can be done via API

### Authentication Flow
- Better Auth manages sessions with database hooks for real-time WebSocket invalidation
- Legend State v3 provides reactive auth state management
- Sessions are stored in Cloudflare KV with automatic expiry
- WebSocket connections via UserSysDO provide cross-device session invalidation

## Testing Commands
No specific test commands are configured. Check with the user if testing setup is needed.