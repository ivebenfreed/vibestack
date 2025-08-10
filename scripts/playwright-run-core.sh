#!/bin/bash

# Run core Playwright tests in proper order
# Usage: ./scripts/playwright-run-core.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Running Core Playwright Tests${NC}"
echo ""

# 1. Run smoke tests first (quick health checks)
echo -e "${YELLOW}1️⃣ Running Smoke Tests (Quick Health Checks)${NC}"
npx playwright test tests/playwright/smoke --reporter=list
echo ""

# 2. Run core database tests (if any exist)
if [ -d "tests/playwright/core/database" ] && [ "$(ls -A tests/playwright/core/database/*.spec.js 2>/dev/null)" ]; then
    echo -e "${YELLOW}2️⃣ Running Core Database Tests${NC}"
    npx playwright test tests/playwright/core/database --reporter=list
    echo ""
fi

# 3. Run core sync tests (if any exist)
if [ -d "tests/playwright/core/sync" ] && [ "$(ls -A tests/playwright/core/sync/*.spec.js 2>/dev/null)" ]; then
    echo -e "${YELLOW}3️⃣ Running Core Sync Tests${NC}"
    npx playwright test tests/playwright/core/sync --reporter=list
    echo ""
fi

# 4. Run core UI tests (if any exist)
if [ -d "tests/playwright/core/ui" ] && [ "$(ls -A tests/playwright/core/ui/*.spec.js 2>/dev/null)" ]; then
    echo -e "${YELLOW}4️⃣ Running Core UI Tests${NC}"
    npx playwright test tests/playwright/core/ui --reporter=list
    echo ""
fi

echo -e "${GREEN}✅ Core tests completed!${NC}"
echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "   ✓ Smoke tests: Always run"
echo "   - Database tests: $(ls tests/playwright/core/database/*.spec.js 2>/dev/null | wc -l) tests"
echo "   - Sync tests: $(ls tests/playwright/core/sync/*.spec.js 2>/dev/null | wc -l) tests"
echo "   - UI tests: $(ls tests/playwright/core/ui/*.spec.js 2>/dev/null | wc -l) tests"