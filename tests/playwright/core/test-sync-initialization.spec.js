// Test sync initialization with correct helpers
import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, getCurrentLSN, getSyncState } from './sync-test-helpers.js';

test.describe('Sync Initialization Test', () => {
  test('verify sync initializes properly with authentication', async ({ page }) => {
    await page.goto('/');
    
    console.log('\n=== SYNC INITIALIZATION TEST ===\n');
    
    // Wait for sync to initialize
    console.log('⏳ Waiting for sync initialization...');
    await waitForSyncInitialized(page, 20000);
    console.log('✅ Sync initialized!');
    
    // Get sync state
    const syncState = await getSyncState(page);
    console.log('📡 Sync state:', syncState);
    
    // Get current LSN
    const currentLSN = await getCurrentLSN(page);
    console.log('📍 Current LSN:', currentLSN);
    
    // Verify sync is initialized
    expect(syncState.clientId).toBeDefined();
    expect(syncState.currentLSN).toBeDefined();
    expect(currentLSN).not.toBe('');
    
    console.log('✅ All sync initialization checks passed!');
  });
});