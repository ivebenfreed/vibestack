# VibeStack UI Testing Structure

## Directory Organization

```
tests/
├── playwright/           # E2E UI tests with Playwright
│   ├── auth/            # Authentication flow tests
│   ├── dashboard/       # Dashboard and widget tests
│   ├── entities/        # Entity builder and management tests
│   ├── organization/    # Organization management tests
│   ├── settings/        # Settings and profile tests
│   ├── fixtures/        # Shared test fixtures
│   ├── helpers/         # Test utility functions
│   └── screenshots/     # Visual regression screenshots
├── unit/                # Component unit tests
│   ├── components/      # Individual component tests
│   ├── hooks/          # Custom hook tests
│   └── utils/          # Utility function tests
├── integration/         # Integration tests
│   ├── api/            # API integration tests
│   ├── state/          # State management tests
│   └── routing/        # Routing tests
├── e2e/                # Full end-to-end scenarios
│   ├── workflows/      # Complete user workflows
│   └── scenarios/      # Business scenario tests
└── config/             # Test configuration files
    ├── playwright.config.ts
    ├── vitest.config.ts
    └── test-data/      # Test data fixtures
```

## Test Categories

### 1. Playwright Tests (UI/E2E)
- Visual regression testing
- User interaction flows
- Cross-browser compatibility
- Responsive design verification
- Accessibility testing

### 2. Unit Tests (Vitest)
- Component isolation tests
- Pure function tests
- Hook behavior tests
- Utility function tests

### 3. Integration Tests
- API endpoint integration
- State management flows
- Router integration
- Database operations

### 4. E2E Scenarios
- Complete user journeys
- Multi-step workflows
- Real-world usage patterns
- Performance benchmarks

## Testing Principles

### Test Identification
Every testable element must have:
```typescript
data-testid="unique-identifier"
data-test-state="ready|loading|error"
aria-label="descriptive-label"
```

### Screenshot Strategy
- Capture at each major state change
- Multiple viewport sizes
- Light and dark themes
- Error and success states
- Loading and empty states

### Performance Metrics
Track and assert:
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- Cumulative Layout Shift (CLS) < 0.1
- First Input Delay (FID) < 100ms
- Time to Interactive (TTI) < 3.5s

## Test Execution Flow

### Local Development
```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test:playwright
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run with UI
pnpm test:playwright:ui

# Run specific file
pnpm test:playwright auth/signin.spec.ts

# Update snapshots
pnpm test:playwright --update-snapshots
```

### CI Pipeline
```yaml
name: UI Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:playwright --browser=${{ matrix.browser }}
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results-${{ matrix.browser }}
          path: test-results/
```

## Coverage Requirements

### Minimum Coverage Targets
- Overall: 80%
- Critical paths: 95%
- New code: 90%
- UI components: 85%

### Critical Paths (95% coverage required)
1. Authentication flow
2. Entity creation
3. Data persistence
4. Organization management
5. Billing operations

## Visual Regression Testing

### Baseline Screenshots
Store in `tests/playwright/screenshots/baseline/`

### Comparison Strategy
- Pixel difference threshold: 0.1%
- Animation handling: Wait for idle
- Dynamic content: Mock or freeze
- Timestamps: Use fixed dates

## Accessibility Testing

### WCAG 2.1 AA Compliance
- Color contrast ratios
- Keyboard navigation
- Screen reader compatibility
- Focus management
- ARIA attributes

### Automated Checks
```typescript
test('accessibility', async ({ page }) => {
  const violations = await checkA11y(page);
  expect(violations).toHaveLength(0);
});
```

## Performance Testing

### Lighthouse Integration
```typescript
test('performance metrics', async ({ page }) => {
  const metrics = await runLighthouse(page.url());
  expect(metrics.performance).toBeGreaterThan(90);
  expect(metrics.accessibility).toBeGreaterThan(95);
  expect(metrics.bestPractices).toBeGreaterThan(90);
  expect(metrics.seo).toBeGreaterThan(90);
});
```

## Test Data Management

### Fixtures
```typescript
// test-data/users.ts
export const testUsers = {
  admin: {
    email: 'admin@test.vibestack.com',
    password: 'Test123!@#',
    role: 'owner'
  },
  member: {
    email: 'member@test.vibestack.com',
    password: 'Test123!@#',
    role: 'member'
  }
};
```

### Database Seeding
```typescript
beforeEach(async () => {
  await seedTestDatabase();
});

afterEach(async () => {
  await cleanupTestData();
});
```

## Debugging Tools

### Playwright Inspector
```bash
pnpm test:playwright --debug
```

### Trace Viewer
```bash
npx playwright show-trace trace.zip
```

### VSCode Integration
- Install Playwright Test for VS Code
- Run tests from editor
- Debug with breakpoints
- View test results inline

## Reporting

### Test Reports
- HTML report: `test-results/index.html`
- JSON report: `test-results/results.json`
- JUnit XML: `test-results/junit.xml`
- Coverage: `coverage/index.html`

### Metrics Dashboard
Track over time:
- Test pass rate
- Execution time
- Flaky tests
- Coverage trends
- Performance metrics

## Best Practices

### DO
✅ Use data-testid for element selection
✅ Wait for specific conditions, not arbitrary delays
✅ Test user behavior, not implementation
✅ Keep tests independent and idempotent
✅ Use meaningful test descriptions
✅ Clean up after tests
✅ Mock external dependencies
✅ Test error scenarios

### DON'T
❌ Use CSS selectors for test selection
❌ Use arbitrary sleep/wait times
❌ Test implementation details
❌ Create interdependent tests
❌ Leave test data in database
❌ Test third-party libraries
❌ Ignore flaky tests

## Maintenance

### Weekly Tasks
- Review flaky tests
- Update baseline screenshots
- Check coverage trends
- Update test data

### Monthly Tasks
- Performance benchmark review
- Accessibility audit
- Cross-browser testing
- Test suite optimization

### Quarterly Tasks
- Full visual regression update
- Test strategy review
- Tool updates
- Documentation review