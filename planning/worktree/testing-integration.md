# Testing System Integration

## Overview

The container-based worktree system requires updates to Playwright tests and test infrastructure to handle dynamic port mapping while maintaining the persistent browser profile system.

## Current Testing Issues

### Hardcoded URLs

Tests currently hardcode internal ports that won't work with containers:

```javascript
// ❌ Current hardcoded approach
await page.goto('http://localhost:5173/sign-in');
await page.request.post('http://localhost:8787/api/debug/table-data');
```

### Port Detection Problems

Existing port detection in `scripts/playwright-test.sh` uses arithmetic:

```bash
# ❌ Current brittle port calculation
WEB_PORT=$((5173 + $ISSUE_NUMBER))
SERVER_PORT=$((8787 + $ISSUE_NUMBER))
```

## Container-Aware Testing Solution

### Dynamic URL Configuration

Update all tests to use environment-based URLs:

```javascript
// ✅ Container-aware approach
const WEB_PORT = process.env.WEB_PORT || 5173;
const SERVER_PORT = process.env.SERVER_PORT || 8787;
const BASE_URL = `http://localhost:${WEB_PORT}`;

await page.goto(`${BASE_URL}/sign-in`);
await page.request.post(`http://localhost:${SERVER_PORT}/api/debug/table-data`);
```

### Test Environment Detection

```javascript
// tests/playwright/fixtures/container-aware.js
import { test as base } from '@playwright/test';

const test = base.extend({
  baseURL: async ({}, use) => {
    const webPort = process.env.WEB_PORT || 5173;
    await use(`http://localhost:${webPort}`);
  },
  
  apiURL: async ({}, use) => {
    const serverPort = process.env.SERVER_PORT || 8787;
    await use(`http://localhost:${serverPort}`);
  }
});

export { test, expect } from '@playwright/test';
```

## Updated Test Runner

### Container Port Detection

```bash
#!/bin/bash
# scripts/playwright-test.sh - Container-aware version

# Detect issue number (unchanged)
ISSUE_NUMBER=$(detect_issue_number)

# Calculate external container ports
if [ "$ISSUE_NUMBER" != "0" ] && [ "$ISSUE_NUMBER" != "main" ]; then
    export WEB_PORT=$((6000 + ISSUE_NUMBER))
    export SERVER_PORT=$((6100 + ISSUE_NUMBER))
    export DB_PORT=$((6400 + ISSUE_NUMBER))
    export BASE_URL="http://localhost:$WEB_PORT"
else
    # Main branch uses standard ports (no container)
    export WEB_PORT=5173
    export SERVER_PORT=8787
    export DB_PORT=5432
    export BASE_URL="http://localhost:$WEB_PORT"
fi

# Wait for container health before running tests
./scripts/wait-for-container-health.sh "$ISSUE_NUMBER"

# Run tests with container environment
npx playwright test "$@"
```

### Container Health Verification

```bash
#!/bin/bash
# scripts/wait-for-container-health.sh

ISSUE_NUMBER="$1"
CONTAINER_NAME="vibestack-issue-${ISSUE_NUMBER}"
MAX_WAIT=120  # 2 minutes

echo "⏳ Waiting for container $CONTAINER_NAME to be healthy..."

for i in $(seq 1 $MAX_WAIT); do
    if docker exec "$CONTAINER_NAME" curl -f http://localhost:5173/health >/dev/null 2>&1 && \
       docker exec "$CONTAINER_NAME" curl -f http://localhost:8787/health >/dev/null 2>&1 && \
       docker exec "$CONTAINER_NAME" pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo "✅ Container is healthy and ready for testing"
        exit 0
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
        echo "⏳ Still waiting... (${i}/${MAX_WAIT}s)"
    fi
    
    sleep 1
done

echo "❌ Container failed to become healthy within ${MAX_WAIT}s"
exit 1
```

## Playwright Configuration Updates

### Base Configuration

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Dynamic base URL from environment
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
  
  webServer: {
    // Don't start servers - containers handle this
    command: null,
    url: process.env.BASE_URL || 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,  // Wait for container startup
  },
  
  projects: [
    {
      name: 'persistent-context',
      use: {
        // Browser profile per worktree
        storageState: `.playwright/profiles/profile-${process.env.ISSUE_NUMBER || 'main'}/state.json`,
      },
    },
  ],
});
```

### Browser Profile Management

Each worktree maintains its own persistent browser profile:

```bash
# Browser profiles per container
.playwright/profiles/profile-main/       # Main branch
.playwright/profiles/profile-60/         # Issue 60 container
.playwright/profiles/profile-61/         # Issue 61 container
```

## Test File Updates

### Core Test Fixtures

```javascript
// tests/playwright/fixtures/persistent-context.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ browser }, use) => {
    const issueNumber = process.env.ISSUE_NUMBER || 'main';
    const context = await browser.newContext({
      storageState: `.playwright/profiles/profile-${issueNumber}/state.json`,
    });
    
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
```

### Example Test Updates

```javascript
// Before: Hardcoded URLs
import { test, expect } from '@playwright/test';

test('debug page loads', async ({ page }) => {
  await page.goto('http://localhost:5173/debug/livestore-test');
  await expect(page).toHaveTitle(/Debug/);
});

// After: Container-aware
import { test, expect } from '../fixtures/persistent-context.js';

test('debug page loads', async ({ page }) => {
  const baseURL = process.env.BASE_URL || 'http://localhost:5173';
  await page.goto(`${baseURL}/debug/livestore-test`);
  await expect(page).toHaveTitle(/Debug/);
});
```

## Test Automation Integration

### Pre-test Container Startup

```bash
# tests/playwright/setup/container-startup.spec.js
import { test } from '@playwright/test';

test.beforeAll(async () => {
  const issueNumber = process.env.ISSUE_NUMBER;
  if (issueNumber && issueNumber !== 'main') {
    // Ensure container is running and healthy
    await exec(`./scripts/worktree-start.sh ${issueNumber}`);
    await exec(`./scripts/wait-for-container-health.sh ${issueNumber}`);
  }
});
```

### Post-test Cleanup

```bash
# Optional: Stop containers after tests
test.afterAll(async () => {
  const issueNumber = process.env.ISSUE_NUMBER;
  if (process.env.CLEANUP_CONTAINERS === 'true' && issueNumber !== 'main') {
    await exec(`./scripts/worktree-stop.sh ${issueNumber}`);
  }
});
```

## Migration Path

### Phase 1: Update Test Infrastructure
1. Create container-aware test fixtures
2. Update test runner script for port detection
3. Add container health checks

### Phase 2: Update Individual Tests
1. Replace hardcoded URLs with environment variables
2. Update API request endpoints
3. Test with both current and container systems

### Phase 3: Verify Test Compatibility
1. Run tests against current tmux-based system
2. Run tests against new container system
3. Ensure browser profiles work with both approaches

This ensures tests work seamlessly whether running against the current port-based system or the new container-based system during the migration period.