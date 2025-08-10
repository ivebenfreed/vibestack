# Test Helpers

## 🔧 **Shared Utilities and Fixtures**

Reusable code for all tests. These are NOT tests themselves.

## Helper Files

### **fixtures/**
Browser context and test fixtures.

#### `persistent-context.js`
Custom Playwright fixture for persistent browser sessions.
```javascript
import { test, expect } from '../helpers/fixtures/persistent-context.js';
```

### **Database Helpers**

#### `database.js` (renamed from db-test-helpers.js)
Database operations and test data creation.
```javascript
import { createEntity, updateEntity, deleteEntity } from '../helpers/database.js';

// Usage
const task = await createEntity(page, 'task', {
  title: 'Test Task',
  description: 'Test Description'
});
```

### **Sync Helpers**

#### `sync.js` (renamed from sync-test-helpers.js)
Sync state management and verification.
```javascript
import { waitForSync, verifySyncState } from '../helpers/sync.js';

// Usage
await waitForSync(page);
const state = await verifySyncState(page);
```

### **Multi-Client Helpers**

#### `multi-client.js` (renamed from multi-client-helpers.js)
Testing with multiple browser contexts.
```javascript
import { createSecondClient, syncBetweenClients } from '../helpers/multi-client.js';

// Usage
const client2 = await createSecondClient();
await syncBetweenClients(client1, client2);
```

## Adding New Helpers

### Naming Convention
- **No `.spec.js` suffix** - These aren't tests
- **Descriptive names**: `auth.js`, `navigation.js`, `api.js`
- **Group by purpose**: Database, UI, sync, etc.

### Structure
```javascript
// helpers/feature.js

/**
 * Clear JSDoc comment explaining purpose
 * @param {Page} page - Playwright page
 * @param {Object} options - Options
 * @returns {Promise<Result>} What it returns
 */
export async function helperFunction(page, options) {
  // Implementation
}
```

## Best Practices

- ✅ **DRY**: Don't repeat code across tests
- ✅ **Clear exports**: Named exports with clear purposes
- ✅ **Error handling**: Helpers should handle errors gracefully
- ✅ **Documentation**: JSDoc comments for all exports
- ✅ **Page-centric**: Most helpers should accept `page` as first param

## Common Patterns

### Wait for conditions
```javascript
export async function waitForElement(page, selector, timeout = 5000) {
  return page.waitForSelector(selector, { timeout });
}
```

### Execute in browser context
```javascript
export async function getLocalStorage(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}
```

### API calls
```javascript
export async function apiRequest(page, endpoint, options) {
  return page.request.fetch(endpoint, options);
}
```