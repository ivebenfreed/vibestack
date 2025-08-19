#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLiveStoreDomain() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Monitor console for domain loading
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('LiveStore Dynamic Domain') || text.includes('liveStoreDomain')) {
      console.log('✅ CONSOLE:', text);
    }
  });
  
  await page.goto('http://localhost:5174/sign-in');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const wideCorpCard = page.locator('text=Wide Corp Solutions');
  await wideCorpCard.click();
  await page.waitForTimeout(3000);
  
  const result = await page.evaluate(() => {
    return {
      liveStoreDomainAvailable: typeof window.liveStoreDomain !== 'undefined',
      liveStoreDomainKeys: window.liveStoreDomain ? Object.keys(window.liveStoreDomain) : [],
      servicesAvailable: window.liveStoreDomain && window.liveStoreDomain.services ? Object.keys(window.liveStoreDomain.services) : []
    };
  });
  
  console.log('LiveStore Status:', JSON.stringify(result, null, 2));
  await browser.close();
}

testLiveStoreDomain().catch(console.error);