# Playwright Tests

## ⚠️ **IMPORTANT: Test Execution Order**

### 🚨 **MUST RUN FIRST (New Worktree Setup)**
```bash
# 1. Initial Authentication Setup - RUN THIS FIRST!
npx playwright test tests/playwright/setup/01-initial-auth.spec.js

# 2. Then run smoke tests to verify
npx playwright test tests/playwright/smoke
```

## 📁 Test Suite Organization

### Core Test Suites
- **`setup/`** - One-time setup tests (auth, environment validation)
- **`smoke/`** - Quick essential tests (app loads, auth works)
- **`sync/`** - Synchronization tests with XState monitoring
- **`auth/`** - Authentication flows (login, logout, sessions)
- **`error-scenarios/`** - Error handling and recovery tests
- **`ui/`** - User interface interaction tests

### Additional Folders
- **`core/`** - Core functionality (database, sync, UI)
- **`features/`** - Feature-specific tests (tasks, gantt, projects)
- **`helpers/`** - Shared utilities and fixtures (not tests)
- **`fixtures/`** - Test fixtures and context helpers
- **`debug/`** - Debugging/diagnostic tests
- **`issue-N/`** - Issue-specific tests for worktrees
- **`docs/`** - Documentation and templates

## 🚀 Quick Start

### First Time Setup (New Worktree)
```bash
npx playwright test tests/playwright/setup/01-initial-auth.spec.js
```

### Run Essential Baseline Tests
```bash
# Smoke tests - verify app works
./scripts/playwright-test.sh tests/playwright/smoke

# Sync tests - verify data synchronization
./scripts/playwright-test.sh tests/playwright/sync

# UI tests - verify basic interactions
./scripts/playwright-test.sh tests/playwright/ui
```

### Run Specific Test Suites
```bash
# Authentication tests
./scripts/playwright-test.sh tests/playwright/auth

# Error scenario tests
./scripts/playwright-test.sh tests/playwright/error-scenarios

# All core functionality
./scripts/playwright-test.sh tests/playwright/core
```

## 📊 Test Coverage Areas

### Synchronization (sync/)
- **Initial sync** - Fresh client data population
- **Catchup sync** - Client reconnection and LSN updates
- **Live sync** - Real-time multi-tab synchronization
- Uses XState inspection for state monitoring

### Authentication (auth/)
- **Login flow** - Valid/invalid credentials, validation
- **Logout flow** - Session cleanup, state clearing
- **Session persistence** - Across reloads and navigation
- **Error handling** - Network failures, malformed data

### Error Scenarios (error-scenarios/)
- **Network failures** - Offline mode, reconnection
- **Server errors** - 500/503/429 responses
- **Sync conflicts** - Concurrent modifications
- **Data corruption** - Invalid data handling

### UI Interactions (ui/)
- **Task CRUD** - Create, read, update, delete tasks
- **Project management** - Project operations and navigation
- **Navigation** - Routing, breadcrumbs, deep linking
- **Search/Filter** - Search functionality and filtering

## ✍️ Writing Tests

Use the template: `docs/test-template.spec.js`

### Import the persistent context fixture:
```javascript
import { test, expect } from '../fixtures/persistent-context.js';
```

### XState Monitoring
```javascript
// Add test markers
await page.evaluate(() => {
  window.xstateTestInspector?.addMarker('Test phase: Starting operation');
});

// Check sync state
const syncState = await page.evaluate(() => {
  return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
});
```

### Place tests in the right folder:
- Quick health checks → `smoke/`
- Authentication flows → `auth/`
- Sync validation → `sync/`
- Error handling → `error-scenarios/`
- UI operations → `ui/`
- Feature-specific → `features/`
- Issue-specific → `issue-N/`

## 📋 Test Development Guidelines

### Adaptive Testing
- Use multiple selector strategies for flexibility
- Document what exists vs what's missing
- Pass tests that successfully document current state
- Avoid brittle single-point-of-failure selectors

### Selector Priority
1. `[data-testid="element"]` - Preferred
2. `button:has-text("Action")` - Semantic
3. `[aria-label="description"]` - Accessible
4. `.class-name` - CSS classes
5. Generic elements - Last resort

### Test Isolation
- Each worktree provides natural isolation
- Persistent browser profiles maintain auth state
- Tests should be idempotent when possible
- Clean up test data when necessary
