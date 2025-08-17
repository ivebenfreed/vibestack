const { chromium } = require('playwright');

async function verifySiteInaccessible() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing site access at http://localhost:4321/');
    await page.goto('http://localhost:4321/', { timeout: 5000 });
    console.log('FAIL: Site is accessible when it should not be');
  } catch (error) {
    if (error.message.includes('ERR_CONNECTION_REFUSED') || 
        error.message.includes('Timeout')) {
      console.log('PASS: Site correctly inaccessible - ' + error.message);
    } else {
      console.log('UNKNOWN ERROR: ' + error.message);
    }
  }
  
  await browser.close();
}

verifySiteInaccessible();