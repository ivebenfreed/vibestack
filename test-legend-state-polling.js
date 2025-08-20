/**
 * Manual test script for Legend State polling
 * Run this in browser console at http://localhost:5173/debug/legend-state-poc
 */

// Test Legend State polling functionality
async function testLegendStatePolling() {
  console.log('🧪 Starting Legend State polling test...');
  
  // 1. Check if page loaded correctly
  const heading = document.querySelector('h1');
  if (!heading || !heading.textContent.includes('Legend State')) {
    console.error('❌ Legend State page not loaded properly');
    return;
  }
  console.log('✅ Legend State page loaded');
  
  // 2. Test manual fetch first
  console.log('📡 Testing manual fetch...');
  const manualFetchBtn = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.includes('Manual Fetch'));
  
  if (!manualFetchBtn) {
    console.error('❌ Manual Fetch button not found');
    return;
  }
  
  manualFetchBtn.click();
  console.log('✅ Manual fetch triggered');
  
  // Wait a bit for the fetch to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Test polling controls
  console.log('🔄 Testing polling controls...');
  const startPollingBtn = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.includes('Start Polling'));
    
  const stopPollingBtn = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.includes('Stop Polling'));
  
  if (!startPollingBtn || !stopPollingBtn) {
    console.error('❌ Polling buttons not found');
    return;
  }
  
  // Start polling
  startPollingBtn.click();
  console.log('✅ Polling started');
  
  // Wait for a few polling cycles
  console.log('⏱️ Waiting for polling cycles...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Stop polling
  stopPollingBtn.click();
  console.log('✅ Polling stopped');
  
  // 4. Check data counts
  const projectCard = document.querySelector('[title*="Projects"], h3:contains("Projects"), .card:has-text("Projects")');
  if (projectCard) {
    console.log('✅ Projects card found:', projectCard.textContent);
  }
  
  // 5. Test interval changes
  console.log('⚡ Testing interval changes...');
  const intervalButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => ['2s', '5s', '10s'].includes(btn.textContent.trim()));
  
  if (intervalButtons.length > 0) {
    intervalButtons[0].click(); // Click 2s interval
    console.log('✅ Interval changed to 2s');
  }
  
  console.log('🎉 Legend State polling test completed!');
  console.log('📊 Check browser console for Legend State logs showing reactive updates');
}

// Instructions
console.log(`
🎯 Legend State Polling Test Instructions:

1. Navigate to: http://localhost:5173/debug/legend-state-poc
2. Login if needed (use Wide Corp CEO credentials)
3. Open browser console
4. Run: testLegendStatePolling()
5. Watch console logs for Legend State reactive updates

Legend State should show logs like:
- "🔄 Legend State: Polling for projects..."
- "✅ Legend State: Data updated via polling"
- "🎯 Legend State: Projects observable changed"
`);

// Auto-run if we're on the right page
if (window.location.pathname.includes('legend-state-poc')) {
  console.log('🚀 Auto-running Legend State test...');
  setTimeout(() => {
    testLegendStatePolling().catch(console.error);
  }, 1000);
} else {
  console.log('📍 Navigate to the Legend State POC page first');
}