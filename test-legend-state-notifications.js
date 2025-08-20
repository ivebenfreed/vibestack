const { chromium } = require('playwright');

async function testLegendStateNotifications() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 Starting Legend State + WAL notification test');

    // Log in as Wide Corp CEO
    console.log('🔐 Logging in as Wide Corp CEO...');
    await page.goto('http://localhost:5173/sign-in');
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    
    // Wait for login redirect
    await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    console.log('✅ Successfully logged in');

    // Navigate to the Legend State WebSocket POC
    console.log('🎯 Navigating to Legend State WebSocket POC...');
    await page.goto('http://localhost:5173/debug/legend-state-websocket-poc');
    
    // Wait for the page to load and data to be fetched
    await page.waitForTimeout(3000);
    
    // Listen for console logs to capture Legend State activity
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('Legend State') || msg.text().includes('table change') || msg.text().includes('srv_')) {
        consoleLogs.push(msg.text());
        console.log(`🔍 Console: ${msg.text()}`);
      }
    });

    // Check if the POC loaded by looking for the title
    const title = await page.textContent('h1');
    console.log(`📊 Page loaded: ${title}`);

    // Check if projects and clients cards exist
    const projectsCard = await page.locator('text=Projects').first();
    const clientsCard = await page.locator('text=Clients').first();
    
    if (await projectsCard.isVisible()) {
      console.log('✅ Projects card found');
    }
    if (await clientsCard.isVisible()) {
      console.log('✅ Clients card found');
    }

    // Test creating a new project to trigger WAL notifications
    console.log('🏗️ Creating a test project to trigger notifications...');
    await page.click('button:has-text("Create Sample Project")');
    
    // Wait for the API call to complete and any notifications
    await page.waitForTimeout(2000);
    
    // Check for table change notifications in console logs
    const hasTableNotifications = consoleLogs.some(log => 
      log.includes('table change notification') || 
      log.includes('srv_table_change_notification')
    );
    
    if (hasTableNotifications) {
      console.log('✅ Table change notifications working!');
    } else {
      console.log('⚠️ No table change notifications detected');
    }

    console.log('📊 Project creation completed');

    // Test the update functionality
    console.log('🔄 Testing project update functionality...');
    await page.click('button:has-text("Update Random Project")');
    await page.waitForTimeout(2000);

    // Check for more notifications
    const hasUpdateNotifications = consoleLogs.some(log => 
      log.includes('refetching') || 
      log.includes('Change affects active tables') ||
      log.includes('Legend State')
    );
    
    if (hasUpdateNotifications) {
      console.log('✅ Update notifications working!');
    } else {
      console.log('⚠️ No update notifications detected');
    }

    // Check if connection badge exists
    const connectionBadge = await page.locator('.badge').first();
    if (await connectionBadge.isVisible()) {
      const badgeText = await connectionBadge.textContent();
      console.log(`🔗 Connection status: ${badgeText}`);
    }

    // Check if manual refresh works
    console.log('🔄 Testing manual refresh...');
    await page.click('button:has-text("Manual Refresh")');
    await page.waitForTimeout(1000);

    // Summary
    console.log('\n📋 Test Summary:');
    console.log('- Legend State POC page loaded successfully');
    console.log('- Project creation test completed');
    console.log('- Project update test completed');
    console.log('- Manual refresh test completed');
    console.log(`- Console logs captured: ${consoleLogs.length}`);
    
    if (consoleLogs.length > 0) {
      console.log('\n🔍 Recent Legend State logs:');
      consoleLogs.slice(-5).forEach(log => console.log(`   ${log}`));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testLegendStateNotifications();