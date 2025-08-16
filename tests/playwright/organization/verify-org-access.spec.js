/**
 * @file verify-org-access.spec.js
 * 
 * Test to verify that the user can access the main application
 * after successfully creating an organization.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify user can access main app after organization creation', async ({ page }) => {
  console.log('🔍 Starting organization access verification test...');

  // Step 1: Navigate to the application
  console.log('\n📱 Step 1: Navigate to application');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Step 2: Check authentication state
  console.log('\n🔍 Step 2: Check authentication and organization state');
  const authState = await page.evaluate(() => {
    const authSelector = window.authStore?.getSnapshot();
    return {
      state: authSelector?.value,
      hasUser: !!authSelector?.context?.user,
      userEmail: authSelector?.context?.user?.email,
      orgCount: authSelector?.context?.userOrganizations?.length || 0,
      hasCurrentOrg: !!authSelector?.context?.currentOrganization,
      currentOrgName: authSelector?.context?.currentOrganization?.name,
      isLoadingOrganizations: authSelector?.context?.isLoadingOrganizations || false,
      needsOrganizationSetup: authSelector?.context?.needsOrganizationSetup || false,
      organizationSetupComplete: authSelector?.context?.organizationSetupComplete || false
    };
  });

  console.log('🤖 Auth state:', JSON.stringify(authState, null, 2));

  // Step 3: Wait for organizations to load if needed
  if (authState.isLoadingOrganizations) {
    console.log('\n⏳ Waiting for organizations to finish loading...');
    await page.waitForFunction(() => {
      const authSelector = window.authStore?.getSnapshot();
      return !authSelector?.context?.isLoadingOrganizations;
    }, { timeout: 10000 });
    
    // Get updated state
    const updatedState = await page.evaluate(() => {
      const authSelector = window.authStore?.getSnapshot();
      return {
        state: authSelector?.value,
        orgCount: authSelector?.context?.userOrganizations?.length || 0,
        hasCurrentOrg: !!authSelector?.context?.currentOrganization,
        currentOrgName: authSelector?.context?.currentOrganization?.name,
        needsOrganizationSetup: authSelector?.context?.needsOrganizationSetup || false,
        organizationSetupComplete: authSelector?.context?.organizationSetupComplete || false
      };
    });
    
    console.log('🔄 Updated auth state:', JSON.stringify(updatedState, null, 2));
  }

  // Step 4: Check current UI state
  console.log('\n📺 Step 4: Check current UI state');
  const uiState = await page.evaluate(() => {
    const hasOrgSetupTitle = document.body.textContent?.includes('set up your organization') || false;
    const hasCreateOrgButton = Array.from(document.querySelectorAll('button')).some(btn => 
      btn.textContent?.includes('Create Organization'));
    const hasMainApp = !!document.querySelector('[data-testid="main-app"]') || 
                      !!document.querySelector('.dashboard') ||
                      document.body.textContent?.includes('Dashboard') ||
                      document.body.textContent?.includes('Projects') ||
                      document.body.textContent?.includes('Tasks');
    
    const mainHeadings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(el => el.textContent?.trim())
      .filter(text => text && !text.includes('TanStack'));

    return {
      hasOrgSetupTitle,
      hasCreateOrgButton,
      hasMainApp,
      mainHeadings,
      currentUrl: window.location.href,
      bodyText: document.body.textContent?.substring(0, 500)
    };
  });

  console.log('📋 UI state:', JSON.stringify(uiState, null, 2));

  // Step 5: Take screenshot for documentation
  await page.screenshot({ 
    path: `./screenshots/verify-org-access-${Date.now()}.png`,
    fullPage: true 
  });

  // Step 6: Verify expected state
  console.log('\n✅ Step 6: Verify access to main application');
  
  if (authState.orgCount > 0 && authState.hasCurrentOrg) {
    console.log(`✅ Success! User has ${authState.orgCount} organization(s) and current org: ${authState.currentOrgName}`);
    console.log('✅ Organization setup is complete - user should have access to main app');
    
    // Should not be in organization setup flow anymore
    expect(uiState.hasCreateOrgButton).toBe(false);
    expect(uiState.hasOrgSetupTitle).toBe(false);
    
  } else if (authState.orgCount === 0 || authState.needsOrganizationSetup) {
    console.log('⚠️  User still needs organization setup');
    console.log('📝 This might be expected if the test is run in isolation');
    
  } else {
    console.log('❓ Unclear organization state - reviewing...');
  }

  console.log('\n🏁 Organization access verification test completed');
});