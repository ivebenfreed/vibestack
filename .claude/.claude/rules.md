# Claude Code Rules for VibeStack Project

## Development Environment Assumptions

### ALWAYS ASSUME DEV SERVERS ARE RUNNING
- **The development server is ALWAYS running on http://localhost:5173**
- **Never ask the user to start the dev server**
- **Never check if the dev server is running before making changes**
- **Never suggest running `pnpm dev`, `pnpm dev:web`, or similar commands**
- **Assume all necessary services are already running**

### Server Configuration
- Web development server: **http://localhost:5173** (ALWAYS RUNNING)
- Backend server (Cloudflare Worker): **http://localhost:8787** (ALWAYS RUNNING)
- API proxy: **http://localhost:5173/api** → **http://localhost:8787** (ALWAYS RUNNING)
- Database: **Always connected and available**
- All microservices: **Always operational**

### Workflow Rules
1. **Make code changes immediately** without checking server status
2. **Use Playwright for verification** without asking about server availability
3. **Navigate to localhost:5173** directly without confirmation
4. **Assume hot-reload is working** and changes are reflected immediately

### Prohibited Actions
- ❌ DO NOT ask "Is your dev server running?"
- ❌ DO NOT suggest "Please start the dev server"
- ❌ DO NOT check server status with curl or fetch
- ❌ DO NOT show commands like `pnpm dev` unless specifically asked
- ❌ DO NOT wait for server confirmation before proceeding

### Example Correct Behavior
When user says: "Change the button color to blue"
You should:
1. Make the code change immediately
2. Use Playwright to verify at http://localhost:5173
3. Take a screenshot showing the change
4. Report success

NOT:
- Ask if the server is running
- Tell them to start the server
- Check if localhost:5173 is accessible

## Playwright Verification Rules

### Always Verify Changes
- After making UI changes, automatically use Playwright to verify
- Navigate directly to http://localhost:5173 without checks
- Take screenshots to show the results
- Report any issues found during verification

### Navigation Patterns
- Use data-testid selectors when available
- Navigate using the sidebar for realistic user flows
- Always wait for network idle after navigation
- Assume the app is in a logged-in state unless told otherwise

## Error Handling
If Playwright encounters an error connecting to localhost:5173:
1. Report the specific error
2. Continue with the task
3. DO NOT suggest starting the server
4. Assume it's a temporary network issue

## Server Log Analysis Rules

### When Working on Backend Tasks
1. **Always check server logs** for any backend-related work
2. **Log analysis pattern**:
   - First, read the last 500 lines of the log
   - If relevant information not found, read the previous 500 lines
   - Continue in 500-line chunks until finding the relevant information
   - Use `tail -n 500` for recent logs, `tail -n +X | head -n 500` for older chunks

### Common Log Locations
- **Server logs**: `apps/server/logs/server.log` (all output with timestamps)
- **Terminal output**: Still visible where server is running (without timestamps)
- **Log rotation**: Every 24 hours and at 10MB size limit
- **Archives**: Old logs saved as `server.log.YYYYMMDD_HHMMSS`

### Log Analysis Commands
```bash
# Get last 500 lines
tail -n 500 /path/to/logfile

# Get lines 500-1000 (previous 500)
tail -n +500 /path/to/logfile | head -n 500

# Search for errors in logs
grep -i error /path/to/logfile | tail -n 100

# Get logs with timestamps
grep "2025-" /path/to/logfile | tail -n 500
```

### What to Look For
- Error messages and stack traces
- Database connection issues
- API endpoint failures
- WebSocket connection problems
- Sync-related errors
- Authentication failures

## Summary
**The dev environment is your constant. It's always there, always running, always ready. Code with confidence, verify with Playwright, and analyze logs for backend issues.**