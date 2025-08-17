const { test, expect } = require('@playwright/test');

test('verify site accessibility - should fail to connect', async ({ page }) => {
  console.log('Attempting to visit http://localhost:4321/');
  
  try {
    // Try to navigate to the site with a timeout
    await page.goto('http://localhost:4321/', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    // If we get here, the site is accessible
    console.log('Site is accessible - test will fail as expected');
    const title = await page.title();
    console.log('Page title:', title);
    
    // This test expects the site to be inaccessible
    throw new Error('Site is unexpectedly accessible');
    
  } catch (error) {
    console.log('Error accessing site:', error.message);
    
    // Check if it's a connection error (expected)
    if (error.message.includes('net::ERR_CONNECTION_REFUSED') || 
        error.message.includes('Timeout') ||
        error.message.includes('Navigation timeout')) {
      console.log('✓ Confirmed: Site is not accessible');
      return; // Test passes - site is not accessible
    }
    
    // Re-throw other errors
    throw error;
  }
});

test('check if port 4321 is listening', async ({ page }) => {
  console.log('Testing port connectivity...');
  
  try {
    const response = await page.request.get('http://localhost:4321/', {
      timeout: 5000
    });
    console.log('Port response status:', response.status());
    
    // If we get a response, the port is accessible
    throw new Error('Port 4321 is accessible but should not be');
    
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch failed') ||
        error.message.includes('Timeout')) {
      console.log('✓ Confirmed: Port 4321 is not accessible');
      return;
    }
    throw error;
  }
});