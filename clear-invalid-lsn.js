// Quick script to clear invalid LSN from localStorage
// Run this in the browser console if you have an invalid LSN stored

const SYNC_STATE_KEY = 'sync-machine-state';

console.log('Checking current sync state...');
const stored = localStorage.getItem(SYNC_STATE_KEY);

if (stored) {
  try {
    const parsedState = JSON.parse(stored);
    console.log('Current state:', parsedState);
    
    if (parsedState.currentLSN) {
      // Check if it's a timestamp (13 digits)
      if (/^\d{13}$/.test(parsedState.currentLSN)) {
        console.log('❌ Found invalid LSN (timestamp):', parsedState.currentLSN);
        parsedState.currentLSN = '0/0';
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        console.log('✅ Reset LSN to 0/0');
      } else if (!/^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/.test(parsedState.currentLSN)) {
        console.log('❌ Found invalid LSN format:', parsedState.currentLSN);
        parsedState.currentLSN = '0/0';
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        console.log('✅ Reset LSN to 0/0');
      } else {
        console.log('✅ LSN format is valid:', parsedState.currentLSN);
      }
    }
    
    console.log('Updated state:', JSON.parse(localStorage.getItem(SYNC_STATE_KEY)));
  } catch (error) {
    console.error('Error parsing state:', error);
  }
} else {
  console.log('No sync state found in localStorage');
}

// Also check app-init-status
const APP_INIT_KEY = 'app-init-status';
const appInitStored = localStorage.getItem(APP_INIT_KEY);
if (appInitStored) {
  console.log('\nApp init status:', JSON.parse(appInitStored));
}