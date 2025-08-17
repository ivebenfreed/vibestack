# Container Architecture Design

## Single Container Per Worktree

Each worktree runs a single Docker container containing all development services managed by supervisord.

### Container Internal Structure

```dockerfile
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-14 \
    supervisor \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and dependencies
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install

# Configure supervisor
COPY supervisord.conf /etc/supervisor/conf.d/vibestack.conf

# Standard internal ports (same in every container)
EXPOSE 5173  # Vite dev server
EXPOSE 8787  # Cloudflare Workers local
EXPOSE 5432  # PostgreSQL
EXPOSE 4444  # Neon proxy

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
```

### Supervisor Configuration

```ini
[supervisord]
nodaemon=true
user=root

[program:postgres]
command=/usr/lib/postgresql/14/bin/postgres -D /var/lib/postgresql/data
user=postgres
autostart=true
autorestart=true

[program:web]
command=pnpm dev:web
directory=/app
environment=PORT=5173
autostart=true
autorestart=true

[program:api]
command=pnpm dev:server
directory=/app
environment=PORT=8787
autostart=true
autorestart=true

[program:proxy]
command=docker run -p 4444:5432 ghcr.io/timowilhelm/local-neon-http-proxy
autostart=true
autorestart=true
```

## Port Mapping Strategy

### External Port Allocation

```bash
# Sequential external port mapping
ISSUE_NUMBER=60
BASE_WEB_PORT=6000
BASE_API_PORT=6100  
BASE_DB_PORT=6400

EXTERNAL_WEB_PORT=$((BASE_WEB_PORT + ISSUE_NUMBER))    # 6060
EXTERNAL_API_PORT=$((BASE_API_PORT + ISSUE_NUMBER))    # 6160
EXTERNAL_DB_PORT=$((BASE_DB_PORT + ISSUE_NUMBER))      # 6460
```

### Docker Run Command

```bash
docker run -d \
  --name "vibestack-issue-${ISSUE_NUMBER}" \
  -p "${EXTERNAL_WEB_PORT}:5173" \
  -p "${EXTERNAL_API_PORT}:8787" \
  -p "${EXTERNAL_DB_PORT}:5432" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/var/lib/postgresql/data" \
  -v "${PWD}:/app" \
  vibestack-dev:latest
```

## Environment Isolation

### Database Isolation

Each container gets a fresh copy of staging database:
- **Copy-on-start**: New volumes copied from staging state
- **Independent evolution**: Each worktree can modify data freely  
- **Consistent baseline**: All worktrees start from same staging data
- **No migration needed**: Simple copy operation vs complex migration replay

### File System Isolation

- **Code mounting**: Host worktree directory mounted as `/app`
- **Node modules**: Containerized to avoid version conflicts
- **Generated files**: Isolated build outputs per container

### Network Isolation

- **Internal networking**: All services communicate via localhost within container
- **External access**: Only mapped ports accessible from host
- **No conflicts**: Multiple containers run simultaneously without interference

## Resource Management

### Memory Usage

```bash
# Typical container resource usage
docker run --memory=2g --cpus=2 vibestack-dev:latest
```

### Shared Resources

- **Base images**: Docker layer caching reduces disk usage
- **Read-only mounts**: Package manager caches shared across containers
- **Efficient cleanup**: Automatic container lifecycle management

### Scaling Considerations

```bash
# Concurrent worktree capacity
System RAM: 16GB → ~6-8 active worktrees
System RAM: 32GB → ~12-15 active worktrees
```

## Container Lifecycle

### Startup Sequence

1. Container starts with supervisord
2. PostgreSQL initializes database
3. Web and API servers start
4. Health checks verify all services ready
5. External ports accessible

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:5173/health && \
      curl -f http://localhost:8787/health && \
      pg_isready -h localhost -p 5432
```

### Graceful Shutdown

```bash
# Stop container gracefully
docker stop vibestack-issue-60  # 10s timeout for clean shutdown
```

## Development Workflow Integration

### Container Management Commands

```bash
# Start worktree environment
./scripts/worktree-start.sh 60

# Check status
./scripts/worktree-status.sh 60

# View logs
./scripts/worktree-logs.sh 60

# Stop environment  
./scripts/worktree-stop.sh 60
```

### IDE Integration

- **VS Code**: Remote container development support
- **Port forwarding**: Automatic port detection and forwarding
- **Debugging**: Attach debugger to containerized Node.js processes