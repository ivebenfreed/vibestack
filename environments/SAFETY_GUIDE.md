# Environment Safety Guide

## Critical Database Protection Safeguards

### Before Starting Any Development Environment

1. **Always backup your main database:**
   ```bash
   # Create timestamped backup before starting any dev environment
   ./scripts/backup-postgres.sh
   ```

2. **Verify main containers are healthy:**
   ```bash
   docker ps | grep vibestack-postgres
   docker exec vibestack-postgres pg_isready -U postgres
   ```

3. **Check volume accessibility:**
   ```bash
   docker volume inspect vibestack_postgres_data
   ```

### Environment Startup Checklist

Before running any `./environments/*/start.sh`:

- [ ] Main PostgreSQL container is running and healthy
- [ ] Database backup created (less than 24 hours old)
- [ ] No port conflicts (5432 main vs 5433+ dev environments)
- [ ] Sufficient disk space for additional containers

### Emergency Recovery Procedures

If main database becomes inaccessible:

1. **Check existing volumes:**
   ```bash
   docker volume ls | grep vibestack
   ```

2. **Identify the volume with your data:**
   ```bash
   # Look for volumes created around the time you had working data
   docker volume inspect vibestack_postgres_data
   ```

3. **Restore main container with correct volume:**
   ```bash
   cd docker-configs
   docker compose down postgres
   docker compose up -d --build postgres
   ```

4. **If volume is corrupted, restore from git-tracked backup:**
   ```bash
   # Check if you have recent backups committed
   ls -la data/postgres-live/
   git log --oneline data/postgres-live/
   ```

### Development Environment Fixes

#### Fix 1: Add Safety Checks to start.sh Scripts

Each environment start script should include:

```bash
# Safety check before starting
if docker ps | grep -q "vibestack-postgres"; then
    echo "⚠️  Main PostgreSQL is running on port 5432"
    echo "   Dev environment will use port 5433"
    echo "   Continue? (y/N)"
    read -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 1
    fi
fi

# Verify main database accessibility before proceeding
if ! docker exec vibestack-postgres pg_isready -U postgres 2>/dev/null; then
    echo "❌ Main PostgreSQL is not accessible"
    echo "   Please fix main database before starting dev environment"
    exit 1
fi
```

#### Fix 2: Add wal2json to Dev Environments

Update `environments/dev-1/docker-compose.yml`:

```yaml
postgres:
  build:
    context: ../..  # Point to root for Dockerfile.postgres
    dockerfile: Dockerfile.postgres
  container_name: vibestack-dev1-postgres
  # ... rest of config
```

#### Fix 3: Automatic Backup Integration

Add to environment start scripts:

```bash
# Auto-backup before starting
echo "🛡️  Creating safety backup..."
if ! ./../../scripts/backup-postgres.sh; then
    echo "❌ Backup failed, aborting dev environment start"
    exit 1
fi
```

### Resource Monitoring

Monitor Docker resources to prevent conflicts:

```bash
# Check Docker disk usage
docker system df

# Monitor running containers
docker stats --no-stream

# Check for volume conflicts
docker volume ls | grep -E "(postgres|vibestack)"
```

### Best Practices

1. **Never run dev environments on production data**
2. **Always backup before environment changes**
3. **Use separate Docker networks for isolation**
4. **Monitor disk space - dev environments consume significant storage**
5. **Stop unused dev environments to free resources**

## Recovery Contacts

If you encounter database loss:

1. Check this guide first
2. Look for Docker volumes with your data
3. Restore from most recent git-tracked backup
4. As last resort, restore from external backups

**Remember: Prevention is better than recovery!**