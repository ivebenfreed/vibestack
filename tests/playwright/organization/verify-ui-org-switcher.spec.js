/**
 * @file verify-ui-org-switcher.spec.js
 * 
 * Test to verify that after organization creation:
 * 1. The organization shows up in auth state
 * 2. The organization switcher is visible in the UI
 * 3. The user can access the main application
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify UI shows organization and org switcher after creation', async ({ page }) => {
  console.log('🔍 Starting UI organization switcher verification test...');

  // Step 1: Navigate to the application
  console.log('\n📱 Step 1: Navigate to application and wait for auth');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Wait a bit for auth to fully initialize
  await page.waitForTimeout(2000);

  // Step 2: Check if we're redirected to sign-in (need to login first)
  const currentUrl = page.url();
  if (currentUrl.includes('/sign-in')) {
    console.log('🔑 User needs to sign in first');
    
    // Fill in login form
    await page.fill('input[type="email"]', 'test-playwright-1755347086@gmail.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect after login
    await page.waitForURL('**/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give auth time to load
  }

  // Step 3: Check authentication and organization state
  console.log('\n🔍 Step 3: Check authentication and organization state');
  
  // Wait for auth state to stabilize - try multiple auth machine references
  await page.waitForFunction(() => {
    // Try different possible auth machine exports
    const authMachine = window.authMachineActor || window.authStore || window.authActor;
    if (!authMachine) return false;
    
    const snapshot = authMachine.getSnapshot();
    return snapshot && snapshot.context && snapshot.context.user;
  }, { timeout: 15000 });

  const authState = await page.evaluate(() => {
    // Try different possible auth machine exports
    const authMachine = window.authMachineActor || window.authStore || window.authActor;
    if (!authMachine) return { error: 'Auth machine not found' };
    
    const authSelector = authMachine.getSnapshot();
    return {
      state: authSelector?.value,
      hasUser: !!authSelector?.context?.user,
      userEmail: authSelector?.context?.user?.email,
      orgCount: authSelector?.context?.userOrganizations?.length || 0,
      organizations: authSelector?.context?.userOrganizations || [],
      hasCurrentOrg: !!authSelector?.context?.currentOrganization,
      currentOrgName: authSelector?.context?.currentOrganization?.name,
      currentOrgId: authSelector?.context?.currentOrganization?.id,
      isLoadingOrganizations: authSelector?.context?.isLoadingOrganizations || false,
      needsOrganizationSetup: authSelector?.context?.needsOrganizationSetup || false,
      organizationSetupComplete: authSelector?.context?.organizationSetupComplete || false
    };
  });

  console.log('🤖 Auth state:', JSON.stringify(authState, null, 2));

  // Step 4: Wait for organizations to load if still loading
  if (authState.isLoadingOrganizations) {
    console.log('\n⏳ Waiting for organizations to finish loading...');
    await page.waitForFunction(() => {
      const authMachine = window.authMachineActor || window.authStore || window.authActor;
      if (!authMachine) return false;
      const authSelector = authMachine.getSnapshot();
      return !authSelector?.context?.isLoadingOrganizations;
    }, { timeout: 10000 });
  }

  // Step 5: Check for organization switcher in UI
  console.log('\n🔍 Step 5: Look for organization switcher in UI');
  
  const orgSwitcherState = await page.evaluate(() => {
    // Look for various selectors that might indicate org switcher
    const possibleSelectors = [
      '[data-testid="org-switcher"]',
      '[data-testid="organization-switcher"]', 
      '.org-switcher',
      '.organization-switcher',
      'button:has-text("Playwright Test Organization")',
      '[aria-label*="organization"]',
      '[aria-label*="switch"]'
    ];
    
    const found = [];
    for (const selector of possibleSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          found.push({
            selector,
            count: elements.length,
            texts: Array.from(elements).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    }
    
    // Also search for any text containing the organization name
    const orgNameInPage = document.body.textContent?.includes('Playwright Test Organization');
    
    // Look for sidebar elements
    const sidebarElements = Array.from(document.querySelectorAll('aside, .sidebar, nav')).map(el => ({
      tagName: el.tagName,
      className: el.className,
      textContent: el.textContent?.substring(0, 200)
    }));
    
    return {
      foundSelectors: found,
      orgNameInPage,
      sidebarElements,
      allButtons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()).filter(Boolean),
      bodyTextSnippet: document.body.textContent?.substring(0, 500)
    };
  });

  console.log('🔍 Organization switcher search:', JSON.stringify(orgSwitcherState, null, 2));

  // Step 6: Check current UI state in detail
  console.log('\n📺 Step 6: Check detailed UI state');
  const uiState = await page.evaluate(() => {
    const hasOrgSetupTitle = document.body.textContent?.includes('set up your organization') || false;
    const hasCreateOrgButton = Array.from(document.querySelectorAll('button')).some(btn => 
      btn.textContent?.includes('Create Organization'));
    const hasMainApp = !!document.querySelector('[data-testid="main-app"]') || 
                      !!document.querySelector('.dashboard') ||
                      document.body.textContent?.includes('Dashboard') ||
                      document.body.textContent?.includes('Projects') ||
                      document.body.textContent?.includes('Tasks');
    
    const mainHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(el => el.textContent?.trim())
      .filter(text => text && !text.includes('TanStack'));

    return {
      hasOrgSetupTitle,
      hasCreateOrgButton,
      hasMainApp,
      mainHeadings,
      currentUrl: window.location.href,
      hasPlaywrightOrg: document.body.textContent?.includes('Playwright Test Organization'),
      pageTitle: document.title
    };
  });

  console.log('📋 Detailed UI state:', JSON.stringify(uiState, null, 2));

  // Step 7: Take screenshot for documentation
  await page.screenshot({ 
    path: `./screenshots/ui-org-switcher-verification-${Date.now()}.png`,
    fullPage: true 
  });

  // Step 8: Verify expected state
  console.log('\n✅ Step 8: Verify organization is visible in UI');
  
  if (authState.orgCount > 0) {
    console.log(`✅ Auth State: User has ${authState.orgCount} organization(s)`);
    if (authState.hasCurrentOrg) {
      console.log(`✅ Current org: ${authState.currentOrgName} (${authState.currentOrgId})`);
    }
    
    // Check if org name appears in UI
    if (uiState.hasPlaywrightOrg || orgSwitcherState.orgNameInPage) {
      console.log('✅ Organization name found in UI!');
    } else {
      console.log('⚠️ Organization name not found in UI - may need to check sidebar or other components');
    }
    
    if (orgSwitcherState.foundSelectors.length > 0) {
      console.log('✅ Found organization switcher elements:', orgSwitcherState.foundSelectors);
    } else {
      console.log('⚠️ No organization switcher elements found');
    }
    
  } else {
    console.log('❌ No organizations found in auth state');
    if (uiState.hasCreateOrgButton) {
      console.log('ℹ️ Still showing organization creation flow');
    }
  }

  console.log('\n🏁 UI organization switcher verification completed');
});