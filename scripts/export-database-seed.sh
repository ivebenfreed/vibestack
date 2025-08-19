#!/bin/bash
# export-database-seed.sh - Export database to git-friendly SQL dump
# This replaces the large binary PostgreSQL files with a compact SQL dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📤 Exporting database to SQL dump...${NC}"

# Create data directory if it doesn't exist
mkdir -p "${PROJECT_ROOT}/data"

# Remove old binary files if they exist
if [[ -d "${PROJECT_ROOT}/data/postgres-live" ]]; then
    echo -e "${YELLOW}⚠️ Removing old binary PostgreSQL files...${NC}"
    rm -rf "${PROJECT_ROOT}/data/postgres-live"
fi

# Export schema and data to SQL dump
echo -e "${BLUE}📊 Creating SQL dump...${NC}"
pg_dump postgres://postgres:postgres@localhost:5432/vibestack_dev \
    --clean \
    --create \
    --if-exists \
    --no-owner \
    --no-privileges \
    --file="${PROJECT_ROOT}/data/database-seed.sql"

# Also create a minimal schema-only version for faster development
echo -e "${BLUE}📋 Creating schema-only dump...${NC}"
pg_dump postgres://postgres:postgres@localhost:5432/vibestack_dev \
    --schema-only \
    --clean \
    --create \
    --if-exists \
    --no-owner \
    --no-privileges \
    --file="${PROJECT_ROOT}/data/database-schema.sql"

# Show file sizes
echo -e "${GREEN}✅ Database exported successfully!${NC}"
echo -e "${BLUE}📊 File sizes:${NC}"
if [[ -f "${PROJECT_ROOT}/data/database-seed.sql" ]]; then
    echo "  📄 Full database: $(du -sh "${PROJECT_ROOT}/data/database-seed.sql" | cut -f1)"
fi
if [[ -f "${PROJECT_ROOT}/data/database-schema.sql" ]]; then
    echo "  📋 Schema only: $(du -sh "${PROJECT_ROOT}/data/database-schema.sql" | cut -f1)"
fi

echo -e "${GREEN}💡 Benefits:${NC}"
echo "  - Git-friendly file sizes"
echo "  - Version controlled database changes"  
echo "  - Cross-platform compatibility"
echo "  - Faster git operations"

echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "  1. Commit the SQL dump files to git"
echo "  2. Update worktree-start.sh to use SQL restoration"
echo "  3. Test container startup with new approach"