# Playwright Test Organization

This directory contains end-to-end tests using Playwright.

## Folder Structure

- **`core/`** - Core tests that run for all issues
  - `persistent-login.spec.js` - One-time login setup for persistent browser profile
  - `test-template.spec.js` - Template for creating new tests
  - `db-test-helpers.js` - Database testing utilities
  - `app-loads.spec.js` - Basic smoke test
  - `simple-*.spec.js` - Simple examples of database and domain service access

- **`issue-{number}/`** - Issue-specific tests
  - Tests specific to a particular issue/feature
  - Only run when working in that issue's worktree

## Creating New Tests

1. For issue-specific tests:
   ```bash
   # Create in the appropriate issue folder
   cp core/test-template.spec.js issue-25/my-feature.spec.js
   ```

2. For core functionality tests (rare):
   - Only add to `core/` if the test is truly reusable across all issues
   - Examples: auth setup, basic smoke tests, test helpers

## Authentication Setup

This project uses **persistent browser profiles** for Playwright tests. Each worktree maintains its own browser profile that persists login state across test runs.

### Automatic Setup
The browser profile is **automatically created** when you create a worktree with the `--test-setup` flag:

```bash
./scripts/create-issue-worktree.sh 123 --test-setup
```

This runs the persistent login test and creates the profile during setup.

### Manual Setup (if needed)
If you need to recreate the profile or didn't use `--test-setup`:

```bash
npx playwright test tests/playwright/core/persistent-login.spec.js
```

After setup, all tests will use the saved authentication automatically.

## Running Tests

```bash
# Run all tests (core + current issue)
./scripts/playwright-test.sh

# Run specific test
./scripts/playwright-test.sh tests/playwright/core/app-loads.spec.js

# Run in debug mode
./scripts/playwright-test.sh --debug

# Run headless
./scripts/playwright-test.sh --headed=false
```

## Database Access in Tests

Tests can access the Dexie database directly:

```javascript
const { db, domainServices } = await import('/src/domain/index.js');

// Use domain services
const task = await domainServices.task.createUI({ title: 'Test' });

// Direct database access
const count = await db.tasks.count();
```

See `core/db-test-helpers.js` for utility functions.