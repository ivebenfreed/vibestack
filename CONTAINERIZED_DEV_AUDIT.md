# Containerized Development Environment - Complete Audit

## 🏗️ Architecture Overview

The VibeStack project has **two separate containerized PostgreSQL setups**:

1. **Main PostgreSQL** - Production-like database for primary development
2. **Dev Environment PostgreSQL** - Isolated testing environments (dev-1, dev-2, etc.)

## 📂 Directory Structure

```
vibestack/
├── main-postgres/              # Main PostgreSQL (isolated, conflict-free)
│   ├── docker-compose.yml      # Main PostgreSQL container config
│   ├── start.sh                # Safe startup with conflict detection
│   ├── stop.sh                 # Clean shutdown
│   ├── psql.sh                 # Direct database access
│   ├── logs.sh                 # PostgreSQL logs
│   └── backup.sh               # Timestamped backups
│
├── environments/dev-1/         # Dev-1 environment (isolated copy)
│   ├── docker-compose.yml      # Dev-1 services (PostgreSQL + Chrome + Dev container)
│   ├── start-safe.sh           # Safe startup with data copying from git
│   ├── startup.sh              # Internal container startup script
│   ├── Dockerfile              # Dev container (Ubuntu + Node + Chrome + PostgreSQL client)
│   └── stop.sh                 # Clean shutdown
│
├── data/postgres-live/         # Git-tracked PostgreSQL data (portable)
│   └── [PostgreSQL data files] # Complete database state in git
│
├── Dockerfile.postgres         # Custom PostgreSQL with wal2json extension
├── .git/hooks/pre-commit       # Auto-syncs PostgreSQL data to git
└── scripts/sync-postgres-to-git.sh  # Manual sync script
```

## 🐘 Main PostgreSQL Setup (Production-like)

### Purpose
- **Primary development database** for main application development
- **Completely isolated** from dev environments
- **Persistent data** that survives container restarts
- **wal2json enabled** for logical replication and sync functionality

### Container Configuration
```yaml
# main-postgres/docker-compose.yml
services:
  postgres:
    container_name: vibestack-main-postgres
    build:
      context: ..
      dockerfile: Dockerfile.postgres    # Custom PostgreSQL with wal2json
    ports:
      - "5432:5432"                     # Standard PostgreSQL port
    volumes:
      - vibestack_main_postgres_data:/var/lib/postgresql/data  # Persistent external volume
    networks:
      - vibestack-main-network          # Isolated network
    command: >
      postgres
      -c wal_level=logical              # Enable logical replication
      -c max_wal_senders=3
      -c max_replication_slots=3
      -c max_logical_replication_workers=3
```

### Custom PostgreSQL Image
```dockerfile
# Dockerfile.postgres
FROM postgres:17

# Install wal2json extension for logical replication
RUN apt-get update && apt-get install -y build-essential postgresql-server-dev-17 git
RUN git clone https://github.com/eulerto/wal2json.git /tmp/wal2json
RUN cd /tmp/wal2json && make && make install
RUN echo "shared_preload_libraries = 'wal2json'" >> /usr/share/postgresql/postgresql.conf.sample
```

### Startup Process (`main-postgres/start.sh`)
1. **Port Conflict Detection**: Checks if port 5432 is already in use
2. **Container Build**: Builds custom PostgreSQL image with wal2json
3. **Volume Creation**: Uses external volume `vibestack_main_postgres_data`
4. **Health Verification**: Waits for PostgreSQL to be ready
5. **Table Count Report**: Shows number of tables loaded (should be 49)

### Management Commands
- `./start.sh` - Safe startup with conflict detection
- `./stop.sh` - Clean shutdown
- `./psql.sh` - Direct database access
- `./logs.sh` - View PostgreSQL logs
- `./backup.sh` - Create timestamped SQL backup

## 🧪 Dev Environment Setup (dev-1, dev-2, etc.)

### Purpose
- **Isolated testing environments** for feature development
- **Complete application stack** (PostgreSQL + Web + API + Chrome)
- **Identical data** copied from git-tracked main database state
- **Different ports** to avoid conflicts with main environment

### Services Architecture
Each dev environment runs **4 containers**:

1. **PostgreSQL** (port 5433+) - Database with copied main data
2. **Dev Container** (ports 5175+, 8789+) - Full development environment
3. **Chrome** (port 3001+) - Browser for testing
4. **Network** - Isolated Docker network

### Dev-1 Container Configuration
```yaml
# environments/dev-1/docker-compose.yml
services:
  # PostgreSQL with copied main data
  postgres:
    build:
      context: ../..
      dockerfile: Dockerfile.postgres    # Same custom PostgreSQL as main
    container_name: vibestack-dev1-postgres
    ports:
      - "5433:5432"                     # Different port to avoid conflicts
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Fresh volume with copied data
    command: >
      postgres -c wal_level=logical     # Same config as main
      
  # Development container  
  dev:
    build:
      dockerfile: Dockerfile
    container_name: vibestack-dev1
    ports:
      - "5175:5173"                     # Web app port
      - "8789:8787"                     # API server port
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/vibestack_dev
      - GIT_REPO_URL=https://github.com/vibestack/vibestack.git
      - GIT_BRANCH=staging
      
  # Chrome for browser testing
  chrome:
    image: browserless/chrome:latest
    container_name: vibestack-dev1-chrome
    ports:
      - "3001:3000"                     # Chrome debug port
```

### Development Container (`environments/dev-1/Dockerfile`)
```dockerfile
FROM ubuntu:22.04

# System dependencies
RUN apt-get install -y curl wget git tmux nano postgresql-client google-chrome-stable

# Node.js 20.x LTS + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
RUN npm install -g pnpm@9.15.1

# Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Create developer user
RUN useradd -m -s /bin/bash -u 1000 -G sudo developer

CMD ["/workspace/startup.sh"]
```

### Data Copying Process (`environments/dev-1/start-safe.sh`)

**CRITICAL**: Dev environments use **git-tracked data**, not direct Docker volume copying.

#### Step-by-Step Data Copy Process:

1. **Safety Checks**:
   ```bash
   # Verify main PostgreSQL is healthy
   if docker ps | grep -q "vibestack-main-postgres"; then
       if docker exec vibestack-main-postgres pg_isready -U postgres; then
           echo "✅ Main PostgreSQL is running and healthy"
   ```

2. **Volume Preparation**:
   ```bash
   # Remove any existing dev-1 volume
   docker volume rm vibestack-dev1-postgres-data || true
   
   # Create fresh volume
   docker volume create vibestack-dev1-postgres-data
   ```

3. **Git-Tracked Data Validation**:
   ```bash
   # Check if git-tracked data exists
   if [ ! -d "../../data/postgres-live" ] || [ -z "$(ls -A ../../data/postgres-live)" ]; then
       echo "❌ No git-tracked PostgreSQL data found"
       echo "Run: ./scripts/sync-postgres-to-git.sh"
       exit 1
   fi
   ```

4. **Data Copy from Git**:
   ```bash
   # Copy git-tracked data to dev-1 volume
   docker run --rm \
       -v "${PWD}/../../data/postgres-live:/source:ro" \
       -v vibestack-dev1-postgres-data:/target \
       alpine:latest \
       sh -c "cp -a /source/. /target/"
   ```

5. **Container Startup**:
   ```bash
   # Start all dev-1 services
   docker compose up -d --build
   ```

### Internal Container Startup (`environments/dev-1/startup.sh`)

**Runs inside the dev container**:

1. **Git Repository Clone**:
   ```bash
   # Clone the VibeStack repository inside container
   git clone $GIT_REPO_URL /workspace
   cd /workspace && git checkout $GIT_BRANCH
   ```

2. **Dependency Installation**:
   ```bash
   # Install Node.js dependencies
   pnpm install --prefer-frozen-lockfile || pnpm install
   ```

3. **MCP Playwright Setup**:
   ```bash
   # Setup browser automation tools
   claude mcp add --scope project playwright npx @playwright/mcp@latest
   ```

4. **Database Wait**:
   ```bash
   # Wait for PostgreSQL to be ready
   until pg_isready -h postgres -p 5432 -U postgres; do
       sleep 1
   done
   ```

## 🔄 Git Integration & Data Sync

### Pre-commit Hook (`.git/hooks/pre-commit`)
```bash
#!/bin/bash
echo "🔄 Pre-commit: Syncing PostgreSQL data..."

# Only sync if main postgres container is running
if docker ps | grep -q vibestack-main-postgres; then
    ./scripts/sync-postgres-to-git.sh
    git add data/postgres-live/
    echo "✅ PostgreSQL data synced and staged for commit"
fi
```

### Manual Sync Script (`scripts/sync-postgres-to-git.sh`)
```bash
#!/bin/bash
# Copy live database state from main PostgreSQL volume to git-tracked location

# Check if main container is running
if ! docker ps | grep -q vibestack-main-postgres; then
    echo "❌ PostgreSQL container not running"
    exit 1
fi

# Copy current live data from container volume to git-tracked folder
docker run --rm \
    -v vibestack_main_postgres_data:/source:ro \
    -v "${PWD}/data/postgres-live:/target" \
    alpine:latest \
    sh -c "rm -rf /target/* && cp -a /source/. /target/"
```

## 🔒 Isolation & Safety Features

### Port Isolation
- **Main PostgreSQL**: 5432
- **Dev-1 PostgreSQL**: 5433
- **Dev-2 PostgreSQL**: 5434 (when created)
- **Main Web**: 5173
- **Dev-1 Web**: 5175
- **Main API**: 8787  
- **Dev-1 API**: 8789

### Network Isolation
- **Main**: `vibestack-main-network`
- **Dev-1**: `dev-1_dev1`
- **Dev-2**: `dev-2_dev2` (when created)

### Volume Isolation
- **Main**: `vibestack_main_postgres_data` (persistent)
- **Dev-1**: `vibestack-dev1-postgres-data` (temporary, recreated each start)
- **Dev-2**: `vibestack-dev2-postgres-data` (temporary, recreated each start)

### Safety Mechanisms

1. **Pre-flight Checks**: Verify main PostgreSQL health before starting dev environments
2. **Conflict Detection**: Check for port conflicts before binding
3. **Automatic Backups**: Option to backup main database before risky operations
4. **Clean Shutdown**: Removes all dev containers without affecting main
5. **Data Validation**: Ensures git-tracked data exists before copying

## 🚀 Development Workflow

### Starting Main Development
```bash
# 1. Start main PostgreSQL (always first)
cd main-postgres && ./start.sh

# 2. Start main development servers
cd .. && pnpm dev
```

### Starting Dev Environment  
```bash
# 3. Start isolated dev environment
cd environments/dev-1 && ./start-safe.sh

# Services available:
# - Web App: http://localhost:5175  
# - API Server: http://localhost:8789
# - PostgreSQL: localhost:5433
# - Chrome: http://localhost:3001
```

### Data Synchronization
```bash
# Sync current main database to git (manual)
./scripts/sync-postgres-to-git.sh

# Auto-sync happens on every git commit via pre-commit hook
git commit -m "your changes"  # Automatically syncs PostgreSQL data
```

## 🧪 Testing & Verification

### Verification Commands
```bash
# Check all running containers
docker ps | grep vibestack

# Test main PostgreSQL
docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Test dev-1 PostgreSQL  
docker exec vibestack-dev1-postgres psql -U postgres -d vibestack_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Compare data between main and dev-1
docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev -c "SELECT name, email FROM public.user LIMIT 3;"
docker exec vibestack-dev1-postgres psql -U postgres -d vibestack_dev -c "SELECT name, email FROM public.user LIMIT 3;"
```

### Expected Results
- **Main PostgreSQL**: 49 tables, full production data
- **Dev-1 PostgreSQL**: 49 tables, identical data copied from git
- **User Data**: Should match exactly between main and dev environments

## 🛡️ Security & Data Protection

### Data Protection
- **External volumes** prevent accidental data loss
- **Git-tracked backups** provide versioned database states
- **Automatic pre-commit sync** ensures data is always backed up
- **Isolated networks** prevent container interference

### Access Control
- **No external database exposure** (containers only)
- **Local development only** (no production data exposure)
- **Container isolation** prevents cross-environment contamination

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**: 
   - Check: `lsof -i :5432`
   - Solution: Stop conflicting services

2. **Volume Issues**:
   - Check: `docker volume ls | grep vibestack`
   - Solution: `docker volume prune` (careful with main volume!)

3. **Data Sync Issues**:
   - Check: `ls -la data/postgres-live/`
   - Solution: Run `./scripts/sync-postgres-to-git.sh`

4. **Container Startup Failures**:
   - Check: `docker compose logs postgres`
   - Common: wal_level configuration mismatch

## 🎯 Benefits of This Architecture

1. **Complete Isolation**: Main and dev environments never interfere
2. **Portable Data**: Git-tracked data works on any machine
3. **Consistent Testing**: All developers use identical database states
4. **Safe Development**: Dev environments can't corrupt main data
5. **Easy Cleanup**: Dev environments are disposable
6. **Automatic Backups**: Pre-commit hooks ensure data preservation
7. **Multiple Environments**: Easy to create dev-2, dev-3, etc.

## 📋 Audit Checklist

- [ ] Main PostgreSQL runs on port 5432 with persistent data
- [ ] Dev environments use ports 5433+ with temporary data  
- [ ] All PostgreSQL containers use custom Dockerfile.postgres with wal2json
- [ ] Dev environments copy data from git-tracked `data/postgres-live/`
- [ ] Pre-commit hook automatically syncs main data to git
- [ ] Networks and volumes are properly isolated
- [ ] Safety checks prevent conflicts and data loss
- [ ] Data integrity verified (49 tables, matching user records)

**✅ The containerized development setup provides complete isolation, data portability, and safety while maintaining development productivity.**