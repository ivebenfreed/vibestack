/**
 * Test Organization Flow Implementation
 * 
 * Tests the new organization setup and switching functionality
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Organization Flow Tests', () => {
  test('should show organization setup or main app', async ({ page }) => {
    console.log('🔍 Testing organization flow...');
    
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForTimeout(3000);
    
    // Check what state we're in
    const currentUrl = page.url();
    const pathname = new URL(currentUrl).pathname;
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📂 Current pathname: ${pathname}`);
    
    // Check if we're in organization setup flow
    const isOrgSetup = await page.locator('h1:has-text("Welcome to VibeStack!")').isVisible({ timeout: 5000 })
      .catch(() => false);
    
    const needsOrgSelection = await page.locator('h1:has-text("Select Organization")').isVisible({ timeout: 5000 })
      .catch(() => false);
    
    const isMainApp = await page.locator('[data-testid="authenticated-content"]').isVisible({ timeout: 5000 })
      .catch(() => false);
    
    console.log(`🏢 Organization setup needed: ${isOrgSetup}`);
    console.log(`📋 Organization selection needed: ${needsOrgSelection}`);
    console.log(`🎯 Main app loaded: ${isMainApp}`);
    
    if (isOrgSetup) {
      console.log('✨ User needs to create first organization');
      
      // Test creating an organization
      const createButton = page.locator('button:has-text("Create Organization")');
      await expect(createButton).toBeVisible();
      await createButton.click();
      
      // Fill in organization form
      const nameInput = page.locator('input[id="name"]');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('Test Organization');
      
      const domainInput = page.locator('input[id="domain"]');
      await domainInput.fill('test-org.com');
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]:has-text("Create Organization")');
      await submitButton.click();
      
      console.log('📝 Organization creation form submitted');
      
      // Wait for the result (either success or error)
      await page.waitForTimeout(3000);
      
    } else if (needsOrgSelection) {
      console.log('🔄 User needs to select from existing organizations');
      
      // Check if there are organization options
      const orgButtons = page.locator('button[variant="outline"]');
      const orgCount = await orgButtons.count();
      console.log(`📊 Found ${orgCount} organizations to choose from`);
      
      if (orgCount > 0) {
        console.log('🎯 Selecting first organization');
        await orgButtons.first().click();
        await page.waitForTimeout(2000);
      }
      
    } else if (isMainApp) {
      console.log('🎉 User is already in main app');
      
      // Check for organization switcher in sidebar
      const orgSwitcher = page.locator('button[role="combobox"]').first();
      const hasOrgSwitcher = await orgSwitcher.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasOrgSwitcher) {
        console.log('🔄 Organization switcher found in sidebar');
        const orgText = await orgSwitcher.textContent();
        console.log(`📋 Current organization: ${orgText}`);
      } else {
        console.log('⚠️  Organization switcher not found');
      }
      
    } else {
      console.log('❓ Unknown state - checking for loading or error states');
      
      // Check for loading states
      const isLoading = await page.locator('text=Loading').isVisible({ timeout: 2000 }).catch(() => false);
      const isCheckingAuth = await page.locator('text=Checking authentication').isVisible({ timeout: 2000 }).catch(() => false);
      const isSettingUp = await page.locator('text=Setting up your workspace').isVisible({ timeout: 2000 }).catch(() => false);
      
      console.log(`⏳ Loading state: ${isLoading}`);
      console.log(`🔐 Checking auth: ${isCheckingAuth}`);
      console.log(`⚙️ Setting up workspace: ${isSettingUp}`);
      
      // Wait a bit more and check again
      if (isLoading || isCheckingAuth || isSettingUp) {
        console.log('⏳ Waiting for setup to complete...');
        await page.waitForTimeout(5000);
      }
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: `./screenshots/organization-flow-${Date.now()}.png`,
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved');
    
    // Final check - we should either be in main app or have clear organization setup UI
    const finalMainApp = await page.locator('[data-testid="authenticated-content"]').isVisible({ timeout: 2000 }).catch(() => false);
    const finalOrgSetup = await page.locator('h1:has-text("Welcome to VibeStack!")').isVisible({ timeout: 2000 }).catch(() => false);
    const finalOrgSelect = await page.locator('h1:has-text("Select Organization")').isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log(`🎯 Final state - Main app: ${finalMainApp}, Org setup: ${finalOrgSetup}, Org select: ${finalOrgSelect}`);
    
    // The test passes if we're in any valid state
    expect(finalMainApp || finalOrgSetup || finalOrgSelect).toBe(true);
  });
  
  test('should have working auth machine with organization context', async ({ page }) => {
    console.log('🔍 Testing auth machine organization context...');
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Check if auth machine is available and has organization context
    const authMachineState = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      if (!authActor) return { error: 'Auth machine not found' };
      
      const snapshot = authActor.getSnapshot();
      return {
        state: snapshot.value,
        hasUser: !!snapshot.context.user,
        hasOrganizations: !!snapshot.context.userOrganizations,
        currentOrg: snapshot.context.currentOrganization?.name || null,
        orgCount: snapshot.context.userOrganizations?.length || 0,
        orgSetupComplete: snapshot.context.organizationSetupComplete,
        isAuthenticatedAndReady: snapshot.matches ? snapshot.matches('authenticated.ready') : false
      };
    });
    
    console.log('🤖 Auth machine state:', JSON.stringify(authMachineState, null, 2));
    
    // Auth machine should exist and have a user
    expect(authMachineState.error).toBeUndefined();
    expect(authMachineState.hasUser).toBe(true);
    
    // Log the organization context for debugging
    if (authMachineState.orgCount > 0) {
      console.log(`🏢 User has ${authMachineState.orgCount} organizations`);
      if (authMachineState.currentOrg) {
        console.log(`📋 Current organization: ${authMachineState.currentOrg}`);
      }
    } else {
      console.log('🆕 User has no organizations (needs setup)');
    }
  });
});