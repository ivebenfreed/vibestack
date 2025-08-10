#!/bin/bash

# Setup Environment Files on Target Machine
# Run this script in the root of your vibestack clone

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Setting up environment files${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
  echo -e "${RED}❌ Error: This doesn't look like the vibestack root directory${NC}"
  echo "Please run this script from the root of your vibestack clone"
  exit 1
fi

# Copy all environment files
echo -e "\n${YELLOW}📋 Copying environment files...${NC}\n"

if [ -d "env" ]; then
  # Copy all files preserving directory structure
  cp -r env/* . 2>/dev/null || true
  
  # Count what was copied
  count=$(find env -type f | wc -l)
  echo -e "${GREEN}✅ Copied ${count} environment files${NC}"
else
  echo -e "${RED}❌ No env directory found in package${NC}"
  exit 1
fi

# Copy additional config files if they exist
if [ -f "CLAUDE.md" ]; then
  cp CLAUDE.md ../CLAUDE.md 2>/dev/null || true
  echo -e "${GREEN}✅ Copied CLAUDE.md${NC}"
fi

if [ -f ".clauderc" ]; then
  cp .clauderc ../.clauderc 2>/dev/null || true
  echo -e "${GREEN}✅ Copied .clauderc${NC}"
fi

echo -e "\n${GREEN}✨ Environment setup complete!${NC}"
echo -e "\nNext steps:"
echo "  1. Review the environment files for any machine-specific settings"
echo "  2. Update DATABASE_URL in apps/server/.dev.vars if needed"
echo "  3. Run: ./scripts/init-local-from-remote.sh to setup database"
echo "  4. Run: pnpm install"
echo "  5. Run: pnpm dev:local"
