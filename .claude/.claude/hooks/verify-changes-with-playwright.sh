#!/bin/bash

# Claude Code Hook: Verify Changes with Playwright
# This hook runs after task completion to verify changes

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Starting Playwright verification...${NC}"

# Dev server is always running per .claude/rules.md
echo -e "${GREEN}✅ Proceeding with verification (dev server assumed running)${NC}"

# Create a temporary file for Claude to write verification instructions
VERIFICATION_FILE="/tmp/claude-playwright-verification-$(date +%s).md"

# Write verification instructions
cat > "$VERIFICATION_FILE" << 'EOF'
# Playwright Verification Tasks

Please verify the following using Playwright MCP:

## Quick Navigation Commands Available:
- Use `[data-testid="nav-link-tasks"]` to click on Tasks
- Use `[data-testid="nav-link-projects"]` to click on Projects
- Use `[data-testid="nav-link-dashboard"]` to click on Dashboard

## Verification Steps:

1. **Navigate to the application** at http://localhost:5173
2. **Check page loads correctly** without console errors
3. **Verify recent changes** are visible and functional
4. **Test navigation** using data-testid selectors:
   ```javascript
   // Example navigation
   await page.click('[data-testid="nav-link-tasks"]')
   await page.waitForLoadState('networkidle')
   ```
5. **Take screenshots** for visual confirmation

## Element Selectors for Common Tasks:
- Task table first row: `.vibegridx-row:first-child`
- Task title cell: `[data-column-id="title"]`
- Navigation links: `[data-testid="nav-link-{page-name}"]`
- Tab buttons: `button[role="tab"]:has-text("{Tab Name}")`

## Specific areas to check:
- If UI changes were made, verify they render correctly
- If functionality was added, test it works as expected
- If data changes were made, verify they appear in the UI
- Check for any console errors or warnings

Please provide a summary of the verification results.
EOF

echo -e "${GREEN}✅ Verification instructions created${NC}"
echo -e "${YELLOW}📋 Instructions saved to: $VERIFICATION_FILE${NC}"
echo -e "${BLUE}📍 Navigation helpers available:${NC}"
echo "   - Sidebar links have data-testid attributes"
echo "   - Use playwright-navigation-config.js for common patterns"
echo ""
echo -e "${YELLOW}Claude will now verify your changes using Playwright...${NC}"
echo ""

# Signal to Claude that verification is needed
echo "PLAYWRIGHT_VERIFY_NEEDED: $VERIFICATION_FILE"