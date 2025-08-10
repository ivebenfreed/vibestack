# VibeStack Environment Files Package

Generated: Sat Aug  9 08:14:35 PM EDT 2025
Machine: fedora
User: benfreed

## Contents

This package contains all environment configuration files needed to run VibeStack on another machine.

### Environment Files Included (4 files)
- ✅ apps/server/.dev.vars
- ✅ apps/server/.dev.vars.local
- ✅ apps/web/.env.development
- ✅ .env.local

### Missing Files (9 files)
These files were not found on the source machine:
- ⚠️ apps/web/.env.development.generated
- ⚠️ apps/web/.env.local
- ⚠️ apps/web/.env.staging
- ⚠️ apps/web/.env.production
- ⚠️ packages/dataforge/.env
- ⚠️ packages/dataforge/.env.local
- ⚠️ packages/dataforge/.env.development
- ⚠️ packages/dataforge/.env.preview
- ⚠️ packages/dataforge/.env.production

## Installation Instructions

### Prerequisites
1. Clone the vibestack repository on the target machine
2. Install Docker and Docker Compose
3. Install Node.js (v20+) and pnpm

### Setup Steps

1. **Extract this package** in a temporary directory:
   ```bash
   tar -xzf vibestack-env-20250809_201435.tar.gz
   cd vibestack-env-20250809_201435
   ```

2. **Run the setup script** from within the vibestack root:
   ```bash
   cd /path/to/vibestack
   /path/to/extracted/vibestack-env-20250809_201435/setup-env.sh
   ```

3. **Review and update configuration**:
   - Check `apps/server/.dev.vars` for the correct DATABASE_URL
   - Update any machine-specific paths or settings
   - Ensure Docker is running

4. **Initialize the database**:
   ```bash
   ./scripts/init-local-from-remote.sh
   ```

5. **Install dependencies and start development**:
   ```bash
   pnpm install
   pnpm dev:local
   ```

## Important Files

### Required Environment Files
- `apps/server/.dev.vars` - Server configuration and database URL
- `apps/server/.dev.vars.local` - Local server overrides
- `apps/web/.env.development` - Web app development settings

### Optional Environment Files
- `.env.local` - Root-level local overrides
- Various package-specific env files

## Security Notes

⚠️ **IMPORTANT**: These files may contain sensitive information such as:
- Database credentials
- API keys
- Authentication secrets

Please handle with care and never commit these files to version control.

## Troubleshooting

### Missing Files
If some environment files were missing from the source machine, you may need to:
1. Create them manually based on example files
2. Copy from another developer
3. Use default values from the repository

### Database Connection
If you can't connect to the database:
1. Check the DATABASE_URL in `apps/server/.dev.vars`
2. Ensure you have access to the Neon database
3. Or use a local PostgreSQL instance

### Port Conflicts
Default ports:
- Web: 5173
- API: 8787
- Database: 5432
- Proxy: 4444

Adjust these in the environment files if needed.

## Support

For issues or questions, refer to:
- CLAUDE.md for development guidelines
- docs/DATABASE_SYNC.md for database synchronization
- GitHub Issues for project-specific problems
