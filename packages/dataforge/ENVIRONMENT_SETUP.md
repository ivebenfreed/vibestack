# DataForge Environment Setup Guide

This guide explains how to configure and run migrations for different environments (development, staging, production) in the DataForge package.

## Environment Configuration

### Environment Files

DataForge uses environment-specific `.env` files that are automatically loaded based on the `NODE_ENV` value:

- `.env.development` - Development environment (default when NODE_ENV is not set)
- `.env.preview` - Staging/Preview environment (NODE_ENV=preview)
- `.env.production` - Production environment (NODE_ENV=production)
- `.env` - Base configuration (loaded after environment-specific files)

### Setting Up Environment Files

1. **Development** (`.env.development`)
   ```env
   DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/vibestack_dev?sslmode=disable
   DEBUG_ORM=true
   ```

2. **Staging** (`.env.preview`)
   ```env
   DATABASE_URL=postgresql://staging_user:staging_pass@staging.example.com:5432/vibestack_staging?sslmode=require
   DEBUG_ORM=false
   ```

3. **Production** (`.env.production`)
   ```env
   DATABASE_URL=postgresql://prod_user:prod_pass@prod.example.com:5432/vibestack_prod?sslmode=require
   DEBUG_ORM=false
   ```

## Migration Commands

### Basic Migration Commands

These commands use the current NODE_ENV or default to development:

```bash
# Generate migrations
pnpm migration:generate:server -- src/migrations/server/MigrationName
pnpm migration:generate:client -- src/migrations/client/MigrationName

# Run migrations
pnpm migration:run:server
pnpm migration:run:client

# Show migration status
pnpm migration:show:server
pnpm migration:show:client

# Revert last migration
pnpm migration:revert:server
pnpm migration:revert:client
```

### Environment-Specific Commands

#### Development
```bash
# Run server migrations on development
pnpm migration:run:server:dev

# Run client migrations on development
pnpm migration:run:client:dev

# Generate server migration for development
pnpm migration:generate:server:dev -- src/migrations/server/MigrationName

# Show migration status for development
pnpm migration:show:server:dev

# Revert last migration on development
pnpm migration:revert:server:dev
```

#### Staging
```bash
# Run server migrations on staging
pnpm migration:run:server:staging

# Run client migrations on staging
pnpm migration:run:client:staging

# Generate server migration for staging
pnpm migration:generate:server:staging -- src/migrations/server/MigrationName

# Show migration status for staging
pnpm migration:show:server:staging

# Revert last migration on staging
pnpm migration:revert:server:staging
```

#### Production
```bash
# Run server migrations on production
pnpm migration:run:server:prod

# Run client migrations on production
pnpm migration:run:client:prod

# Generate server migration for production
pnpm migration:generate:server:prod -- src/migrations/server/MigrationName

# Show migration status for production
pnpm migration:show:server:prod

# Revert last migration on production (use with caution!)
pnpm migration:revert:server:prod
```

## Client Database (PGLite) Notes

The client database uses PGLite (PostgreSQL in WebAssembly) and stores data in environment-specific directories:

- Development: `./pgdata/development/`
- Staging: `./pgdata/preview/`
- Production: `./pgdata/production/`

If you encounter corruption issues with PGLite:
```bash
# Remove the corrupted data directory
rm -rf pgdata/development  # or preview/production

# Re-run migrations
pnpm migration:run:client:dev
```

## Common Workflows

### 1. Adding a New Migration (Development)
```bash
# 1. Make entity changes in src/entities/
# 2. Build the package
pnpm forge:build

# 3. Generate migration
pnpm migration:generate:server:dev -- src/migrations/server/AddNewFeature

# 4. Run migration
pnpm migration:run:server:dev
```

### 2. Deploying to Staging
```bash
# 1. Ensure staging environment is configured in .env.preview
# 2. Run pending migrations
pnpm migration:run:server:staging

# 3. Verify migration status
pnpm migration:show:server:staging
```

### 3. Production Deployment
```bash
# 1. Always test migrations in staging first!
# 2. Ensure production environment is configured in .env.production
# 3. Run migrations
pnpm migration:run:server:prod

# 4. Verify migration status
pnpm migration:show:server:prod
```

## Security Best Practices

1. **Never commit real database credentials** to version control
2. Use environment variables or secret management systems
3. Always use SSL for cloud databases (`sslmode=require`)
4. Set `DEBUG_ORM=false` for staging and production
5. Test migrations thoroughly in development and staging before production

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL is correct for the environment
- Check network connectivity to the database
- Ensure SSL settings match your database requirements

### Migration Conflicts
- Use `migration:show:server:<env>` to check current state
- Manually resolve conflicts in migration files if needed
- Consider using `migration:revert` carefully if needed

### PGLite Issues
- Clear the pgdata directory for the affected environment
- Re-run client migrations from scratch
- Check disk space and permissions