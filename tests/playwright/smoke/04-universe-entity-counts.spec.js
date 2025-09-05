// 04-universe-entity-counts.spec.js
// Test to verify universe route shows entity cards with non-zero counts

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Universe Entity Counts', () => {
  test('should login and verify universe route shows non-zero entity counts', async ({ page }) => {
    console.log('🏢 Testing universe entity counts with Wide Corp CEO');
    
    // Navigate to the app
    await page.goto('/');
    console.log('📍 Navigated to home page');
    
    // Wait for page to load and check current URL
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    console.log(`🔍 Current URL: ${currentUrl}`);
    
    // Check if we're on the login/sign-in page or have login elements
    const isOnLoginPage = currentUrl.includes('/sign-in') || currentUrl.includes('/login');
    
    const loginElements = await Promise.all([
      page.locator('button:has-text("Login")').isVisible().catch(() => false),
      page.locator('button:has-text("Sign In")').isVisible().catch(() => false),
      page.locator('input[name="email"]').isVisible().catch(() => false),
      page.locator('textbox[name="Email"]').isVisible().catch(() => false)
    ]);
    
    const hasLoginElements = loginElements.some(visible => visible);
    const isSignInVisible = isOnLoginPage || hasLoginElements;
    
    console.log(`🔍 Login detection: URL includes login=${isOnLoginPage}, has login elements=${hasLoginElements}, needs login=${isSignInVisible}`);
    
    if (isSignInVisible) {
      console.log('🔐 Not logged in, proceeding with authentication...');
      
      // Fill in login credentials - try multiple selectors
      const emailSelectors = [
        'textbox[name="Email"]',
        'input[name="email"]', 
        'input[type="email"]',
        'textbox:has-text("Email")'
      ];
      
      const passwordSelectors = [
        'textbox[name="Password"]',
        'input[name="password"]',
        'input[type="password"]',
        'textbox:has-text("Password")'
      ];
      
      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          const input = page.locator(selector).first();
          if (await input.isVisible()) {
            emailInput = input;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          const input = page.locator(selector).first();
          if (await input.isVisible()) {
            passwordInput = input;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!emailInput) {
        throw new Error('Could not find email input field');
      }
      if (!passwordInput) {
        throw new Error('Could not find password input field');
      }
      
      await emailInput.waitFor({ state: 'visible' });
      await emailInput.fill('ceo@widecorp.com');
      console.log('📧 Email entered: ceo@widecorp.com');
      
      await passwordInput.waitFor({ state: 'visible' });
      await passwordInput.fill('WideCorp2024!CEO');
      console.log('🔒 Password entered');
      
      // Submit the form - try different button selectors
      const submitSelectors = [
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button[type="submit"]'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible()) {
            submitButton = button;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!submitButton) {
        throw new Error('Could not find submit button');
      }
      
      await submitButton.click();
      console.log('✅ Login form submitted');
      
      // Wait for redirect or navigation after login - try multiple approaches
      try {
        await page.waitForURL(url => !url.pathname.includes('/sign-in') && !url.pathname.includes('/login'), { timeout: 10000 });
        console.log('🔄 Redirected after login via URL change');
      } catch (error) {
        // If URL-based wait fails, wait for login elements to disappear
        console.log('⏳ Waiting for login elements to disappear...');
        await page.waitForSelector('button:has-text("Login")', { state: 'hidden', timeout: 10000 }).catch(() => {
          // Try other approaches
        });
        await page.waitForLoadState('networkidle');
        console.log('🔄 Login elements disappeared');
      }
      
      const postLoginUrl = page.url();
      console.log(`✅ Post-login URL: ${postLoginUrl}`);
    } else {
      console.log('✅ Already logged in, proceeding...');
    }
    
    // Navigate to universe route
    console.log('🌌 Navigating to universe route...');
    await page.goto('/universe');
    
    // Wait for the page to load and app to initialize
    await page.waitForLoadState('networkidle');
    console.log('⏳ Network idle, waiting for app initialization...');
    
    // Wait for the "Starting..." or "Preparing..." text to disappear
    try {
      await page.waitForSelector('text=Starting', { state: 'hidden', timeout: 15000 });
      console.log('✅ "Starting..." text disappeared');
    } catch (e) {
      console.log('⚠️ "Starting..." text not found or timed out waiting for it to disappear');
    }
    
    try {
      await page.waitForSelector('text=Preparing application', { state: 'hidden', timeout: 15000 });
      console.log('✅ "Preparing application..." text disappeared');
    } catch (e) {
      console.log('⚠️ "Preparing application..." text not found or timed out waiting for it to disappear');
    }
    
    // Additional wait for any content to load
    await page.waitForTimeout(2000);
    console.log('⏳ App initialization complete');
    
    // Look for entity cards - they might have various selectors
    const entityCardSelectors = [
      '[data-testid*="entity-card"]',
      '[class*="entity-card"]',
      '[data-entity-type]',
      '.card:has-text("Tasks")',
      '.card:has-text("Projects")',
      '.card:has-text("Organizations")',
      '.card:has-text("Teams")',
      '.card:has-text("Documents")',
      '.card:has-text("Records")'
    ];
    
    let entityCards = null;
    let selectorUsed = '';
    
    // Try different selectors to find entity cards
    for (const selector of entityCardSelectors) {
      try {
        const cards = page.locator(selector);
        const count = await cards.count();
        if (count > 0) {
          entityCards = cards;
          selectorUsed = selector;
          console.log(`🎯 Found ${count} entity cards using selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    // If no specific entity cards found, look for any cards with numbers
    if (!entityCards) {
      console.log('🔍 Looking for cards with count numbers...');
      entityCards = page.locator('.card, [class*="card"]').filter({ 
        hasText: /\d+/ 
      });
      selectorUsed = 'cards with numbers';
    }
    
    // Verify we found some entity cards
    const cardCount = await entityCards.count();
    expect(cardCount).toBeGreaterThan(0, `Should find entity cards on universe page using ${selectorUsed}`);
    console.log(`📊 Found ${cardCount} entity cards`);
    
    // Check each card for non-zero counts
    let nonZeroCountFound = false;
    const cardDetails = [];
    
    for (let i = 0; i < cardCount; i++) {
      const card = entityCards.nth(i);
      const cardText = await card.textContent();
      
      // Extract numbers from card text
      const numbers = cardText.match(/\d+/g);
      if (numbers) {
        for (const numStr of numbers) {
          const num = parseInt(numStr);
          if (num > 0) {
            nonZeroCountFound = true;
            cardDetails.push({
              index: i,
              text: cardText.trim(),
              count: num
            });
            console.log(`✅ Card ${i}: Found non-zero count ${num} in: ${cardText.trim().substring(0, 100)}...`);
            break; // Found non-zero for this card, move to next
          }
        }
      }
    }
    
    // Verify at least one card has a non-zero count
    expect(nonZeroCountFound).toBe(true, 
      `At least one entity card should show a non-zero count. Found cards: ${JSON.stringify(cardDetails, null, 2)}`
    );
    
    console.log(`🎉 Success! Found ${cardDetails.length} cards with non-zero counts`);
    
    // Log summary
    console.log('\n📋 Entity Card Summary:');
    cardDetails.forEach(card => {
      console.log(`   Card ${card.index}: Count ${card.count} - ${card.text.substring(0, 50)}...`);
    });
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'screenshots/universe-entity-counts.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: screenshots/universe-entity-counts.png');
  });
});