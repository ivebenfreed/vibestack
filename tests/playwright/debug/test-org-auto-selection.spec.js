/**
 * Debug Organization Auto-Selection
 * 
 * This test examines why the auth machine isn't auto-selecting 
 * an organization after login.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug organization auto-selection', async ({ page }) => {
  console.log('🏢 Debugging organization auto-selection...');
  
  // Navigate and wait for auth to settle
  await page.goto('/');
  await page.waitForTimeout(5000); // Give auth machine time to settle
  
  // Get detailed auth machine state
  const authDetails = await page.evaluate(() => {
    if (!window.authMachineActor) {
      return { error: 'No auth machine actor' };
    }
    
    const snapshot = window.authMachineActor.getSnapshot();
    return {
      state: snapshot.value,
      context: {
        user: snapshot.context.user,
        currentOrganization: snapshot.context.currentOrganization,
        userOrganizations: snapshot.context.userOrganizations,
        organizationSetupComplete: snapshot.context.organizationSetupComplete,
        organizationError: snapshot.context.organizationError,
        isLoadingOrganizations: snapshot.context.isLoadingOrganizations
      }
    };
  });
  
  console.log('📊 Auth machine details:', JSON.stringify(authDetails, null, 2));
  
  // Check localStorage for last organization preference
  const orgPreference = await page.evaluate(() => {
    return {
      lastOrgId: localStorage.getItem('vibestack-last-organization-id'),
      allLocalStorage: Object.keys(localStorage).reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {})
    };
  });
  
  console.log('🔖 Organization preference:', orgPreference);
  
  // Test the guard conditions manually
  const guardTests = await page.evaluate(() => {
    if (!window.authMachineActor) {
      return { error: 'No auth machine actor' };
    }
    
    const context = window.authMachineActor.getSnapshot().context;
    
    // Replicate hasNoCurrentOrganization guard logic
    const hasCurrentOrg = !!context.currentOrganization;
    const hasOrganizations = context.userOrganizations && context.userOrganizations.length > 0;
    const orgCount = context.userOrganizations ? context.userOrganizations.length : 0;
    const lastOrgId = localStorage.getItem('vibestack-last-organization-id');
    
    let autoSelectableOrg = null;
    let autoSelectReason = null;
    
    if (hasOrganizations) {
      // Test single org auto-select
      if (orgCount === 1) {
        autoSelectableOrg = context.userOrganizations[0];
        autoSelectReason = 'single organization';
      }
      // Test last used org auto-select
      else if (lastOrgId) {
        const foundOrg = context.userOrganizations.find(org => org.id === lastOrgId);
        if (foundOrg) {
          autoSelectableOrg = foundOrg;
          autoSelectReason = 'last used organization';
        } else {
          // Fallback to first
          autoSelectableOrg = context.userOrganizations[0];
          autoSelectReason = 'first organization (last used not found)';
        }
      }
      // Fallback to first org
      else {
        autoSelectableOrg = context.userOrganizations[0];
        autoSelectReason = 'first organization (no preference saved)';
      }
    }
    
    return {
      hasCurrentOrg,
      hasOrganizations,
      orgCount,
      lastOrgId,
      organizations: context.userOrganizations,
      autoSelectableOrg,
      autoSelectReason,
      // Guard results
      needsManualSelection: !hasCurrentOrg && hasOrganizations && orgCount > 1 && !lastOrgId
    };
  });
  
  console.log('🧪 Guard test results:', JSON.stringify(guardTests, null, 2));
  
  // If we can auto-select, let's try to trigger it
  if (guardTests.autoSelectableOrg && !guardTests.hasCurrentOrg) {
    console.log(`🎯 Should auto-select: ${guardTests.autoSelectableOrg.name} (${guardTests.autoSelectReason})`);
    
    // Try to manually trigger organization selection
    const selectionResult = await page.evaluate((orgId) => {
      if (!window.authMachineActor) return { error: 'No auth actor' };
      
      console.log('[Test] Manually triggering organization selection:', orgId);
      window.authMachineActor.send({ type: 'SELECT_ORGANIZATION', organizationId: orgId });
      
      // Wait a moment and check the result
      return new Promise(resolve => {
        setTimeout(() => {
          const snapshot = window.authMachineActor.getSnapshot();
          resolve({
            newState: snapshot.value,
            hasOrg: !!snapshot.context.currentOrganization,
            orgName: snapshot.context.currentOrganization?.name
          });
        }, 2000);
      });
    }, guardTests.autoSelectableOrg.id);
    
    console.log('🔄 Manual selection result:', selectionResult);
  }
  
  // Final state check
  const finalState = await page.evaluate(() => {
    if (!window.authMachineActor) return { error: 'No auth actor' };
    
    const snapshot = window.authMachineActor.getSnapshot();
    return {
      state: snapshot.value,
      hasOrg: !!snapshot.context.currentOrganization,
      authStateToString: JSON.stringify(snapshot.value)
    };
  });
  
  console.log('🏁 Final auth state:', finalState);
  
  expect(true).toBe(true); // Always pass - diagnostic test
});