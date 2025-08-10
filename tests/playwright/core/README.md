# Core Tests

## 🎯 **Core System Functionality Tests**

Tests for fundamental system features: database, sync, and UI primitives.

## Prerequisites

### ⚠️ **RUN THESE FIRST:**
1. **Setup**: `tests/playwright/setup/01-initial-auth.spec.js`
2. **Smoke**: `tests/playwright/smoke/` (verify app works)

## Test Categories

### 📊 **database/** - Database Operations
Tests for CRUD operations, data integrity, and domain services.

**Future tests**:
- `01-crud-operations.spec.js` - Basic CRUD through domain services
- `02-data-integrity.spec.js` - Constraints and validation
- `03-migrations.spec.js` - Schema migrations work

### 🔄 **sync/** - Synchronization System  
Tests for real-time sync, conflict resolution, and offline support.

**Future tests**:
- `01-basic-sync.spec.js` - Single change syncs correctly
- `02-multi-client.spec.js` - Multiple clients stay in sync
- `03-catchup-sync.spec.js` - Reconnection and catchup
- `04-conflict-resolution.spec.js` - Handles conflicts properly

### 🖼️ **ui/** - UI Components and Navigation
Tests for routing, forms, and component interactions.

**Future tests**:
- `01-navigation.spec.js` - Routes work correctly
- `02-forms.spec.js` - Form validation and submission
- `03-components.spec.js` - Component interactions

## Running Core Tests

### Run all core tests:
```bash
npx playwright test tests/playwright/core
```

### Run specific category:
```bash
npx playwright test tests/playwright/core/database
npx playwright test tests/playwright/core/sync
npx playwright test tests/playwright/core/ui
```

### Run with debugging:
```bash
npx playwright test tests/playwright/core --debug
```

## Writing New Core Tests

1. **Choose the right folder**: database/, sync/, or ui/
2. **Use number prefixes**: `01-`, `02-`, etc. for run order
3. **Import helpers**: 
   ```javascript
   import { test, expect } from '../../helpers/fixtures/persistent-context.js';
   import { createEntity, updateEntity } from '../../helpers/database.js';
   ```
4. **Follow naming**: `01-feature-name.spec.js`

## Test Requirements

- ✅ Must test core functionality only
- ✅ Should be independent of feature tests
- ✅ Use helper functions from `helpers/`
- ✅ Clean up test data after completion