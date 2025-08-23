import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Entity Response Time Performance', () => {
  let testEntityIds = [];

  test.afterEach(async ({ page }) => {
    // Cleanup created entities
    for (const entityId of testEntityIds) {
      try {
        await page.goto(`/entities/Project/${entityId}`);
        await page.waitForSelector('[data-testid="entity-actions"]');
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log(`Cleanup failed for entity ${entityId}:`, error.message);
      }
    }
    testEntityIds = [];
  });

  test('should measure page load response times', async ({ page }) => {
    const responseTimesPerPage = {};

    // Test main entity pages
    const entityTypes = ['Project', 'Client', 'Timesheet', 'Document', 'Invoice'];
    
    for (const entityType of entityTypes) {
      const startTime = Date.now();
      
      await page.goto(`/entities/${entityType}`);
      await page.waitForSelector('[data-playwright-ready="true"]');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      const loadTime = Date.now() - startTime;
      responseTimesPerPage[entityType] = loadTime;
      
      console.log(`📊 ${entityType} page load time: ${loadTime}ms`);
      
      // Each page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    }

    // Calculate average load time
    const avgLoadTime = Object.values(responseTimesPerPage).reduce((a, b) => a + b, 0) / entityTypes.length;
    console.log(`📊 Average page load time: ${avgLoadTime.toFixed(2)}ms`);
    
    // Average should be under 2 seconds
    expect(avgLoadTime).toBeLessThan(2000);
    
    console.log('✅ Page load response times verified');
  });

  test('should measure CRUD operation response times', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Response Time Test ${timestamp}`;
    const operations = {};

    // CREATE operation timing
    const createStartTime = Date.now();
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.fill('[data-testid="field-description"]', 'Testing response times');
    
    const startDateField = page.locator('[data-testid="field-start_date"]');
    if (await startDateField.isVisible()) {
      await startDateField.fill('2024-01-01');
    }
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    operations.create = Date.now() - createStartTime;
    console.log(`📊 CREATE operation: ${operations.create}ms`);
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // READ operation timing (navigation to details)
    const readStartTime = Date.now();
    
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-testid="entity-list"]');
    await page.fill('[data-testid="search-input"]', testName);
    await page.waitForTimeout(500);
    
    const entityRow = page.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await entityRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    operations.read = Date.now() - readStartTime;
    console.log(`📊 READ operation: ${operations.read}ms`);

    // UPDATE operation timing
    const updateStartTime = Date.now();
    
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-description"]', 'Updated for response time test');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    operations.update = Date.now() - updateStartTime;
    console.log(`📊 UPDATE operation: ${operations.update}ms`);

    // DELETE operation timing
    const deleteStartTime = Date.now();
    
    await page.click('[data-testid="delete-entity"]');
    await page.waitForSelector('[data-testid="delete-confirmation"]');
    await page.click('[data-testid="confirm-delete"]');
    await page.waitForSelector('[data-testid="entity-deleted"]');
    
    operations.delete = Date.now() - deleteStartTime;
    console.log(`📊 DELETE operation: ${operations.delete}ms`);
    
    // Remove from cleanup list since we deleted it
    testEntityIds.pop();

    // Verify all operations meet performance requirements
    expect(operations.create).toBeLessThan(5000); // 5 seconds max for create
    expect(operations.read).toBeLessThan(2000);   // 2 seconds max for read
    expect(operations.update).toBeLessThan(3000); // 3 seconds max for update
    expect(operations.delete).toBeLessThan(2000); // 2 seconds max for delete

    const avgCRUDTime = Object.values(operations).reduce((a, b) => a + b, 0) / 4;
    console.log(`📊 Average CRUD operation time: ${avgCRUDTime.toFixed(2)}ms`);
    
    console.log('✅ CRUD operation response times verified');
  });

  test('should measure search and filter response times', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Test search response time
    const searchStartTime = Date.now();
    
    await page.fill('[data-testid="search-input"]', 'test');
    await page.waitForTimeout(500); // Wait for debounced search
    
    const searchTime = Date.now() - searchStartTime;
    console.log(`📊 Search response time: ${searchTime}ms`);
    
    // Search should be very fast
    expect(searchTime).toBeLessThan(1000);

    // Clear search
    await page.fill('[data-testid="search-input"]', '');
    await page.waitForTimeout(500);

    // Test filter response time if filters are available
    const statusFilter = page.locator('[data-testid="filter-status"]');
    if (await statusFilter.isVisible()) {
      const filterStartTime = Date.now();
      
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
      
      const filterTime = Date.now() - filterStartTime;
      console.log(`📊 Filter response time: ${filterTime}ms`);
      
      expect(filterTime).toBeLessThan(1000);
    }

    // Test date range filter if available
    const dateRangeFilter = page.locator('[data-testid="filter-date-range"]');
    if (await dateRangeFilter.isVisible()) {
      const dateFilterStartTime = Date.now();
      
      await dateRangeFilter.fill('2024-01-01');
      await page.waitForTimeout(500);
      
      const dateFilterTime = Date.now() - dateFilterStartTime;
      console.log(`📊 Date filter response time: ${dateFilterTime}ms`);
      
      expect(dateFilterTime).toBeLessThan(1000);
    }

    // Test sorting response time
    const sortHeader = page.locator('[data-testid="sort-name"]');
    if (await sortHeader.isVisible()) {
      const sortStartTime = Date.now();
      
      await sortHeader.click();
      await page.waitForTimeout(500);
      
      const sortTime = Date.now() - sortStartTime;
      console.log(`📊 Sort response time: ${sortTime}ms`);
      
      expect(sortTime).toBeLessThan(1000);
    }
    
    console.log('✅ Search and filter response times verified');
  });

  test('should measure form validation response times', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');

    // Test required field validation timing
    const requiredFieldStartTime = Date.now();
    
    await page.click('[data-testid="save-entity"]'); // Save without required fields
    
    const validationError = page.locator('[data-testid="field-name-error"]');
    if (await validationError.isVisible()) {
      const requiredFieldTime = Date.now() - requiredFieldStartTime;
      console.log(`📊 Required field validation: ${requiredFieldTime}ms`);
      
      expect(requiredFieldTime).toBeLessThan(500); // Should be immediate
    }

    // Test format validation timing (email, date, etc.)
    const formatValidationStartTime = Date.now();
    
    const emailField = page.locator('[data-testid="field-email"]');
    if (await emailField.isVisible()) {
      await emailField.fill('invalid-email');
      await emailField.blur();
      
      const emailError = page.locator('[data-testid="field-email-error"]');
      if (await emailError.isVisible()) {
        const formatValidationTime = Date.now() - formatValidationStartTime;
        console.log(`📊 Format validation: ${formatValidationTime}ms`);
        
        expect(formatValidationTime).toBeLessThan(300);
      }
    }

    // Test date field validation timing
    const dateValidationStartTime = Date.now();
    
    const startDateField = page.locator('[data-testid="field-start_date"]');
    const endDateField = page.locator('[data-testid="field-end_date"]');
    
    if (await startDateField.isVisible() && await endDateField.isVisible()) {
      await startDateField.fill('2024-12-31');
      await endDateField.fill('2024-01-01'); // End before start
      await endDateField.blur();
      
      const dateError = page.locator('[data-testid="date-range-error"]');
      if (await dateError.isVisible()) {
        const dateValidationTime = Date.now() - dateValidationStartTime;
        console.log(`📊 Date range validation: ${dateValidationTime}ms`);
        
        expect(dateValidationTime).toBeLessThan(500);
      }
    }

    // Test real-time validation during typing
    const realtimeStartTime = Date.now();
    
    await page.fill('[data-testid="field-name"]', 'a'); // Too short
    await page.waitForTimeout(100); // Brief pause for validation
    
    const lengthError = page.locator('[data-testid="field-name-error"]');
    if (await lengthError.isVisible()) {
      const realtimeTime = Date.now() - realtimeStartTime;
      console.log(`📊 Real-time validation: ${realtimeTime}ms`);
      
      expect(realtimeTime).toBeLessThan(200); // Should be very fast
    }
    
    console.log('✅ Form validation response times verified');
  });

  test('should measure API call response times', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Monitor network requests and their timing
    const apiCalls = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
          responseTime: timing ? timing.responseEnd - timing.requestStart : null
        });
      }
    });

    const timestamp = Date.now();
    
    // Perform operations that trigger API calls
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `API Test ${timestamp}`);
    await page.fill('[data-testid="field-description"]', 'Testing API response times');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Wait for all API calls to complete
    await page.waitForTimeout(2000);

    // Analyze API call performance
    const createCalls = apiCalls.filter(call => 
      call.method === 'POST' && call.url.includes('/projects')
    );
    
    const readCalls = apiCalls.filter(call => 
      call.method === 'GET' && call.url.includes('/projects')
    );

    if (createCalls.length > 0) {
      const avgCreateTime = createCalls.reduce((sum, call) => sum + (call.responseTime || 0), 0) / createCalls.length;
      console.log(`📊 Average CREATE API response time: ${avgCreateTime.toFixed(2)}ms`);
      
      expect(avgCreateTime).toBeLessThan(2000); // 2 seconds max for API calls
    }

    if (readCalls.length > 0) {
      const avgReadTime = readCalls.reduce((sum, call) => sum + (call.responseTime || 0), 0) / readCalls.length;
      console.log(`📊 Average READ API response time: ${avgReadTime.toFixed(2)}ms`);
      
      expect(avgReadTime).toBeLessThan(1000); // 1 second max for read API calls
    }

    // Check for any failed API calls
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    if (failedCalls.length > 0) {
      console.log(`⚠️ Found ${failedCalls.length} failed API calls:`, failedCalls);
    }
    
    expect(failedCalls.length).toBe(0); // No API calls should fail
    
    console.log('✅ API call response times verified');
  });

  test('should measure rendering performance for complex forms', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Measure time to render create form
    const formRenderStartTime = Date.now();
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    // Wait for all form fields to be visible
    await page.waitForSelector('[data-testid="field-name"]');
    
    const formRenderTime = Date.now() - formRenderStartTime;
    console.log(`📊 Form render time: ${formRenderTime}ms`);
    
    expect(formRenderTime).toBeLessThan(1000); // Form should render within 1 second

    // Test dynamic field updates (if any conditional fields exist)
    const conditionalTrigger = page.locator('[data-testid="field-project_type"]');
    if (await conditionalTrigger.isVisible()) {
      const dynamicUpdateStartTime = Date.now();
      
      await conditionalTrigger.selectOption({ index: 1 });
      
      // Wait for any conditional fields to appear/disappear
      await page.waitForTimeout(300);
      
      const dynamicUpdateTime = Date.now() - dynamicUpdateStartTime;
      console.log(`📊 Dynamic field update time: ${dynamicUpdateTime}ms`);
      
      expect(dynamicUpdateTime).toBeLessThan(500); // Dynamic updates should be fast
    }

    // Test large dropdown population time
    const clientDropdown = page.locator('[data-testid="field-client_id"]');
    if (await clientDropdown.isVisible()) {
      const dropdownStartTime = Date.now();
      
      await clientDropdown.click();
      
      // Wait for options to load
      await page.waitForTimeout(500);
      
      const dropdownTime = Date.now() - dropdownStartTime;
      console.log(`📊 Dropdown population time: ${dropdownTime}ms`);
      
      expect(dropdownTime).toBeLessThan(1000); // Dropdown should populate quickly
    }
    
    console.log('✅ Form rendering performance verified');
  });

  test('should measure navigation performance between entity types', async ({ page }) => {
    const entityTypes = ['Project', 'Client', 'Timesheet', 'Document', 'Invoice'];
    const navigationTimes = [];

    // Start from Projects
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Navigate through different entity types
    for (let i = 1; i < entityTypes.length; i++) {
      const navigationStartTime = Date.now();
      
      await page.goto(`/entities/${entityTypes[i]}`);
      await page.waitForSelector('[data-playwright-ready="true"]');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      const navigationTime = Date.now() - navigationStartTime;
      navigationTimes.push(navigationTime);
      
      console.log(`📊 Navigation to ${entityTypes[i]}: ${navigationTime}ms`);
      
      expect(navigationTime).toBeLessThan(2000); // Each navigation under 2 seconds
    }

    // Calculate average navigation time
    const avgNavigationTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
    console.log(`📊 Average navigation time: ${avgNavigationTime.toFixed(2)}ms`);
    
    expect(avgNavigationTime).toBeLessThan(1500); // Average under 1.5 seconds
    
    console.log('✅ Navigation performance verified');
  });
});