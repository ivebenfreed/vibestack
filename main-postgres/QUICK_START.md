# Quick Start: Main PostgreSQL

**The main PostgreSQL database is now completely isolated and conflict-free.**

## ✅ Start Main PostgreSQL

```bash
cd main-postgres
./start.sh
```

## ✅ Verify Everything Works

```bash
# 1. Check PostgreSQL is running
docker ps | grep vibestack-main-postgres

# 2. Test database connection
./psql.sh

# 3. Start your development servers
cd ..
pnpm dev
```

## ✅ Management Commands

- `./start.sh` - Start main PostgreSQL (safe, checks for conflicts)
- `./stop.sh` - Stop main PostgreSQL  
- `./psql.sh` - Connect with psql
- `./logs.sh` - View PostgreSQL logs
- `./backup.sh` - Create timestamped backup

## 🔒 Isolation Features

✅ **Unique container name**: `vibestack-main-postgres` (no conflicts)  
✅ **Dedicated network**: `vibestack-main-network` (isolated)  
✅ **External volume**: `vibestack_main_postgres_data` (persistent)  
✅ **Port management**: Main uses 5432, dev environments use 5433+  
✅ **wal2json enabled**: Full logical replication support  
✅ **Conflict detection**: Start script checks for port conflicts  

## 🌐 Connection Details

- **Host**: localhost:5432
- **Database**: vibestack_dev  
- **User**: postgres
- **Password**: postgres
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/vibestack_dev`

## 🎯 Development Workflow

1. **Always start here**: `./start.sh` (in main-postgres folder)
2. **Run your app**: `pnpm dev` (in root folder) 
3. **Use dev environments**: They automatically use different ports (5433+)
4. **No conflicts**: Main and dev environments run simultaneously

**Your main PostgreSQL is now bulletproof and won't be affected by dev environment scripts.**