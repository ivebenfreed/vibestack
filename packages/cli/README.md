# VibeStack CLI

Interactive CLI for various monorepo development tasks with multi-environment support.

## Features

- **Multi-Environment Support**: Development, staging, and production configurations
- **Interactive Mode**: Menu-driven interface for easy command selection
- **Command Mode**: Direct command execution with environment options
- **Environment-Specific Authentication**: Separate token storage per environment
- **Comprehensive Logging**: Detailed debug information for troubleshooting

## Installation

From the monorepo root:

```bash
pnpm install
```

## Environment Configuration

The CLI supports three environments, each with its own configuration file:

### Environment Files

- `.env.development` - Local development (default)
- `.env.staging` - Staging environment
- `.env.production` - Production environment
- `.env` - Backwards compatibility (fallback)

### Environment Variables

Each environment file should contain:

```bash
# Server API URL
API_URL=https://your-api-endpoint.com

# Bootstrap Secret for initial super admin creation
BOOTSTRAP_SECRET=your_bootstrap_secret

# Super Admin credentials for seeding
SEED_SUPER_ADMIN_EMAIL=admin@yourdomain.com
SEED_SUPER_ADMIN_PASSWORD=secure_password
SEED_SUPER_ADMIN_NAME="Admin Name"

# Batch user seeding configuration
SEED_BATCH_USER_COUNT=10
SEED_BATCH_USER_EMAIL_PATTERN=user{index}@yourdomain.com  
SEED_BATCH_USER_NAME_PATTERN="User {index}"
SEED_BATCH_USER_PASSWORD=default_password
SEED_BATCH_USER_ROLE=MEMBER

# Environment identifier
ENVIRONMENT=development
```

## Usage

### Interactive Mode

Run without arguments to enter interactive mode:

```bash
# Use default environment (development)
pnpm cli

# Use specific environment
pnpm cli:dev      # Development
pnpm cli:staging  # Staging  
pnpm cli:prod     # Production
```

### Command Mode

Execute specific commands directly:

```bash
# With default environment
pnpm cli create-super-admin
pnpm cli seed-users
pnpm cli logout
pnpm cli init-dataforge

# With specific environment
pnpm cli --env staging create-super-admin
pnpm cli --env production seed-users

# Using npm scripts
pnpm cli:staging create-super-admin
pnpm cli:prod seed-users
```

## Available Commands

### `create-super-admin`
Creates initial super admin user and automatically logs them in.
- Uses bootstrap API with secret authentication
- Stores environment-specific authentication token
- Handles existing user scenarios gracefully

### `seed-users`
Seeds database with batch test users.
- Prompts for login if no active session
- Configurable user count and patterns
- Uses admin API endpoints

### `init-dataforge`
Complete DataForge initialization workflow.
- Builds entities and generates migrations
- Applies database triggers
- Runs from monorepo root context

### `logout`
Clears stored authentication tokens for current environment.
- Environment-specific token cleanup
- Simple session management

## Authentication

### Token Storage
- Environment-specific token files: `.auth-token-{environment}.json`
- Project-local storage (not committed to git)
- Automatic token validation per environment

### Session Management
- Persistent authentication per environment
- Automatic login prompts when needed
- Secure token handling with proper cleanup

## Environment Examples

### Development
```bash
# .env.development
API_URL=http://localhost:8787
BOOTSTRAP_SECRET="dev_bootstrap_secret"
SEED_SUPER_ADMIN_EMAIL=admin@localhost.dev
SEED_BATCH_USER_COUNT=10
```

### Staging
```bash  
# .env.staging
API_URL=https://vibestack-server-staging.workers.dev
BOOTSTRAP_SECRET="staging_bootstrap_secret"
SEED_SUPER_ADMIN_EMAIL=admin@staging.yourdomain.com
SEED_BATCH_USER_COUNT=5
```

### Production
```bash
# .env.production  
API_URL=https://vibestack-server-production.workers.dev
BOOTSTRAP_SECRET="production_bootstrap_secret"
SEED_SUPER_ADMIN_EMAIL=admin@yourdomain.com
SEED_BATCH_USER_COUNT=3
```

## Troubleshooting

### Environment Loading Issues
The CLI provides detailed logging for environment configuration:
- File paths and existence checks
- Environment variable validation
- API URL verification

### Authentication Problems
- Check environment-specific token files
- Verify API endpoints are accessible
- Confirm bootstrap secrets match server configuration

### Debug Mode
All CLI operations include comprehensive logging for troubleshooting:
- Environment loading details
- API request/response information
- Authentication flow status
- Error details with context

## Development

### Adding New Commands
1. Create command file in `src/commands/`
2. Add to main CLI registration in `src/cli.ts`
3. Update interactive menu choices
4. Add environment loading to command action

### Environment Utilities
The `src/utils/environment.ts` module provides:
- Environment detection and validation
- Configuration file loading
- Token file path management
- Available environment discovery