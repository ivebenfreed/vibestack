#!/usr/bin/env node

const { chromium } = require('playwright');

async function quickTest() {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    let foundDomainMessage = false;
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('LiveStore Dynamic Domain') || text.includes('loaded!')) {
        console.log('✅ DOMAIN LOADED:', text);
        foundDomainMessage = true;
      }
    });
    
    await page.goto('http://localhost:5174/sign-in');
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    const wideCorpCard = page.locator('text=Wide Corp Solutions');
    await wideCorpCard.click();
    await page.waitForTimeout(2000);
    
    const result = await page.evaluate(() => {
      return {
        available: typeof window.liveStoreDomain !== 'undefined',
        keys: window.liveStoreDomain ? Object.keys(window.liveStoreDomain) : []
      };
    });
    
    console.log('RESULT:', JSON.stringify(result));
    console.log('Domain Message Found:', foundDomainMessage);
    await browser.close();
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

quickTest();