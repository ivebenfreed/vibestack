// Test that all main pages load by clicking sidebar navigation links
// Takes screenshots of each fully loaded page after navigation

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('All Pages Load via Sidebar Navigation', () => {
  test.setTimeout(180000); // 3 minutes for all pages

  test('navigate to all pages via sidebar and capture screenshots', async ({ page }) => {
    console.log('🚀 Testing navigation to all pages via sidebar...\n');

    // First, go to the main page
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('📍 Navigating to dashboard...\n');

    // Wait for Playwright ready hook
    console.log('⏳ Waiting for Playwright ready hook...');
    const hasPlaywrightReady = await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 15000 }).then(() => true).catch(() => false);
    
    if (!hasPlaywrightReady) {
      throw new Error('App not ready - Playwright ready hook not found');
    }
    console.log('✅ App ready!');
    
    // Check if we're logged in
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/sign-in');
    if (isLoginPage) {
      throw new Error('Not authenticated. Run: npx playwright test tests/playwright/setup/01-initial-auth.spec.js');
    }

    // Define expected main navigation links
    const expectedMainLinks = [
      { href: '/', label: 'Dashboard' },
      { href: '/projects', label: 'Projects' },
      { href: '/tasks', label: 'Tasks' },
      { href: '/apps', label: 'Apps' },
      { href: '/chats', label: 'Chats' },
      { href: '/help-center', label: 'Help Center' },
      { href: '/settings', label: 'Settings' },
      { href: '/debug', label: 'Debug' }
    ];

    // Get all navigation links from the sidebar
    const sidebarLinks = await page.$$eval(
      '[data-testid^="nav-link-"]',
      links => links.map(link => ({
        text: link.textContent?.trim() || '',
        href: link.getAttribute('href') || '',
        testId: link.getAttribute('data-testid') || ''
      }))
    );

    console.log(`📋 Found ${sidebarLinks.length} navigation links in sidebar\n`);

    const results = [];
    const visitedUrls = new Set();

    for (const link of sidebarLinks) {
      // Skip if we've already visited this URL
      if (visitedUrls.has(link.href)) {
        continue;
      }
      visitedUrls.add(link.href);

      const pageName = link.text || link.href;
      console.log(`📄 Navigating to: ${pageName} (${link.href})`);

      try {
        // Click the sidebar link (this will cause page reload)
        const linkSelector = `[data-testid="${link.testId}"]`;
        
        // Make sure the link is visible
        await page.waitForSelector(linkSelector, { timeout: 5000 });
        
        // Click the link
        await page.click(linkSelector);
        
        // Wait for the page to load after clicking
        await page.waitForLoadState('networkidle', { timeout: 15000 });
        
        // Wait a bit for any client-side rendering
        await page.waitForTimeout(1000);

        // Check if Playwright ready hook fired
        const hasPlaywrightReady = await page.evaluate(() => {
          return (
            document.body.getAttribute('data-playwright-ready') === 'true' ||
            document.querySelector('[data-playwright-ready="true"]') !== null
          );
        });

        if (hasPlaywrightReady) {
          console.log(`  ✅ Page loaded with Playwright ready hook`);
        } else {
          console.log(`  ⚠️  Page loaded but no Playwright ready hook detected`);
        }

        // Get the current URL after navigation
        const currentUrl = page.url();
        console.log(`  📍 Current URL: ${currentUrl}`);

        // Take screenshot
        const screenshotName = link.href.replace(/\//g, '-').substring(1) || 'home';
        const screenshotPath = `screenshots/pages/${screenshotName}.png`;
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        console.log(`  📸 Screenshot saved: ${screenshotPath}`);

        // Check for main content
        const hasMainContent = await page.evaluate(() => {
          const main = document.querySelector('main') || document.querySelector('[role="main"]');
          return main && (main.textContent?.trim().length || 0) > 50;
        });

        // Get page title
        const pageTitle = await page.title();

        results.push({
          name: pageName,
          href: link.href,
          url: currentUrl,
          loaded: true,
          ready: hasPlaywrightReady,
          hasContent: hasMainContent,
          title: pageTitle,
          screenshot: screenshotPath
        });

        console.log(`  📊 Content: ${hasMainContent ? 'Yes' : 'No'} | Title: ${pageTitle}`);
        console.log('');

      } catch (error) {
        console.log(`  ❌ Failed to navigate: ${error.message}\n`);
        results.push({
          name: pageName,
          href: link.href,
          loaded: false,
          error: error.message
        });
      }
    }

    // Summary report
    console.log('📊 === Navigation Test Summary ===\n');
    console.log('Page Navigation Results:');
    console.log('------------------------');
    
    for (const result of results) {
      const status = result.loaded ? (result.ready ? '✅' : '⚠️') : '❌';
      const name = (result.name || result.href).padEnd(20);
      console.log(`${status} ${name} - Loaded: ${result.loaded}, Ready: ${result.ready || false}`);
    }

    console.log(`\n📸 ${results.filter(r => r.screenshot).length} screenshots saved in screenshots/pages/`);
    
    // Count pages with ready hook
    const readyCount = results.filter(r => r.ready).length;
    console.log(`\n📈 Pages with Playwright ready hook: ${readyCount}/${results.filter(r => r.loaded).length}`);
    
    if (readyCount < results.length) {
      console.log('\n💡 To add Playwright ready hook to pages:');
      console.log('   1. Import: import { usePlaywrightReady } from "@/hooks/use-playwright-ready";');
      console.log('   2. Add in component: usePlaywrightReady("[PLAYWRIGHT_READY] PageName");');
    }

    // All pages should load (ready hook is optional)
    const allLoaded = results.every(r => r.loaded);
    expect(allLoaded).toBe(true);
  });

  test('verify all sidebar links are clickable', async ({ page }) => {
    console.log('🔍 Verifying sidebar link interactions...\n');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check if logged in
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/sign-in')) {
      throw new Error('Authentication required. Run: npx playwright test tests/playwright/setup/01-initial-auth.spec.js');
    }
    
    // Wait for app to be ready
    await page.waitForTimeout(2000);
    
    // Get all sidebar links
    const links = await page.$$('a[href]');
    
    console.log(`Found ${links.length} total links`);
    
    let navLinkCount = 0;
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      const isVisible = await link.isVisible();
      
      if (href && href.startsWith('/') && 
          !href.includes('/sign-') && 
          !href.includes('/projects/') &&
          !href.includes('/forgot-') &&
          !href.includes('/terms') &&
          !href.includes('/privacy')) {
        console.log(`  ${isVisible ? '✅' : '❌'} ${text?.trim() || href} - ${isVisible ? 'Visible' : 'Hidden'}`);
        navLinkCount++;
      }
    }
    console.log(`\n📊 Total navigation links: ${navLinkCount}`);
    
    expect(navLinkCount).toBeGreaterThan(0);
  });

  test('check for console errors during navigation', async ({ page }) => {
    console.log('🔍 Checking for console errors during navigation...\n');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check if logged in
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/sign-in')) {
      throw new Error('Authentication required. Run: npx playwright test tests/playwright/setup/01-initial-auth.spec.js');
    }
    
    const consoleErrors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          url: page.url(),
          error: msg.text()
        });
      }
    });
    
    // Wait for app to be ready
    await page.waitForTimeout(2000);
    
    // Get navigation links
    const links = await page.$$eval('a[href]', links => 
      links.map(link => link.getAttribute('href'))
           .filter(href => href && 
                   href.startsWith('/') && 
                   !href.includes('/sign-') && 
                   !href.includes('/projects/') &&
                   !href.includes('/forgot-') &&
                   !href.includes('/terms') &&
                   !href.includes('/privacy'))
           .slice(0, 3)
    );
    
    console.log(`Testing navigation to ${links.length} pages for console errors...`);
    
    for (const href of links) {
      console.log(`  Navigating to: ${href}`);
      await page.goto(href, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
    
    if (consoleErrors.length > 0) {
      console.log('\n⚠️  Console errors detected:');
      consoleErrors.forEach(err => {
        console.log(`  - ${err.url}: ${err.error}`);
      });
    } else {
      console.log('\n✅ No console errors during navigation');
    }
    
    expect(consoleErrors.length).toBe(0);
  });
});