# VibeStack Development Environment

Clean, simple development environment that runs from your project root.

## 🚀 Quick Start

```bash
# Start environment (first time)
./start.sh

# Enter development mode (starts servers + interactive shell)
./dev.sh

# Test servers are working
./test.sh

# Stop everything
./stop.sh
```

## 🏗️ Architecture

- **Container**: Ubuntu 22.04 + Node.js 20.19.4 + Chrome + Claude Code
- **Workspace**: `/workspace` mounts the parent directory (your vibestack project)
- **Services**: PostgreSQL + Chrome + Development container
- **Ports**: 5175 (web), 8789 (api), 5433 (db), 3001 (chrome)

## 📁 File Structure

```
vibestack/                    # Your project (workspace root)
├── apps/                     # Your apps
├── packages/                 # Your packages  
├── dev-env/                  # This folder
│   ├── start.sh             # Start all services
│   ├── dev.sh               # Enter development mode
│   ├── stop.sh              # Stop services
│   ├── test.sh              # Test servers
│   ├── docker-compose.yml   # Service definitions
│   └── Dockerfile           # Container definition
└── ... (all your files)
```

## 💡 Key Features

- ✅ **Node.js 20.19.4** - Compatible with Wrangler
- ✅ **Development servers work** - Both API and web start successfully  
- ✅ **Claude Code integrated** - Pre-installed, just run `claude`
- ✅ **Chrome + MCP Playwright** - Browser automation ready
- ✅ **Clean workflow** - Simple scripts, no complexity
- ✅ **Project files accessible** - Work directly on your code

## 🛠️ Inside the Container

Once you run `./dev.sh`, you're inside the container with:

```bash
# Your full project is at /workspace (which is your vibestack folder)
ls /workspace    # Shows: apps/ packages/ etc.

# All tools available
pnpm dev         # Start/restart dev servers
claude           # Start Claude Code  
pnpm test        # Run tests
pnpm build       # Build project

# Exit (servers keep running in background)
exit
```

## 🔧 Management

```bash  
# View logs
docker compose logs dev

# Rebuild container (after changes)
./stop.sh
docker compose build --no-cache
./start.sh

# Clean restart
./stop.sh && ./start.sh
```

## 🎯 Success Criteria

This is successful because:
1. **Simple** - Just 4 scripts: start, dev, test, stop
2. **Works** - Dev servers actually start and run
3. **Clean** - No complex file structures or nested folders
4. **Integrated** - Claude Code + MCP + Chrome ready to go
5. **Practical** - Work on your actual project files