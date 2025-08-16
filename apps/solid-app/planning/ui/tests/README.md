# VibeStack UI Tests

Comprehensive testing suite for the VibeStack UI system using Playwright, Vitest, and visual regression testing.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm install:browsers

# Run all tests
pnpm test

# Run with UI
pnpm test:playwright:ui
```

## 📁 Structure

```
tests/
├── playwright/          # E2E UI tests
│   ├── auth/           # Authentication tests
│   ├── dashboard/      # Dashboard tests
│   ├── entities/       # Entity builder tests
│   ├── organization/   # Organization tests
│   ├── settings/       # Settings tests
│   ├── fixtures/       # Test fixtures
│   ├── helpers/        # Test utilities
│   └── screenshots/    # Visual snapshots
├── unit/               # Component unit tests
├── integration/        # Integration tests
├── e2e/               # Full workflows
└── config/            # Test configuration
```

## 🧪 Test Types

### Playwright E2E Tests
Full user interaction tests with real browser automation.

```bash
# Run all Playwright tests
pnpm test:playwright

# Run specific module
pnpm test:playwright:auth
pnpm test:playwright:dashboard
pnpm test:playwright:entities

# Debug mode
pnpm test:playwright:debug

# Headed mode (see browser)
pnpm test:playwright:headed
```

### Unit Tests
Component and utility function tests using Vitest.

```bash
# Run unit tests
pnpm test:unit

# Watch mode
pnpm test:unit:watch

# Coverage report
pnpm test:unit:coverage
```

### Integration Tests
API and state management integration tests.

```bash
pnpm test:integration
```

### E2E Scenarios
Complete user journey tests.

```bash
pnpm test:e2e
```

## 📸 Screenshots

### Update Screenshots
```bash
pnpm screenshots:update
```

### Verify Screenshots
```bash
pnpm screenshots:verify
```

## 🎯 Test Tags

Use tags to run specific test categories:

- `@smoke` - Quick smoke tests
- `@visual` - Visual regression tests
- `@a11y` - Accessibility tests
- `@performance` - Performance tests
- `@critical` - Critical path tests

```bash
# Run only smoke tests
pnpm test:smoke

# Run only accessibility tests
pnpm test:a11y
```

## 🔐 Authentication

Tests use persistent authentication state. First-time setup:

```bash
# Set up test user credentials
export TEST_USER_EMAIL="test@vibestack.com"
export TEST_USER_PASSWORD="Test123!@#"

# Run auth setup
SETUP_AUTH=true pnpm test:playwright auth/signin.spec.ts
```

## 📊 Reports

### View HTML Report
```bash
pnpm show-report
```

### View Trace
```bash
pnpm show-trace trace.zip
```

## 🛠️ Debugging

### Playwright Inspector
```bash
pnpm test:playwright:debug
```

### Generate Test Code
```bash
pnpm codegen
```

### VSCode Integration
1. Install "Playwright Test for VS Code" extension
2. Run tests directly from editor
3. Set breakpoints in tests
4. View results inline

## ✅ Writing Tests

### Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot } from '../helpers/test-utils';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature');
    await waitForAppReady(page);
  });
  
  test('should do something', async ({ page }) => {
    // Arrange
    await page.getByTestId('element').click();
    
    // Act
    await page.fill('[data-testid="input"]', 'value');
    
    // Assert
    await expect(page.getByTestId('result')).toHaveText('expected');
    
    // Screenshot
    await takeScreenshot(page, 'feature/test-name');
  });
});
```

### Best Practices

#### DO ✅
- Use `data-testid` for element selection
- Wait for specific conditions
- Take screenshots at key points
- Test user behavior, not implementation
- Keep tests independent
- Clean up after tests

#### DON'T ❌
- Use CSS selectors for tests
- Use arbitrary delays
- Test third-party code
- Create dependent tests
- Ignore flaky tests

## 🔄 CI/CD

Tests run automatically on:
- Push to main/develop
- Pull requests
- Nightly builds

### Environment Variables
```bash
CI=true                    # Running in CI
CLEANUP_TEMP_FILES=true    # Clean temporary files
CLEANUP_TEST_DATA=true     # Clean test data
UPLOAD_RESULTS=true        # Upload to dashboard
```

## 📈 Performance Benchmarks

Target metrics:
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

## ♿ Accessibility

All tests include accessibility checks:
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast verification

## 🤝 Contributing

1. Write tests for new features
2. Ensure all tests pass
3. Update screenshots if UI changes
4. Add appropriate test tags
5. Document complex test scenarios

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [Testing Best Practices](./TEST_STRUCTURE.md)
- [Component Testing Guide](./unit/README.md)

## 🆘 Troubleshooting

### Tests Failing Locally
```bash
# Clear test cache
rm -rf test-results/

# Update browsers
pnpm install:browsers

# Reset auth state
rm -rf tests/playwright/fixtures/auth*.json
```

### Flaky Tests
1. Check for race conditions
2. Add proper wait conditions
3. Increase timeout if needed
4. Use retry mechanism

### Screenshot Mismatches
1. Update baseline: `pnpm screenshots:update`
2. Check for dynamic content
3. Verify viewport size
4. Check animation states