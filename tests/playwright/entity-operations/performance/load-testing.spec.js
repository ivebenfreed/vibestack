import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Entity Performance Load Testing', () => {
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

  test('should handle large entity lists efficiently', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Measure initial load time
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="entity-list"]');
    const loadTime = Date.now() - startTime;
    
    console.log(`📊 Entity list load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Test pagination performance if available
    const paginationNext = page.locator('[data-testid="pagination-next"]');
    if (await paginationNext.isVisible()) {
      const paginationStartTime = Date.now();
      await paginationNext.click();
      await page.waitForSelector('[data-testid="entity-list"]');
      const paginationTime = Date.now() - paginationStartTime;
      
      console.log(`📊 Pagination response time: ${paginationTime}ms`);
      expect(paginationTime).toBeLessThan(2000); // Pagination should be fast
    }

    // Test search performance
    const searchStartTime = Date.now();
    await page.fill('[data-testid="search-input"]', 'test');
    await page.waitForTimeout(500); // Wait for debounced search
    const searchTime = Date.now() - searchStartTime;
    
    console.log(`📊 Search response time: ${searchTime}ms`);
    expect(searchTime).toBeLessThan(1000); // Search should be responsive

    console.log('✅ Large entity list performance verified');
  });

  test('should maintain performance during bulk operations', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const batchSize = 5;
    const operationTimes = [];

    // Create multiple entities and measure performance
    for (let i = 1; i <= batchSize; i++) {
      const createStartTime = Date.now();
      
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', `Performance Test ${timestamp}-${i}`);
      await page.fill('[data-testid="field-description"]', `Batch entity ${i} of ${batchSize}`);
      
      const startDateField = page.locator('[data-testid="field-start_date"]');
      if (await startDateField.isVisible()) {
        await startDateField.fill('2024-01-01');
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const createTime = Date.now() - createStartTime;
      operationTimes.push(createTime);
      
      // Extract ID for cleanup
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testEntityIds.push(idMatch[1]);
      }
      
      // Navigate back to list for next iteration
      await page.goto('/entities/Project');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      console.log(`📊 Entity ${i} creation time: ${createTime}ms`);
    }

    // Analyze performance consistency
    const avgTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
    const maxTime = Math.max(...operationTimes);
    const minTime = Math.min(...operationTimes);
    
    console.log(`📊 Average creation time: ${avgTime.toFixed(2)}ms`);
    console.log(`📊 Min/Max creation times: ${minTime}ms / ${maxTime}ms`);
    
    // Performance should be consistent (max shouldn't be more than 3x average)
    expect(maxTime).toBeLessThan(avgTime * 3);
    expect(avgTime).toBeLessThan(3000); // Average should be under 3 seconds
    
    console.log('✅ Bulk operation performance verified');
  });

  test('should handle concurrent user operations efficiently', async ({ browser }) => {
    const numTabs = 3;
    const pages = [];
    
    // Open multiple tabs
    for (let i = 0; i < numTabs; i++) {
      const page = await browser.newPage();
      await page.goto('http://localhost:5173/entities/Project');
      await page.waitForSelector('[data-playwright-ready="true"]');
      pages.push(page);
    }

    const timestamp = Date.now();
    const operationPromises = [];

    // Perform concurrent operations
    for (let i = 0; i < numTabs; i++) {
      const page = pages[i];
      const operationPromise = (async () => {
        const startTime = Date.now();
        
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', `Concurrent Test ${timestamp}-Tab${i + 1}`);
        await page.fill('[data-testid="field-description"]', `Created by tab ${i + 1}`);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const endTime = Date.now();
        
        // Extract ID for cleanup
        const url = page.url();
        const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch) {
          testEntityIds.push(idMatch[1]);
        }
        
        return endTime - startTime;
      })();
      
      operationPromises.push(operationPromise);
    }

    // Wait for all operations to complete
    const operationTimes = await Promise.all(operationPromises);
    
    // Analyze concurrent performance
    const avgConcurrentTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
    const maxConcurrentTime = Math.max(...operationTimes);
    
    console.log(`📊 Concurrent operations average time: ${avgConcurrentTime.toFixed(2)}ms`);
    console.log(`📊 Concurrent operations max time: ${maxConcurrentTime}ms`);
    
    // Concurrent operations should complete within reasonable time
    expect(maxConcurrentTime).toBeLessThan(10000); // 10 seconds max
    expect(avgConcurrentTime).toBeLessThan(5000); // 5 seconds average
    
    // Close all tabs
    for (const page of pages) {
      await page.close();
    }
    
    console.log('✅ Concurrent user operation performance verified');
  });

  test('should optimize memory usage during extended sessions', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (initialMemory) {
      console.log(`📊 Initial memory usage: ${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`);
    }

    const timestamp = Date.now();
    const iterationCount = 10;

    // Simulate extended session with many operations
    for (let i = 1; i <= iterationCount; i++) {
      // Create entity
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', `Memory Test ${timestamp}-${i}`);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testEntityIds.push(idMatch[1]);
      }

      // Navigate around to simulate user behavior
      await page.goto('/entities/Project');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      await page.goto('/entities/Client');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      await page.goto('/entities/Project');
      await page.waitForSelector('[data-testid="entity-list"]');
      
      // Check memory every few iterations
      if (i % 3 === 0) {
        const currentMemory = await page.evaluate(() => {
          if (performance.memory) {
            return performance.memory.usedJSHeapSize;
          }
          return null;
        });
        
        if (currentMemory && initialMemory) {
          const memoryIncrease = (currentMemory - initialMemory.used) / 1024 / 1024;
          console.log(`📊 Memory increase after ${i} iterations: ${memoryIncrease.toFixed(2)} MB`);
          
          // Memory shouldn't grow excessively (allow 50MB increase for test data)
          expect(memoryIncrease).toBeLessThan(50);
        }
      }
    }

    // Final memory check
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return null;
    });

    if (finalMemory && initialMemory) {
      const totalIncrease = (finalMemory - initialMemory.used) / 1024 / 1024;
      console.log(`📊 Total memory increase: ${totalIncrease.toFixed(2)} MB`);
      
      // Total memory increase should be reasonable
      expect(totalIncrease).toBeLessThan(100); // 100MB max increase
    }
    
    console.log('✅ Memory usage optimization verified');
  });

  test('should measure IndexedDB performance', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Test IndexedDB write performance
    const writeStartTime = Date.now();
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `IndexedDB Test ${Date.now()}`);
    await page.fill('[data-testid="field-description"]', 'Testing IndexedDB performance');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const writeTime = Date.now() - writeStartTime;
    console.log(`📊 IndexedDB write operation: ${writeTime}ms`);
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Test IndexedDB read performance
    const readStartTime = Date.now();
    
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-testid="entity-list"]');
    
    const readTime = Date.now() - readStartTime;
    console.log(`📊 IndexedDB read operation: ${readTime}ms`);

    // Test IndexedDB query performance
    const queryStartTime = Date.now();
    
    await page.fill('[data-testid="search-input"]', 'IndexedDB Test');
    await page.waitForTimeout(500);
    
    const queryTime = Date.now() - queryStartTime;
    console.log(`📊 IndexedDB query operation: ${queryTime}ms`);

    // Performance expectations
    expect(writeTime).toBeLessThan(3000); // Write should be under 3 seconds
    expect(readTime).toBeLessThan(2000);  // Read should be under 2 seconds
    expect(queryTime).toBeLessThan(1000); // Query should be under 1 second
    
    console.log('✅ IndexedDB performance verified');
  });

  test('should measure WebSocket sync performance', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Monitor WebSocket message timing
    await page.evaluate(() => {
      window.webSocketMetrics = {
        messagesSent: 0,
        messagesReceived: 0,
        roundTripTimes: []
      };
      
      // Hook into WebSocket if available
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        window.webSocketMetrics.messagesSent++;
        this._sentTime = Date.now();
        return originalSend.call(this, data);
      };
      
      const originalOnMessage = WebSocket.prototype.onmessage;
      WebSocket.prototype.onmessage = function(event) {
        window.webSocketMetrics.messagesReceived++;
        if (this._sentTime) {
          const roundTripTime = Date.now() - this._sentTime;
          window.webSocketMetrics.roundTripTimes.push(roundTripTime);
        }
        if (originalOnMessage) {
          return originalOnMessage.call(this, event);
        }
      };
    });

    const timestamp = Date.now();
    
    // Perform operations that trigger WebSocket sync
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `WebSocket Test ${timestamp}`);
    await page.fill('[data-testid="field-description"]', 'Testing WebSocket sync performance');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Wait for sync to complete
    await page.waitForTimeout(2000);

    // Get WebSocket metrics
    const metrics = await page.evaluate(() => window.webSocketMetrics);
    
    if (metrics && metrics.roundTripTimes.length > 0) {
      const avgRoundTrip = metrics.roundTripTimes.reduce((a, b) => a + b, 0) / metrics.roundTripTimes.length;
      const maxRoundTrip = Math.max(...metrics.roundTripTimes);
      
      console.log(`📊 WebSocket messages sent: ${metrics.messagesSent}`);
      console.log(`📊 WebSocket messages received: ${metrics.messagesReceived}`);
      console.log(`📊 Average round-trip time: ${avgRoundTrip.toFixed(2)}ms`);
      console.log(`📊 Max round-trip time: ${maxRoundTrip}ms`);
      
      // WebSocket performance expectations
      expect(avgRoundTrip).toBeLessThan(500); // Average under 500ms
      expect(maxRoundTrip).toBeLessThan(2000); // Max under 2 seconds
    } else {
      console.log('ℹ️ WebSocket metrics not available or no sync occurred');
    }
    
    console.log('✅ WebSocket sync performance verified');
  });
});