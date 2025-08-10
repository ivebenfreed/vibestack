# Smoke Tests

## 🔥 **Quick Essential Tests - Run After Setup**

Fast tests that verify the application is basically working. Should complete in under 30 seconds.

## Test Order

### Prerequisites
✅ **Run setup tests first**: `tests/playwright/setup/01-initial-auth.spec.js`

### Tests (run in any order)

#### **`01-app-loads.spec.js`**
**Purpose**: Verify the application loads and renders  
**Checks**:
- Page loads without errors
- Login page or app renders
- Screenshot captured
- Basic page title

#### **`02-auth-state.spec.js`**  
**Purpose**: Verify authentication is working
**Checks**:
- Persistent auth from setup
- Can access authenticated routes
- User session is valid

#### **`03-api-health.spec.js`** (to be added)
**Purpose**: Verify API is responding
**Checks**:
- Health endpoint responds
- Database connection works
- Basic API functionality

## Running Smoke Tests

### Run all smoke tests:
```bash
npx playwright test tests/playwright/smoke
```

### Run specific test:
```bash
npx playwright test tests/playwright/smoke/01-app-loads.spec.js
```

### Run with UI visible:
```bash
npx playwright test tests/playwright/smoke --headed
```

## Success Criteria

- ✅ All tests pass in < 30 seconds
- ✅ No console errors
- ✅ Screenshots captured
- ✅ Auth state persists

## When to Run

- **Always**: Before pushing code
- **CI/CD**: On every commit
- **After setup**: To verify environment
- **Debug**: When app won't load