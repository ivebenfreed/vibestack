#!/bin/bash
# scripts/run-worktree-setup-tests.sh
# Runs the worktree setup tests to ensure auth and sync are working

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🧪 Running worktree setup tests...${NC}"

# Detect if we're in a worktree
CURRENT_DIR=$(pwd)
if [[ $CURRENT_DIR =~ issue-([0-9]+) ]]; then
    ISSUE_NUMBER="${BASH_REMATCH[1]}"
    echo -e "${YELLOW}📍 Detected issue #${ISSUE_NUMBER} worktree${NC}"
else
    echo -e "${YELLOW}📍 Running in main repository${NC}"
fi

# Ensure screenshots directory exists
mkdir -p screenshots

# Check if servers are running
echo -e "\n${YELLOW}🔍 Checking if development servers are running...${NC}"

# Get the correct port based on issue number
if [[ -n "$ISSUE_NUMBER" ]]; then
    WEB_PORT=$((5173 + $ISSUE_NUMBER))
    SERVER_PORT=$((8787 + $ISSUE_NUMBER))
else
    WEB_PORT=5173
    SERVER_PORT=8787
fi

# Check if web server is responding
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}" | grep -q "200\|302\|303"; then
    echo -e "${GREEN}   ✅ Web server is running on port ${WEB_PORT}${NC}"
else
    echo -e "${RED}   ❌ Web server not responding on port ${WEB_PORT}${NC}"
    echo -e "${YELLOW}   Please run: pnpm dev:local${NC}"
    exit 1
fi

# Check if API server is responding
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SERVER_PORT}/health" | grep -q "200\|404"; then
    echo -e "${GREEN}   ✅ API server is running on port ${SERVER_PORT}${NC}"
else
    echo -e "${RED}   ❌ API server not responding on port ${SERVER_PORT}${NC}"
    echo -e "${YELLOW}   Please run: pnpm dev:local${NC}"
    exit 1
fi

# Run the setup tests
echo -e "\n${YELLOW}🚀 Running setup tests...${NC}"

# First, run the initial auth setup test to create the browser profile
echo -e "\n${YELLOW}🔐 Setting up persistent browser profile with authentication...${NC}"
echo -e "${YELLOW}   Running: tests/playwright/core/initial-auth-setup.spec.js${NC}"
if npx playwright test tests/playwright/core/initial-auth-setup.spec.js; then
    echo -e "${GREEN}   ✅ Browser profile created successfully with authentication${NC}"
else
    echo -e "${RED}   ❌ Failed to create browser profile${NC}"
    echo -e "${YELLOW}   Make sure you have VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD in .env.local${NC}"
    exit 1
fi

# Then run any additional setup tests if they exist
if [[ -f "tests/playwright/worktree-setup.spec.js" ]]; then
    echo -e "\n${YELLOW}🧪 Running additional setup tests...${NC}"
    if [[ -f "./scripts/playwright-test.sh" ]]; then
        ./scripts/playwright-test.sh tests/playwright/worktree-setup.spec.js
    else
        npx playwright test tests/playwright/worktree-setup.spec.js
    fi
    SETUP_TEST_RESULT=$?
else
    # No additional setup tests, just mark as success
    SETUP_TEST_RESULT=0
fi

# Check test results
if [ $SETUP_TEST_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}✅ Worktree setup tests passed!${NC}"
    echo -e "${GREEN}   Your worktree is ready for development.${NC}"
    
    # List generated screenshots
    if ls screenshots/worktree-setup-*.png 1> /dev/null 2>&1; then
        echo -e "\n${YELLOW}📸 Screenshots saved:${NC}"
        ls -la screenshots/worktree-setup-*.png | awk '{print "   " $9}'
    fi
else
    echo -e "\n${RED}❌ Worktree setup tests failed!${NC}"
    echo -e "${YELLOW}   Please check the test output above for details.${NC}"
    
    # Show error screenshots if any
    if ls screenshots/worktree-setup-*error*.png 1> /dev/null 2>&1; then
        echo -e "\n${YELLOW}📸 Error screenshots:${NC}"
        ls -la screenshots/worktree-setup-*error*.png | awk '{print "   " $9}'
    fi
    
    exit 1
fi