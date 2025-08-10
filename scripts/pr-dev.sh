#!/bin/bash

# PR Development Environment Manager
# Manages Docker containers and dev servers for PR-based development

set -e

PR_NUMBER=${PR_NUMBER:-0}
ACTION=${1:-start}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Calculate ports
BASE_SERVER_PORT=8787
BASE_WEB_PORT=5173
BASE_DB_PORT=5432
BASE_PROXY_PORT=4444

OFFSET=$((PR_NUMBER))
export SERVER_PORT=$((BASE_SERVER_PORT + OFFSET))
export WEB_PORT=$((BASE_WEB_PORT + OFFSET))
export DB_PORT=$((BASE_DB_PORT + OFFSET))
export PROXY_PORT=$((BASE_PROXY_PORT + OFFSET))

echo -e "${BLUE}🔧 PR Development Environment Manager${NC}"
echo -e "${BLUE}=====================================

"
echo "PR Number: ${PR_NUMBER}"
echo "Server Port: ${SERVER_PORT}"
echo "Web Port: ${WEB_PORT}"
echo "Database Port: ${DB_PORT}"
echo "Neon Proxy Port: ${PROXY_PORT}"
echo ""

case $ACTION in
  start)
    echo -e "${GREEN}Starting PR #${PR_NUMBER} environment...${NC}"
    
    # Generate port configuration
    USE_LOCAL_DB=true node scripts/setup-dev-ports.js
    
    # Start Docker containers
    echo -e "${BLUE}Starting Docker containers...${NC}"
    docker-compose -f docker-compose.dev.yml up -d
    
    # Wait for database to be ready
    echo -e "${BLUE}Waiting for database...${NC}"
    sleep 5
    
    # Run migrations
    echo -e "${BLUE}Running migrations...${NC}"
    DATABASE_URL="postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_pr_${PR_NUMBER}" \
      pnpm forge:migrate:run
    
    echo -e "${GREEN}✅ Environment ready!${NC}"
    echo ""
    echo "Access points:"
    echo "- Web: http://localhost:${WEB_PORT}"
    echo "- API: http://localhost:${SERVER_PORT}"
    echo "- Neon Proxy: http://db.localtest.me:${PROXY_PORT}/sql"
    echo "- PostgreSQL: postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_pr_${PR_NUMBER}"
    echo ""
    echo "Start dev servers with: PR_NUMBER=${PR_NUMBER} pnpm dev:pr"
    ;;
    
  stop)
    echo -e "${RED}Stopping PR #${PR_NUMBER} environment...${NC}"
    docker-compose -f docker-compose.dev.yml stop
    echo -e "${GREEN}✅ Environment stopped${NC}"
    ;;
    
  destroy)
    echo -e "${RED}Destroying PR #${PR_NUMBER} environment...${NC}"
    docker-compose -f docker-compose.dev.yml down -v
    rm -f apps/web/.env.pr-${PR_NUMBER}
    rm -f apps/server/.env.pr-${PR_NUMBER}
    echo -e "${GREEN}✅ Environment destroyed${NC}"
    ;;
    
  status)
    echo -e "${BLUE}Environment Status:${NC}"
    docker-compose -f docker-compose.dev.yml ps
    ;;
    
  logs)
    docker-compose -f docker-compose.dev.yml logs -f
    ;;
    
  test)
    echo -e "${BLUE}Testing connection...${NC}"
    
    # Test direct PostgreSQL connection
    PGPASSWORD=postgres psql -h localhost -p ${DB_PORT} -U postgres -d vibestack_pr_${PR_NUMBER} -c "SELECT 1" >/dev/null 2>&1 && \
      echo -e "${GREEN}✅ PostgreSQL connection OK${NC}" || \
      echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    
    # Test Neon proxy
    curl -s -X POST http://db.localtest.me:${PROXY_PORT}/sql \
      -H "Content-Type: application/json" \
      -d '{"query":"SELECT 1"}' >/dev/null 2>&1 && \
      echo -e "${GREEN}✅ Neon proxy connection OK${NC}" || \
      echo -e "${RED}❌ Neon proxy connection failed${NC}"
    ;;
    
  *)
    echo "Usage: $0 {start|stop|destroy|status|logs|test}"
    exit 1
    ;;
esac