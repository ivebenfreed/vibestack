# VibeStack

## A full stack, local first, edge and AI native framework for data intensive web applications.

## 🚨 DEVELOPMENT WORKFLOW

**MANDATORY:** All development must follow the GitHub Issue → Worktree → PR workflow.

### Quick Start
```bash
# 1. Create GitHub issue first (get issue number)
# 2. Start working on the issue
./scripts/start-issue.sh 123

# 3. When done, cleanup
./scripts/finish-issue.sh 123
```

📋 **[READ THE FULL WORKFLOW RULES](./WORKFLOW.md)** - This document contains mandatory workflow rules that all contributors must follow.

### Commands
- `./scripts/start-issue.sh [N]` - Start work on GitHub issue #N
- `./scripts/finish-issue.sh [N]` - Cleanup after PR merge  
- `./scripts/list-issues.sh` - Show active issue worktrees
- `pnpm dev:local` - Start development server in issue worktree

## Vision

- ✨ **Offline-First Architecture** - Continue working without an internet connection
- 🔄 **Bi-directional Sync** - Changes flow seamlessly between server and clients
- 💾 **Full SQL in the Browser** - Complete PostgreSQL capabilities via WebAssembly
- 🧠 **Local LLM & NLP Support** - Local, in-browser models for day-to-day operations with heavy loads offloaded to APIs
- 🔌 **Zero Infrastructure** - Serverless deployment with no management overhead
- 🚀 **Edge-Powered Backend** - Cloudflare prmitives and Neon Postgres for low
- Fully automatic LLM freidnly data modal, schema, migration and api factory from a central hub
- 🧰 **Developer Experience** - Type-safe APIs with excellent tooling support


## Core Components

### 1. Server Architecture

- **Single Cloudflare Worker**: Serverless edge runtime for the entire backend
  - Zero infrastructure management
  - Global edge distribution
  - Automatic scaling with traffic demands
- **Hono HTTP Framework**: Lightweight, high-performance API server
- **Neon PostgreSQL**: Serverless Postgres database
  - WAL (Write-Ahead Log) based change capture
  - Built-in replication capabilities
  - Branching for development environments
- **ReplicationDO (Durable Object)**: Manages database replication with PostgreSQL's WAL
  - Polls for changes in the database
  - Maintains replication state and log sequence numbers (LSN)
  - Notifies clients of changes in real-time
- **SyncDO (Durable Object)**: Per-client sync manager
  - Manages WebSocket connections for individual clients
  - Filters changes relevant to specific clients
  - Handles client-to-server data synchronization
  - Maintains client session state
  - Implements conflict resolution and last-write-wins semantics

### 2. Client Application

- **React Frontend**: Modern, responsive user interface
- **PGLite Integration**: PostgreSQL in WebAssembly
  - Full SQL database running in the browser
  - Persistent storage with IndexedDB
  - Support for complex queries and transactions
- **WebSocket Sync**: Real-time data synchronization
  - Bidirectional communication with server
  - Efficient change propagation
  - Conflict resolution

### 3. DataForge Entity Manager

- **TypeORM Integration**: ORM and database toolkit
  - Entity definition with decorators
  - Relationship mapping
  - Direct SQL queries instead of query builders
- **Schema Management**: Define entities with TypeScript decorators
- **Type Generation**: Automatic TypeScript type generation
- **Multi-Database Support**: Works with both server PostgreSQL and client PGLite
- **Migration System**: Consistent schema across environments
- **Table Categories**: Domain, System, and Utility table classifications
- **Custom Entity Generator**: Smart context-aware entity management
  - Generates separate server and client entity exports
  - Uses decorators to control property/entity visibility (@ServerOnly, @ClientOnly)
  - Automatically discovers and analyzes entity relationships
  - Builds dependency hierarchies for efficient data synchronization
  - Handles complex entity metadata filtering

> **TODO:** Implement full CRUD API code generation to automatically create type-safe endpoints from entity definitions.

## Project Structure

```
vibestack/
├── apps/                    # Application implementations
│   ├── server/             # Hono server with ReplicationDO and SyncDO
│   └── web/                # React client with PGLite integration
├── packages/               # Shared packages
│   ├── sync-test/         # Testing utilities for sync functionality
│   ├── dataforge/         # Database integration and entity management
│   ├── sync-types/        # Shared type definitions for sync
│   ├── config/            # Configuration packages
│   └── typescript-config/ # TypeScript configuration
└── docs/                  # Project documentation
```

## Change Tracking and Sync Flow

- **WAL-Based Change Capture**: Uses PostgreSQL's Write-Ahead Log for efficient change detection
- **LSN (Log Sequence Number) Tracking**: Precisely tracks database changes without extra tables
- **Sync Flow Types**:
  1. **Initial Sync**: Complete data download for new clients
  2. **Catchup Sync**: Selective updates for reconnecting clients
  3. **Live Sync**: Real-time bidirectional updates

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- TypeScript >= 5.5

## Getting Started

1. Clone the repository:
   ```bash
   git clone git@github.com:codevibesmatter/vibestack.git
   cd vibestack
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

4. Start development servers:
   ```bash
   pnpm dev
   ```

## Authentication System (Better Auth)

VibeStack uses **Better Auth** for a complete, secure authentication system with advanced features:

### Core Authentication Features

- **Email/Password Authentication** - Traditional email and password sign-in ✅
- **Google OAuth** - One-click sign-in with Google accounts 🚧 (Temporarily disabled)
- **Email Verification** - Secure email verification flow for new accounts ✅
- **Password Reset** - Self-service password reset via email ✅
- **User Invitation System** - Admin-initiated user invitations with email setup links ✅
- **Role-Based Access Control** - Multiple user roles (viewer, member, admin, super_admin) ✅
- **Session Management** - Secure session handling with proper cookie configuration ✅
- **Same-Origin Pattern** - Simplified authentication without CORS complexity ✅

### Admin User Management

**⚠️ Admin Features:** These features are restricted to admin and super_admin users only.

Admin users can access advanced user management features at `/settings/admin/users`:

- **User Management Dashboard** - View, create, edit, and delete users ✅
- **User Invitation System** - Send invitation emails with account setup links ✅
- **Role Management** - Assign and modify user roles and permissions ✅
- **Password Reset** - Admin-initiated password resets via email ✅
- **Email Verification Control** - Manage user email verification status ✅
- **User CRUD Operations** - Complete user lifecycle management ✅

#### User Invitation Flow
1. Admin clicks "Invite User" and fills out email, name, and role
2. System creates user account with temporary credentials
3. Invitation email sent with secure setup link (`/complete-registration`)
4. User clicks link and sets their own password
5. User can immediately sign in with new credentials

### Authentication Configuration

The authentication system requires several environment variables:

#### Server Configuration (`apps/server/.env.example`)
```bash
# Better Auth
BETTER_AUTH_SECRET=your_super_secret_auth_key_at_least_32_characters_long
BETTER_AUTH_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
```

#### Client Configuration (`apps/web/.env.example`)
```bash
# API Connection
VITE_API_URL=http://127.0.0.1:8787
```

### Setting Up OAuth Providers

#### Google OAuth Setup (Currently Disabled)
⚠️ Google OAuth is temporarily disabled during authentication system stabilization.

To re-enable Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client IDs in Credentials
5. Set Authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback/google` (development)
   - `https://dev.codevibesmatter.com/api/auth/callback/google` (staging)
   - `https://app.codevibesmatter.com/api/auth/callback/google` (production)
6. Uncomment Google provider configuration in `apps/server/src/lib/auth.ts`

#### Email Service Setup (Resend)
1. Sign up at [Resend](https://resend.com/)
2. Get your API key from [API Keys](https://resend.com/api-keys)
3. Configure your domain at [Domains](https://resend.com/domains)
4. Verify your domain for email sending

### Authentication CLI Tools

Use the CLI for user management:

```bash
# Create super admin user
pnpm cli create-super-admin

# Seed test users
pnpm cli seed-users

# Logout current session
pnpm cli logout
```

## Development

- `pnpm build` - Build all packages and applications
- `pnpm dev` - Start development servers
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Format code with Prettier
- `pnpm quality` - Run code quality checks

## Testing

### Automated Testing

The project includes comprehensive test suites for critical functionality:

#### Sync System Tests
```bash
# Run all sync functionality tests
pnpm --filter @repo/sync-test test

# Run enhanced sync operation tests with detailed reporting
pnpm test:sync-isolation

# Run web sync isolation tests
pnpm --filter vibestack-web test:sync-isolation
```

#### Build and Quality Tests
```bash
# Run full build pipeline (required before deployment)
pnpm build

# Run code quality checks (TypeScript + ESLint)
pnpm quality

# Run linting with auto-fix
pnpm lint:fix

# Run TypeScript type checking
pnpm type-check
```

### Manual Testing Workflows

#### Authentication System Testing

**Prerequisites:**
1. Set up Resend API key for email testing
2. Create super admin user: `pnpm cli create-super-admin`
3. Start dev servers: `pnpm dev`

**Test Email/Password Authentication:**
1. Navigate to `/sign-up`
2. Create account with valid email
3. Check email for verification link
4. Click verification link
5. Sign in at `/sign-in`
6. Verify dashboard access

**Test User Invitation System:**
1. Sign in as admin user
2. Navigate to `/settings/admin/users`
3. Click "Invite User" button
4. Fill out invitation form (email, name, role)
5. Check recipient email for invitation
6. Click invitation link to access `/complete-registration`
7. Set password and complete setup
8. Verify new user can sign in

**Test Password Reset Flow:**
1. Go to `/sign-in`
2. Click "Forgot Password?"
3. Enter email address
4. Check email for reset link
5. Click reset link
6. Set new password
7. Sign in with new credentials

**Test Admin User Management:**
1. Sign in as admin
2. Navigate to `/settings/admin/users`
3. Test user creation, editing, role changes
4. Test password reset for other users
5. Test user deletion (non-self)

#### Sync System Testing

**Basic Sync Testing:**
1. Open application in two browser tabs
2. Create/modify data in one tab
3. Verify changes appear in other tab within 1-2 seconds
4. Test offline scenarios by disconnecting network
5. Make changes offline, reconnect, verify sync

**Performance Testing:**
1. Test with large datasets (1000+ rows)
2. Verify performance stays optimal
3. Test bulk operations and sync performance
4. Monitor WebSocket connection stability

### Testing Infrastructure

#### Development Environment Testing
```bash
# Start with debug logging
pnpm dev:debug

# Start with info logging
pnpm dev:info

# Test PWA functionality
pnpm dev:pwa-test
```

#### Database Testing
```bash
# Generate and run migrations
pnpm forge:migrate:generate TestMigration
pnpm forge:migrate:run

# Full DataForge workflow test
pnpm forge:deploy TestDeployment

# Initialize DataForge from scratch
pnpm cli init-dataforge
```

### Known Testing Issues

- **Sync Test Package**: Currently has TypeScript compilation errors (sync-test package)
- **Google OAuth**: Disabled during development - requires provider setup
- **Password Hashing**: Temporary implementation in admin password reset
- **KV Namespace**: Deployment requires Cloudflare KV configuration

### Performance Benchmarks

- **WebSocket Sync Latency**: <2 seconds for typical changes
- **Database Query Performance**: Optimized with single-query updates
- **Bundle Size**: Monitored for optimal loading times

## Acknowledgments

VibeStack is built with amazing open-source technologies and draws inspiration from various community projects:

- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful, accessible React components built with Radix UI and Tailwind CSS
- **Shadcn-based admin templates** - UI patterns and design inspiration for modern admin dashboards
- **[Radix UI](https://www.radix-ui.com/)** - Low-level UI primitives and accessibility features
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Tabler Icons](https://tabler.io/icons)** & **[Lucide React](https://lucide.dev/)** - Beautiful icon libraries

Special thanks to the open-source community for creating the foundational tools that make VibeStack possible.

For detailed attributions and credits, see [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

## License

This project is private and proprietary. All rights reserved.

## Support

For support, please contact the maintainers or open an issue in the repository. 
