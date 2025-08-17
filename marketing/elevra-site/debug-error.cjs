const { chromium } = require('playwright');

async function debugSiteError() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:4321/', { timeout: 10000 });
    const title = await page.title();
    console.log('Page title:', title);
    
    if (title.includes('CompilerError')) {
      const errorText = await page.textContent('body');
      console.log('Error details:');
      console.log(errorText.substring(0, 1000));
    } else {
      console.log('SUCCESS: Site is accessible!');
      const content = await page.textContent('h1');
      console.log('Page heading:', content);
    }
  } catch (error) {
    console.log('FAIL: Cannot access site - ' + error.message);
  }
  
  await browser.close();
}

debugSiteError();