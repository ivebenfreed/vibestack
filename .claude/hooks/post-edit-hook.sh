#!/bin/bash

# Claude Code Post-Edit Hook with Playwright Verification
# This hook triggers after file edits to verify changes

# Get the edited file path from Claude Code environment
EDITED_FILE="${CLAUDE_EDITED_FILE:-}"
EDIT_TYPE="${CLAUDE_EDIT_TYPE:-}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🎯 Post-Edit Hook Triggered${NC}"
echo -e "Edited file: $EDITED_FILE"
echo -e "Edit type: $EDIT_TYPE"

# Only verify for specific file types that affect the UI
if [[ "$EDITED_FILE" =~ \.(tsx?|jsx?|css|scss)$ ]]; then
    echo -e "${YELLOW}🔍 UI-related file changed, triggering Playwright verification...${NC}"
    
    # Dev server is always running per .claude/rules.md
    echo -e "${GREEN}✅ Proceeding with UI verification${NC}"
    
    # Signal to Claude to perform Playwright verification
    echo "PLAYWRIGHT_VERIFY_UI_CHANGE"
    echo "Changed file: $EDITED_FILE"
    echo "Please verify the UI changes using Playwright MCP"
elif [[ "$EDITED_FILE" =~ \.(ts|js)$ ]] && [[ ! "$EDITED_FILE" =~ \.(test|spec)\. ]]; then
    echo -e "${YELLOW}📦 Logic file changed, consider running tests${NC}"
    echo "PLAYWRIGHT_VERIFY_LOGIC_CHANGE"
else
    echo -e "${BLUE}ℹ️  No UI verification needed for this file type${NC}"
fi