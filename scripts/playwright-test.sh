#!/bin/bash

# playwright-test.sh - Run Playwright tests with isolated profiles
# Usage: ./scripts/playwright-test.sh [test-file] [options]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Playwright Test Runner${NC}"
echo ""

# Check if we're in a Git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a Git repository${NC}"
    exit 1
fi

# Get current branch and calculate issue number
BRANCH_NAME=$(git branch --show-current)
ISSUE_NUMBER=""

if [[ "$BRANCH_NAME" =~ (issue-|feature-|pr-)([0-9]+) ]]; then
    ISSUE_NUMBER="${BASH_REMATCH[2]}"
    echo -e "${GREEN}📊 Detected Issue #${ISSUE_NUMBER} from branch: ${BRANCH_NAME}${NC}"
elif [[ -n "${PR_NUMBER:-}" ]]; then
    ISSUE_NUMBER="$PR_NUMBER"
    echo -e "${GREEN}📊 Using Issue #${ISSUE_NUMBER} from PR_NUMBER environment${NC}"
else
    ISSUE_NUMBER="main"
    echo -e "${YELLOW}📊 Using main branch configuration${NC}"
fi

# Load environment from .env.local (single source of truth)
if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
else
    echo -e "${YELLOW}⚠️  No .env.local found. Creating configuration...${NC}"
    ./scripts/configure-worktree-env.sh
    set -a
    source .env.local
    set +a
fi

# Export DEV_PORT for Playwright config to use (single unified port)
export DEV_PORT
export PR_NUMBER="$ISSUE_NUMBER"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo "   Issue: ${ISSUE_NUMBER}"
echo "   Port: ${DEV_PORT}"
echo "   Profile: ./.playwright/profiles/profile-${ISSUE_NUMBER}"
echo ""

# Check if unified dev server is running
echo -e "${BLUE}🔍 Checking if unified dev server is running...${NC}"

# Check unified server - web app and API on same port
WEB_RESPONSE=$(curl -s "http://localhost:${DEV_PORT}" 2>/dev/null || echo "")
API_RESPONSE=$(curl -s "http://localhost:${DEV_PORT}/health" 2>/dev/null || echo "")

if [[ -n "$WEB_RESPONSE" ]] && [[ "$WEB_RESPONSE" == *"<div id=\"root\""* ]]; then
    echo -e "${GREEN}✅ Unified dev server is running on port ${DEV_PORT}${NC}"
else
    echo -e "${RED}❌ Unified dev server not properly serving app on port ${DEV_PORT}${NC}"
    echo -e "${YELLOW}   Make sure to run: pnpm dev${NC}"
    echo ""
    echo -e "${RED}ABORTING: Cannot run tests without dev server${NC}"
    exit 1
fi

# Ensure Playwright directories exist
mkdir -p .playwright/profiles screenshots test-results

# Check if Playwright config exists
if [[ ! -f "playwright.config.js" ]]; then
    echo -e "${YELLOW}⚠️  playwright.config.js not found${NC}"
    echo -e "${YELLOW}   Run: node scripts/postinstall-worktree.js${NC}"
    echo ""
fi

# Check if @playwright/test is installed (suppress npm warnings)
if ! npm list @playwright/test --depth=0 2>/dev/null | grep -q "@playwright/test"; then
    echo -e "${YELLOW}⚠️  @playwright/test not installed${NC}"
    echo -e "${YELLOW}   Run: pnpm add -D @playwright/test -w${NC}"
    echo ""
fi

# Run Playwright tests
echo -e "${BLUE}🚀 Running Playwright tests...${NC}"
echo ""

# Check for headless mode preference
if [[ "${HEADLESS:-}" == "false" ]]; then
    echo -e "${YELLOW}🖥️  Running in headed mode (browser visible)${NC}"
elif [[ "${HEADLESS:-}" == "true" ]]; then
    echo -e "${BLUE}🤖 Running in headless mode (no browser window)${NC}"
else
    echo -e "${BLUE}🤖 Running in headless mode by default (set HEADLESS=false to see browser)${NC}"
fi

# Pass all arguments to Playwright
if [[ $# -eq 0 ]]; then
    # No arguments, run all tests (headless by default)
    npx playwright test
else
    # Pass through all arguments
    npx playwright test "$@"
fi

PLAYWRIGHT_EXIT_CODE=$?

echo ""
if [[ $PLAYWRIGHT_EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}✅ Playwright tests completed successfully${NC}"
else
    echo -e "${RED}❌ Playwright tests failed with exit code ${PLAYWRIGHT_EXIT_CODE}${NC}"
fi

# Show helpful commands
echo ""
echo -e "${BLUE}📋 Helpful commands:${NC}"
echo "   View HTML report:    npx playwright show-report"
echo "   Run specific test:   ./scripts/playwright-test.sh tests/playwright/vibegantt-screenshot.spec.js"
echo "   Run with browser UI: ./scripts/playwright-test.sh --headed"
echo "   Debug mode:          ./scripts/playwright-test.sh --debug"
echo "   Screenshots saved:   ./screenshots/"
echo ""

exit $PLAYWRIGHT_EXIT_CODE