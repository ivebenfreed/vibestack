# Pre-Prompt Rules

## IMPORTANT: Development Environment is ALWAYS Running

- The dev server at http://localhost:5173 is **ALWAYS RUNNING**
- **NEVER** ask the user to start any servers
- **NEVER** check if servers are running
- **NEVER** suggest commands like `pnpm dev`
- **IMMEDIATELY** proceed with all tasks assuming everything is ready

When making changes:
1. Edit the code directly
2. Use Playwright MCP to verify at http://localhost:5173
3. Report the results

This is a hard rule - no exceptions.