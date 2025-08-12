import { test, expect } from '@playwright/test';

test.describe('UUIDv7 Generation', () => {
  test('UUIDv7 function generates timestamp-ordered UUIDs', async ({ page }) => {
    // Navigate to test page that can access the database
    await page.goto('/');
    
    // Test UUIDv7 generation via database query
    const result = await page.evaluate(async () => {
      try {
        // Call server endpoint to test UUIDv7 generation
        const response = await fetch('/api/test/uuidv7-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    // Verify the result structure
    expect(result).toHaveProperty('uuids');
    expect(result.uuids).toHaveLength(5);
    
    // Verify UUIDs are properly formatted
    for (const uuid of result.uuids) {
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
    
    // Verify timestamp ordering (UUIDs should be in ascending order)
    const timestamps = result.uuids.map(uuid => {
      // Extract timestamp from first 6 bytes of UUIDv7
      const hex = uuid.replace(/-/g, '').substring(0, 12);
      return parseInt(hex, 16);
    });
    
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  test('BaseSystemEntity uses UUIDv7 for primary keys', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-test-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('entityId');
    expect(result.entityId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});