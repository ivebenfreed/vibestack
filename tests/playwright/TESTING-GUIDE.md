# Playwright Testing Guide

## Default: Persistent Browser Context

By default, all tests use a **persistent browser profile** that remembers login state between runs:

```javascript
import { test, expect } from '../fixtures/persistent-context.js';

test('my test', async ({ page }) => {
  await page.goto('/'); // Already logged in!
});
```

### Benefits:
- Login once per worktree, stay logged in forever
- Realistic testing with full browser state
- Fast test startup (no auth setup needed)

### First Time Setup:
```bash
# Run the login test once to set up your profile
npx playwright test tests/playwright/core/persistent-login.spec.js

# All subsequent tests will use the saved profile
```

## Isolated Tests (Fresh Context)

For tests that need a clean slate or different users:

### Option 1: Use Default Playwright Test
```javascript
// Use standard @playwright/test for isolated context
import { test, expect } from '@playwright/test';

test('isolated test', async ({ page }) => {
  // This gets a fresh, isolated browser context
  await page.goto('/sign-in');
  // Must handle login manually
});
```

### Option 2: Create Isolated Fixture
```javascript
// tests/playwright/fixtures/isolated-context.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  // Add any custom setup for isolated tests
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.PLAYWRIGHT_TEST = true;
    });
    await use(page);
  },
});
```

## Multiple User Profiles

For testing with different user accounts:

### Option 1: Multiple Persistent Profiles
```javascript
// tests/playwright/fixtures/admin-context.js
import { test as base, chromium } from '@playwright/test';

export const test = base.extend({
  context: async ({ }, use) => {
    const userDataDir = '.playwright/profiles/profile-admin';
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },
});
```

### Option 2: Profile Switcher
```javascript
// tests/playwright/fixtures/multi-user.js
export function createUserFixture(profileName) {
  return base.extend({
    context: async ({ }, use) => {
      const userDataDir = `.playwright/profiles/profile-${profileName}`;
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
      });
      await use(context);
      await context.close();
    },
  });
}

// Usage
const adminTest = createUserFixture('admin');
const userTest = createUserFixture('standard-user');
```

## Running Tests

### Standard (Persistent Profile)
```bash
# Uses persistent profile for current worktree
./scripts/playwright-test.sh

# Specific test
./scripts/playwright-test.sh tests/playwright/core/my-test.spec.js
```

### Headless Mode
```bash
# Edit fixture to set headless: true, or:
npx playwright test --browser chromium --headed=false
```

### Debug Mode
```bash
# Opens Playwright Inspector
./scripts/playwright-test.sh --debug
```

## Directory Structure

```
.playwright/
├── profiles/
│   ├── profile-main/        # Main branch persistent profile
│   ├── profile-10/          # Issue #10 persistent profile
│   ├── profile-admin/       # Admin user profile
│   └── profile-user/        # Standard user profile
```

## Best Practices

1. **Default to Persistent Context** - It's faster and more realistic
2. **Use Isolated Tests Only When Needed**:
   - Testing login flow itself
   - Testing with multiple users simultaneously
   - Security/permission testing
3. **Name Profiles Clearly** - Use descriptive names for multi-user scenarios
4. **Clean Profiles Periodically** - Delete old worktree profiles after PR merge

## Troubleshooting

### Reset Profile
```bash
# Remove profile to start fresh
rm -rf .playwright/profiles/profile-main
```

### View Profile Contents
```bash
# Check what's stored in the profile
ls -la .playwright/profiles/profile-main/
```

### Profile Corruption
If a profile gets corrupted, just delete it and run the login test again.