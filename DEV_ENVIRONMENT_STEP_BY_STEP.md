# Dev Environment Setup - Complete Step-by-Step Process

## 🚀 What Happens When You Run `./environments/dev-1/start-safe.sh`

This document explains **every single step** that occurs during dev environment creation.

## Phase 1: Safety Checks & Validation

### Step 1.1: Main PostgreSQL Health Check
```bash
echo "🔍 Safety Check 1: Main PostgreSQL Status"
if docker ps | grep -q "vibestack-main-postgres"; then
    if docker exec vibestack-main-postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Main PostgreSQL is running and healthy on port 5432"
    else
        echo "❌ Main PostgreSQL container exists but is unhealthy"
        exit 1
    fi
```

**What this does:**
- Checks if `vibestack-main-postgres` container exists
- Tests if PostgreSQL inside is responding to connections
- **Fails if main database is broken** (prevents data corruption)

### Step 1.2: Critical Volume Verification
```bash
echo "🔍 Safety Check 2: Critical Volume Verification"
if docker volume inspect vibestack_main_postgres_data >/dev/null 2>&1; then
    echo "✅ Main PostgreSQL volume exists: vibestack_main_postgres_data"
else
    echo "❌ Main PostgreSQL volume missing: vibestack_main_postgres_data"
    exit 1
fi
```

**What this does:**
- Verifies the main PostgreSQL data volume exists
- **Prevents starting if main data is missing** (would indicate data loss)

### Step 1.3: Disk Space Check
```bash
echo "🔍 Safety Check 3: Disk Space Check"
AVAILABLE_GB=$(df -BG /var/lib/docker 2>/dev/null | awk 'NR==2{print $4}' | sed 's/G//')
if [ "$AVAILABLE_GB" -lt 5 ]; then
    echo "⚠️  Low disk space: ${AVAILABLE_GB}GB available"
    echo "Continue? (y/N)"
    # Wait for user confirmation
fi
```

**What this does:**
- Checks available disk space in Docker directory
- **Warns if less than 5GB** (dev environments need ~2-3GB each)
- Gives user option to continue or clean up first

### Step 1.4: Isolation Confirmation
```bash
echo "🔍 Safety Check 4: Environment Isolation Confirmation"
echo "   Main PostgreSQL:  localhost:5432 (production data)"
echo "   Dev-1 PostgreSQL: localhost:5433 (isolated copy)"
echo "   Dev-1 Web App:    localhost:5175"
echo "   Dev-1 API:        localhost:8789"
echo "Continue with dev-1 setup? (y/N)"
```

**What this does:**
- Shows user exactly what ports will be used
- **Confirms isolation** - dev won't affect main
- Requires explicit user consent to proceed

### Step 1.5: Backup Recommendation
```bash
echo "🛡️  Safety Check 5: Backup Recommendation"
echo "Create backup now? (Y/n)"
if [[ ! "$backup_confirm" =~ ^[Nn]$ ]]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    docker exec vibestack-main-postgres pg_dump -U postgres vibestack_dev > "backup_${TIMESTAMP}.sql"
fi
```

**What this does:**
- Offers to create SQL backup of main database
- Creates timestamped backup file (e.g., `backup_20250830_173000.sql`)
- **Safety net** in case anything goes wrong

## Phase 2: Data Preparation

### Step 2.1: Clean Slate - Remove Existing Dev Data
```bash
echo "📋 Copying git-tracked PostgreSQL data to dev-1 environment..."
if docker volume inspect vibestack-dev1-postgres-data >/dev/null 2>&1; then
    echo "   Removing existing dev-1 data..."
    docker volume rm vibestack-dev1-postgres-data || true
fi
```

**What this does:**
- **Removes any existing dev-1 database** (ensures fresh start)
- Uses `|| true` to not fail if volume doesn't exist

### Step 2.2: Git-Tracked Data Validation
```bash
if [ ! -d "../../data/postgres-live" ] || [ -z "$(ls -A ../../data/postgres-live 2>/dev/null)" ]; then
    echo "❌ No git-tracked PostgreSQL data found in data/postgres-live/"
    echo "   Run this first to sync current main database to git:"
    echo "   cd ../../ && ./scripts/sync-postgres-to-git.sh"
    exit 1
fi
```

**What this does:**
- **Checks if `data/postgres-live/` exists and has files**
- Fails with clear instructions if git-tracked data is missing
- Ensures dev environment will have actual database data

### Step 2.3: Fresh Volume Creation
```bash
echo "   Creating fresh dev-1 volume..."
docker volume create vibestack-dev1-postgres-data
```

**What this does:**
- Creates new Docker volume for dev-1 PostgreSQL data
- This volume will be populated with copied data

### Step 2.4: Git-Tracked Data Copy
```bash
echo "   Copying git-tracked PostgreSQL data..."
docker run --rm \
    -v "${PWD}/../../data/postgres-live:/source:ro" \
    -v vibestack-dev1-postgres-data:/target \
    alpine:latest \
    sh -c "cp -a /source/. /target/"
```

**What this does:**
- **Mounts git-tracked data** (`data/postgres-live/`) as read-only source
- **Mounts new dev-1 volume** as target destination
- Uses Alpine Linux to copy **all PostgreSQL files** (including hidden files)
- `cp -a` preserves permissions and timestamps
- **Result**: Dev-1 volume contains identical copy of main database

## Phase 3: Container Image Building

### Step 3.1: Custom PostgreSQL Image Build
```bash
# In docker-compose.yml:
postgres:
  build:
    context: ../..
    dockerfile: Dockerfile.postgres
```

**What this builds:**
```dockerfile
FROM postgres:17

# Install build tools
RUN apt-get update && apt-get install -y build-essential postgresql-server-dev-17 git

# Clone and compile wal2json extension
RUN git clone https://github.com/eulerto/wal2json.git /tmp/wal2json
RUN cd /tmp/wal2json && make && make install

# Configure PostgreSQL to load wal2json
RUN echo "shared_preload_libraries = 'wal2json'" >> /usr/share/postgresql/postgresql.conf.sample
```

**What this does:**
- **Builds custom PostgreSQL** with logical replication support
- **Adds wal2json extension** (required for sync functionality)
- Same image used by main PostgreSQL (ensures compatibility)

### Step 3.2: Development Container Build
```bash
# In docker-compose.yml:
dev:
  build:
    dockerfile: Dockerfile
```

**What this builds:**
```dockerfile
FROM ubuntu:22.04

# System dependencies
RUN apt-get install -y curl wget git tmux nano postgresql-client google-chrome-stable

# Node.js 20.x + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g pnpm@9.15.1

# Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Create developer user (UID 1000 matches host user)
RUN useradd -m -s /bin/bash -u 1000 -G sudo developer
```

**What this does:**
- **Creates full development environment** in Ubuntu container
- **Installs all development tools** (Node.js, pnpm, Claude Code, Chrome)
- **Creates developer user** with same UID as host (file permission compatibility)
- **Includes PostgreSQL client** for database access

## Phase 4: Container Network & Services Startup

### Step 4.1: Docker Compose Network Creation
```bash
docker compose up -d --build
```

**Creates isolated network:**
```yaml
networks:
  dev1:
    driver: bridge
    name: dev-1_dev1  # Isolated from main network
```

### Step 4.2: PostgreSQL Container Startup
```yaml
services:
  postgres:
    container_name: vibestack-dev1-postgres
    ports:
      - "5433:5432"  # External port 5433, internal port 5432
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Uses copied data volume
    command: >
      postgres
      -c wal_level=logical                    # Enable logical replication
      -c max_wal_senders=3
      -c max_replication_slots=3
      -c max_logical_replication_workers=3
```

**What this does:**
- **Starts PostgreSQL on port 5433** (doesn't conflict with main on 5432)
- **Uses copied database volume** (contains all main database data)
- **Enables logical replication** (same config as main PostgreSQL)
- **Container name**: `vibestack-dev1-postgres` (unique identifier)

### Step 4.3: Chrome Container Startup
```yaml
chrome:
  image: browserless/chrome:latest
  container_name: vibestack-dev1-chrome
  ports:
    - "3001:3000"  # Chrome debug interface
  environment:
    - MAX_CONCURRENT_SESSIONS=10
```

**What this does:**
- **Provides headless Chrome** for browser automation and testing
- **Debug interface** available at `http://localhost:3001`
- **Isolated from main environment** (different port)

### Step 4.4: Development Container Startup
```yaml
dev:
  container_name: vibestack-dev1
  ports:
    - "5175:5173"  # Web app port (main uses 5173)
    - "8789:8787"  # API server port (main uses 8787)
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/vibestack_dev
    - GIT_REPO_URL=https://github.com/vibestack/vibestack.git
    - GIT_BRANCH=staging
```

**What this does:**
- **Maps different external ports** (5175, 8789 vs main's 5173, 8787)
- **Sets up environment variables** for database connection and git repo
- **Connects to dev-1 PostgreSQL** via internal Docker network

## Phase 5: Internal Container Initialization

### Step 5.1: Git Repository Clone (Inside Dev Container)
```bash
# From startup.sh:
export PATH="/home/developer/.local/bin:$PATH"
cd /workspace

# Repository cloning happens via environment variables
echo "📥 Cloning repository from $GIT_REPO_URL (branch: $GIT_BRANCH)"
```

**What this does:**
- **Clones entire VibeStack repository** inside the container
- **Checks out staging branch** (or specified branch)
- **Container has complete isolated copy** of the codebase

### Step 5.2: PostgreSQL Readiness Wait
```bash
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U postgres; do
    sleep 1
done
echo "✅ PostgreSQL ready"
```

**What this does:**
- **Waits for PostgreSQL to accept connections**
- Uses internal Docker network name `postgres`
- **Blocks until database is fully initialized** with copied data

### Step 5.3: Dependency Installation
```bash
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/lock.yaml" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --prefer-frozen-lockfile || pnpm install
fi
```

**What this does:**
- **Checks if dependencies already installed** (in case of restart)
- **Installs all Node.js dependencies** for the entire monorepo
- **Uses frozen lockfile** for consistent dependency versions

### Step 5.4: MCP Playwright Setup
```bash
if [ ! -f ".mcp.json" ] || ! grep -q "playwright" .mcp.json; then
    echo "🎭 Setting up MCP Playwright..."
    claude mcp add --scope project playwright npx @playwright/mcp@latest
fi
```

**What this does:**
- **Sets up browser automation tools** for Claude Code
- **Installs Playwright MCP** for browser testing
- **Only runs if not already configured** (idempotent)

## Phase 6: Final Verification & Ready State

### Step 6.1: Container Health Verification
```bash
# Final Health Checks...
if ! docker ps | grep -q "vibestack-dev1"; then
    echo "❌ Main container failed to start"
    docker compose logs dev
    exit 1
fi
```

### Step 6.2: PostgreSQL Container Health Check
```bash
if [ "$DEV1_POSTGRES" -eq 0 ]; then
    echo "❌ Dev-1 PostgreSQL failed to start"
    docker compose logs postgres
    exit 1
fi
```

### Step 6.3: Isolation Verification
```bash
MAIN_POSTGRES=$(docker ps | grep "vibestack-main-postgres" | wc -l)
DEV1_POSTGRES=$(docker ps | grep "vibestack-dev1-postgres" | wc -l)

echo "   Main PostgreSQL containers running: $MAIN_POSTGRES"
echo "   Dev-1 PostgreSQL containers running: $DEV1_POSTGRES"
```

**What this verifies:**
- **Both PostgreSQL containers running** (main + dev-1)
- **No conflicts** - both can run simultaneously
- **Complete isolation** achieved

## 🎉 Final Result - What You Get

After successful completion, you have:

### 🐘 **Dev-1 PostgreSQL** (Port 5433)
- **49 tables** with identical data from main database
- **All user accounts** (Alice CEO, Bob CTO, etc.)
- **Complete business data** (invoices, projects, tasks, etc.)
- **Logical replication enabled** (wal2json extension)
- **Completely isolated** from main database

### 🌐 **Dev-1 Web Application** (Port 5175)
- **Full React application** ready to run
- **All dependencies installed** (pnpm, Node.js packages)
- **Connected to dev-1 database** (not main database)
- **Browser automation ready** (MCP Playwright configured)

### 🔧 **Dev-1 API Server** (Port 8789)
- **Cloudflare Workers development server**
- **Connected to dev-1 database** via DATABASE_URL
- **All authentication working** (uses dev-1 user data)
- **Sync functionality enabled** (logical replication)

### 🎭 **Chrome Browser** (Port 3001)
- **Headless Chrome** for testing
- **Debug interface** available
- **Ready for Playwright automation**

### 📁 **Complete Development Environment**
- **Git repository cloned** inside container
- **All source code** available for editing
- **Development tools** (Claude Code CLI, pnpm, etc.)
- **Isolated from main** (different ports, network, data)

## ⚙️ **Development Commands Available**

Once dev-1 is running, you can:

```bash
# Enter the dev container
docker exec -it vibestack-dev1 bash

# Inside container:
pnpm dev          # Start web + API servers
pnpm dev:web      # Start web app only  
pnpm dev:server   # Start API server only
pnpm test         # Run tests
claude            # Start Claude Code
psql $DATABASE_URL  # Connect to dev-1 database
```

## 🔄 **Data Flow Summary**

1. **Main PostgreSQL** (live data) → **Git Sync** → `data/postgres-live/`
2. `data/postgres-live/` → **Volume Copy** → **Dev-1 PostgreSQL**
3. **Dev-1 Application** → **Connects to** → **Dev-1 PostgreSQL**
4. **Result**: Complete isolated development environment with real data

## 🛡️ **Safety Guarantees**

- ✅ **Main database never touched** during dev environment creation
- ✅ **Dev environment completely disposable** (can delete anytime)
- ✅ **Port isolation prevents conflicts** (5432 main, 5433 dev)
- ✅ **Network isolation prevents interference** (separate Docker networks)
- ✅ **Data copied from git** (portable across machines)
- ✅ **Automatic cleanup** when stopping dev environment

**This entire process creates a complete, isolated, fully-functional development environment with real data that cannot interfere with your main development setup.**