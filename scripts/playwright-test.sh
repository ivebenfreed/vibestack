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

# Calculate ports
if [[ "$ISSUE_NUMBER" == "main" ]]; then
    WEB_PORT=5173
    SERVER_PORT=8787
else
    WEB_PORT=$((5173 + ISSUE_NUMBER * 10))
    SERVER_PORT=$((8787 + ISSUE_NUMBER * 10))
fi

echo -e "${BLUE}🔧 Configuration:${NC}"
echo "   Issue: ${ISSUE_NUMBER}"
echo "   Web Port: ${WEB_PORT}"
echo "   Server Port: ${SERVER_PORT}"
echo "   Profile: ./.playwright/profiles/profile-${ISSUE_NUMBER}"
echo ""

# Check if servers are running
echo -e "${BLUE}🔍 Checking if dev servers are running...${NC}"
if curl -s "http://localhost:${WEB_PORT}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Web server is running on port ${WEB_PORT}${NC}"
else
    echo -e "${YELLOW}⚠️  Web server not detected on port ${WEB_PORT}${NC}"
    echo -e "${YELLOW}   Make sure to run: ./scripts/dev-start.sh${NC}"
    echo ""
fi

# Ensure Playwright directories exist
mkdir -p .playwright/profiles screenshots test-results

# Check if Playwright config exists
if [[ ! -f "playwright.config.js" ]]; then
    echo -e "${YELLOW}⚠️  playwright.config.js not found${NC}"
    echo -e "${YELLOW}   Run: node scripts/postinstall-worktree.js${NC}"
    echo ""
fi

# Check if @playwright/test is installed
if ! npm list @playwright/test > /dev/null 2>&1; then
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
    # No arguments, run all tests
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
echo "   Run with browser:    HEADLESS=false ./scripts/playwright-test.sh"
echo "   Force headless:      HEADLESS=true ./scripts/playwright-test.sh"
echo "   Debug mode:          ./scripts/playwright-test.sh --debug"
echo "   Screenshots saved:   ./screenshots/"
echo ""

exit $PLAYWRIGHT_EXIT_CODE