// Basic sync test to verify the sync test helpers are working
import { test, expect } from '../fixtures/persistent-context.js';
import { 
  getSyncState, 
  getCurrentLSN,
  waitForSyncInitialized
} from '../core/sync-test-helpers.js';

test.describe('Basic Sync Test', () => {
  test('verify sync helpers work', async ({ page }) => {
    console.log('Starting basic sync test...');
    
    // Navigate only if not already on the app
    const currentUrl = page.url();
    if (!currentUrl.includes('localhost:')) {
      await page.goto('/');
    }
    
    // Wait for sync to be initialized
    console.log('Waiting for sync initialization...');
    await waitForSyncInitialized(page, 15000);
    console.log('Sync initialized!');
    
    // Get sync state
    const syncState = await getSyncState(page);
    console.log('Sync state:', syncState);
    
    // Get current LSN
    const currentLSN = await getCurrentLSN(page);
    console.log('Current LSN:', currentLSN);
    
    // Basic assertions
    expect(syncState).toBeDefined();
    expect(currentLSN).toBeDefined();
    expect(currentLSN).not.toBe('0/0');
    
    console.log('✅ Basic sync test passed!');
  });
});