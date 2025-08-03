#!/bin/bash

# Claude Code Hook: Backend Work Log Analysis
# This hook triggers when backend-related work is detected

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get context from Claude Code
TASK_TYPE="${CLAUDE_TASK_TYPE:-}"
EDITED_FILES="${CLAUDE_EDITED_FILES:-}"

echo -e "${BLUE}🔍 Backend Work Detected${NC}"

# Check if this is backend-related work
if [[ "$EDITED_FILES" =~ (server|api|sync|auth|database) ]] || [[ "$TASK_TYPE" =~ (backend|api|server) ]]; then
    echo -e "${YELLOW}📋 Preparing log analysis instructions...${NC}"
    
    # Create log analysis instructions
    LOG_ANALYSIS_FILE="/tmp/claude-backend-log-analysis-$(date +%s).md"
    
    cat > "$LOG_ANALYSIS_FILE" << 'EOF'
# Backend Log Analysis Required

Since you're working on backend code, please analyze the server logs:

## Log Analysis Steps:

1. **Check Recent Logs** (last 500 lines)
   - Look for any errors or warnings
   - Check for successful API calls
   - Verify database connections
   - Monitor sync operations

2. **If Issues Found**, go back further:
   - Read previous 500 lines
   - Continue until finding relevant context
   - Look for the root cause of any errors

3. **Common Log Locations**:
   - Terminal where `pnpm dev:server` is running (port 8787)
   - Wrangler console output
   - Any `.log` files in the project

4. **Key Patterns to Search**:
   - Error messages: `grep -i error`
   - Database issues: `grep -i "database\|sql\|neon"`
   - API failures: `grep -i "api\|endpoint\|route"`
   - Sync problems: `grep -i "sync\|websocket\|replication"`

## Backend Server Info:
- Running on: http://localhost:8787
- Type: Cloudflare Worker
- Database: Neon PostgreSQL
- Observability: Enabled in wrangler.toml

Please check the logs and report any relevant findings.
EOF
    
    echo -e "${GREEN}✅ Log analysis instructions created${NC}"
    echo -e "${BLUE}📍 Backend server is running on port 8787${NC}"
    echo ""
    echo "BACKEND_LOG_ANALYSIS_NEEDED: $LOG_ANALYSIS_FILE"
else
    echo -e "${BLUE}ℹ️  No backend work detected, skipping log analysis${NC}"
fi