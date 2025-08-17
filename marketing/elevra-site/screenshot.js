import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Taking screenshot of http://localhost:4321...');
  await page.goto('http://localhost:4321');
  await page.waitForLoadState('networkidle');
  
  await page.screenshot({ 
    path: 'getelevra-screenshot.png', 
    fullPage: true 
  });
  
  console.log('Screenshot saved as getelevra-screenshot.png');
  await browser.close();
})();