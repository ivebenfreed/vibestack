# Playwright Test Organization

This directory contains end-to-end tests using Playwright.

## Folder Structure

- **`core/`** - Core tests that run for all issues
  - `auth.setup.js` - Authentication setup that runs before tests
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