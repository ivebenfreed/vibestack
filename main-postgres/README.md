# Main PostgreSQL Database

**Isolated, conflict-free PostgreSQL setup for VibeStack main development.**

## Features

✅ **Completely isolated** - Uses its own network and container names  
✅ **Conflict-free** - Won't interfere with dev environments  
✅ **Simple management** - One-command start/stop  
✅ **wal2json enabled** - Full logical replication support  
✅ **Persistent data** - Uses external Docker volume  
✅ **Health monitoring** - Built-in readiness checks  

## Quick Start

```bash
cd main-postgres
./start.sh    # Start PostgreSQL
```

## All Commands

| Command | Description |
|---------|-------------|
| `./start.sh` | Start main PostgreSQL (safe, checks for conflicts) |
| `./stop.sh` | Stop main PostgreSQL |
| `./psql.sh` | Connect with psql client |
| `./logs.sh` | View PostgreSQL logs |
| `./backup.sh` | Create timestamped backup |

## Connection Details

- **Host**: localhost:5432
- **Database**: vibestack_dev
- **User**: postgres
- **Password**: postgres
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/vibestack_dev`

## Container Details

- **Container Name**: `vibestack-main-postgres`
- **Network**: `vibestack-main-network` (isolated)
- **Volume**: `vibestack_main_postgres_data` (external, persistent)
- **Image**: Custom built with wal2json extension

## Isolation Strategy

This setup is completely isolated from dev environments:

1. **Unique container names** - `vibestack-main-postgres` vs `vibestack-dev1-postgres`
2. **Separate networks** - `vibestack-main-network` vs environment-specific networks  
3. **Different volumes** - `vibestack_main_postgres_data` vs dev environment volumes
4. **Port management** - Main uses 5432, dev environments use 5433+
5. **Conflict detection** - Start script checks for port conflicts

## Data Migration

To migrate from old setup:

```bash
# Stop old containers
cd ../docker-configs
docker compose down

# Start new main setup
cd ../main-postgres  
./start.sh

# Data should automatically migrate from vibestack_postgres_data volume
```

## Troubleshooting

### Port 5432 Already in Use
```bash
lsof -i :5432  # Find what's using the port
# Stop the conflicting service, then run ./start.sh
```

### Database Connection Issues
```bash
./logs.sh      # Check PostgreSQL logs
./psql.sh      # Test direct connection
```

### Container Won't Start
```bash
docker compose logs postgres  # Detailed error logs
docker system prune -f        # Clean up resources
```

## Development Workflow

1. **Start main database**: `./start.sh`
2. **Develop your app** (web/api servers connect to localhost:5432)
3. **Use dev environments** for testing (they use ports 5433+)
4. **Backup before major changes**: `./backup.sh`
5. **Stop when not needed**: `./stop.sh`

**The main database runs independently and won't conflict with any development environments.**