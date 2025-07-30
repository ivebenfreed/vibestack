# Claude Code Playwright Verification Hooks

This directory contains hooks that automatically verify changes using Playwright MCP after task completion.

## Setup

1. **Hooks are already configured** in `.claude/settings.json`
2. **Playwright MCP is enabled** with `ALLOW_ALL_COMMANDS=true` in `.claude_config.json`
3. **Development server must be running** on `http://localhost:5173` for verification to work

## Available Hooks

### 1. Post-Edit Hook (`post-edit-hook.sh`)
- **Triggers**: After any file edit
- **Purpose**: Checks if UI-related files were changed and signals for Playwright verification
- **File types**: `.tsx`, `.jsx`, `.ts`, `.js`, `.css`, `.scss`

### 2. Task Completion Hook (`verify-changes-with-playwright.sh`)
- **Triggers**: After task completion
- **Purpose**: Comprehensive verification of all changes made during the task
- **Actions**: 
  - Navigates to the app
  - Checks for console errors
  - Verifies UI changes
  - Takes screenshots

## How It Works

1. When you ask Claude to make changes, the hooks will automatically trigger
2. If the dev server is running, Claude will:
   - Use Playwright MCP to navigate to your app
   - Verify that changes are visible
   - Check for any errors
   - Take screenshots as proof
3. You'll see the verification results in the Claude Code output

## Usage Example

```bash
# Start your dev server
pnpm dev:web

# Then in Claude Code, make a request like:
"Update the task title color to blue"

# Claude will:
1. Make the code changes
2. Trigger the post-edit hook
3. Use Playwright to verify the color changed
4. Show you a screenshot of the result
```

## Customization

You can modify the hooks to:
- Check specific pages or components
- Run additional tests
- Verify API responses
- Check database state

## Troubleshooting

- **Hook not triggering**: Restart Claude Code after adding/modifying hooks
- **Verification fails**: Ensure dev server is running on port 5173
- **Playwright errors**: Check that `ALLOW_ALL_COMMANDS=true` is set in `.claude_config.json`