/**
 * Simple test to check the current auth context and organization state
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('Check current auth and organization context', async ({ page }) => {
  console.log('🔍 Checking current auth and organization context...');
  
  // Navigate to the app
  await page.goto('/');
  
  // Wait for the app to load
  await page.waitForTimeout(5000);
  
  // Get the current page state
  const pageInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      title: document.title,
      hasAuthMachine: !!window.authMachineActor,
      hasAppInit: !!window.appInitActor,
      bodyText: document.body.textContent?.substring(0, 1000) || 'No body text',
      bodyHTML: document.body.innerHTML.substring(0, 1000) // First 1000 chars for debugging
    };
  });
  
  console.log('📍 Page info:', {
    url: pageInfo.url,
    pathname: pageInfo.pathname,
    title: pageInfo.title,
    hasAuthMachine: pageInfo.hasAuthMachine,
    hasAppInit: pageInfo.hasAppInit
  });
  
  console.log('📄 Page body text:', pageInfo.bodyText);
  console.log('📝 Page body HTML:', pageInfo.bodyHTML);
  
  // If auth machine exists, get its state
  if (pageInfo.hasAuthMachine) {
    const authState = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      const snapshot = authActor.getSnapshot();
      
      return {
        state: snapshot.value,
        user: snapshot.context.user ? {
          id: snapshot.context.user.id,
          email: snapshot.context.user.email,
          name: snapshot.context.user.name,
          role: snapshot.context.user.role
        } : null,
        currentOrganization: snapshot.context.currentOrganization,
        userOrganizations: snapshot.context.userOrganizations,
        organizationSetupComplete: snapshot.context.organizationSetupComplete,
        needsOrganizationSetup: snapshot.context.needsOrganizationSetup,
        isLoadingOrganizations: snapshot.context.isLoadingOrganizations,
        organizationError: snapshot.context.organizationError
      };
    });
    
    console.log('🤖 Auth machine state:', JSON.stringify(authState, null, 2));
  } else {
    console.log('❌ Auth machine not found on window');
  }
  
  // Check what's visible on the page
  const visibleElements = await page.evaluate(() => {
    const elements = {
      hasSignInForm: !!document.querySelector('input[type="email"]'),
      hasAuthenticatedContent: !!document.querySelector('[data-testid="authenticated-content"]'),
      hasOrgSetupTitle: !!document.querySelector('h1') && document.querySelector('h1').textContent.includes('Welcome to VibeStack'),
      hasOrgSelectTitle: !!document.querySelector('h1') && document.querySelector('h1').textContent.includes('Select Organization'),
      hasLoadingText: document.body.textContent.includes('Loading') || document.body.textContent.includes('Checking'),
      mainHeadings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent).filter(t => t.trim())
    };
    
    return elements;
  });
  
  console.log('👀 Visible elements:', JSON.stringify(visibleElements, null, 2));
  
  // Take a screenshot for debugging
  await page.screenshot({ 
    path: `./screenshots/auth-context-check-${Date.now()}.png`,
    fullPage: true 
  });
  
  console.log('📸 Screenshot saved');
  
  // The test just gathers info, so we always pass
  expect(true).toBe(true);
});