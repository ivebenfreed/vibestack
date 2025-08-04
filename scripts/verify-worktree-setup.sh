#!/bin/bash
# scripts/verify-worktree-setup.sh
# Verifies that a worktree is properly set up with auth and sync

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying worktree setup...${NC}"
echo ""

# Detect worktree
CURRENT_DIR=$(pwd)
if [[ $CURRENT_DIR =~ issue-([0-9]+) ]]; then
    ISSUE_NUMBER="${BASH_REMATCH[1]}"
    echo -e "${GREEN}✅ Issue #${ISSUE_NUMBER} worktree detected${NC}"
    WEB_PORT=$((5173 + $ISSUE_NUMBER * 10))
    SERVER_PORT=$((8787 + $ISSUE_NUMBER * 10))
    PROFILE_DIR=".playwright/profiles/profile-${ISSUE_NUMBER}"
else
    echo -e "${YELLOW}⚠️  Not in a worktree, using default ports${NC}"
    WEB_PORT=5173
    SERVER_PORT=8787
    PROFILE_DIR=".playwright/profiles/default"
fi

echo ""
echo -e "${YELLOW}📊 Configuration:${NC}"
echo "   Web Port: $WEB_PORT"
echo "   API Port: $SERVER_PORT"
echo "   Profile: $PROFILE_DIR"

# Check environment files
echo ""
echo -e "${YELLOW}📄 Checking environment files...${NC}"

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}   ✅ $1${NC}"
    else
        echo -e "${RED}   ❌ $1 (missing)${NC}"
        return 1
    fi
}

ENV_OK=true
check_file ".env.local" || ENV_OK=false
check_file "apps/server/.dev.vars" || ENV_OK=false
check_file "apps/server/.dev.vars.local" || ENV_OK=false
check_file "apps/web/.env.development" || ENV_OK=false

if [ "$ENV_OK" = false ]; then
    echo -e "${RED}   ⚠️  Some environment files are missing${NC}"
fi

# Check if credentials are configured
if [ -f ".env.local" ]; then
    if grep -q "VIBE_DEV_EMAIL" .env.local && grep -q "VIBE_DEV_PASSWORD" .env.local; then
        echo -e "${GREEN}   ✅ Login credentials configured${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Login credentials not found in .env.local${NC}"
        echo "      Add VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD to enable auth tests"
    fi
fi

# Check browser profile
echo ""
echo -e "${YELLOW}🌐 Checking browser profile...${NC}"
if [ -d "$PROFILE_DIR" ]; then
    echo -e "${GREEN}   ✅ Browser profile exists${NC}"
    # Check if profile has any data
    if [ "$(ls -A $PROFILE_DIR 2>/dev/null | wc -l)" -gt 0 ]; then
        echo -e "${GREEN}   ✅ Profile contains data (likely authenticated)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Profile is empty (needs authentication)${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  No browser profile found${NC}"
    echo "      Will be created on first test run"
fi

# Check if servers are running
echo ""
echo -e "${YELLOW}🚀 Checking servers...${NC}"

SERVER_RUNNING=false
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}" | grep -q "200\|302\|303"; then
    echo -e "${GREEN}   ✅ Web server is running${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SERVER_PORT}/health" | grep -q "200\|404"; then
        echo -e "${GREEN}   ✅ API server is running${NC}"
        SERVER_RUNNING=true
    else
        echo -e "${RED}   ❌ API server not responding${NC}"
    fi
else
    echo -e "${RED}   ❌ Web server not responding${NC}"
fi

# Summary and next steps
echo ""
echo -e "${BLUE}📋 Summary:${NC}"

if [ "$SERVER_RUNNING" = true ]; then
    echo -e "${GREEN}   ✅ Servers are running${NC}"
    echo ""
    echo -e "${YELLOW}🧪 Would you like to run the setup tests? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        ./scripts/run-worktree-setup-tests.sh
    fi
else
    echo -e "${YELLOW}   ⚠️  Servers are not running${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "   1. Start servers: pnpm dev:local"
    echo "   2. Run this script again to verify and test"
fi