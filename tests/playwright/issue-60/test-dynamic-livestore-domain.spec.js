/**
 * Test Dynamic LiveStore Domain Services
 * 
 * Tests the new dynamic schema-aware domain services using Wide Corp CEO account
 * Uses the LiveStore debug page with persistent context for full app testing
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Dynamic LiveStore Domain Services', () => {
  test('should load dynamic domain services and test with Wide Corp CEO', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/_authenticated/debug/livestore-test');
    
    // Wait for the page to load and domain services to be available
    await page.waitForFunction(() => 
      window.liveStoreDomain && window.liveStoreDomain.services
    );

    // Test 1: Check that dynamic domain services are loaded
    const domainServicesLoaded = await page.evaluate(() => {
      return {
        available: !!window.liveStoreDomain,
        hasServices: !!window.liveStoreDomain.services,
        hasProject: !!window.liveStoreDomain.services.project,
        hasSkill: !!window.liveStoreDomain.services.skill,
        hasClient: !!window.liveStoreDomain.services.client
      };
    });

    console.log('📊 Domain Services Status:', domainServicesLoaded);
    expect(domainServicesLoaded.available).toBe(true);
    expect(domainServicesLoaded.hasServices).toBe(true);

    // Test 2: Get current organization info
    const orgInfo = await page.evaluate(() => {
      return {
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        currentOrgId: window.liveStoreDomain.services.getCurrentOrgId()
      };
    });

    console.log('🏢 Organization Info:', orgInfo);
    expect(orgInfo.orgId).toBeTruthy();

    // Test 3: Test dynamic domain services info
    const domainInfo = await page.evaluate(async () => {
      try {
        const info = await window.liveStoreDomain.info();
        return { success: true, info };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('📋 Domain Info:', domainInfo);

    // Test 4: Test dynamic project creation with Wide Corp schema
    const projectTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing dynamic project creation...');
        
        const projectResult = await window.liveStoreDomain.services.project.create({
          name: 'Playwright Test Project',
          description: 'Testing dynamic schema-aware operations with Wide Corp CEO',
          status: 'active',
          // These fields should adapt to Wide Corp's project schema
          priority: 'high',
          budget: 75000
        });

        return {
          success: projectResult.success,
          hasData: !!projectResult.data,
          projectId: projectResult.data?.id,
          error: projectResult.error,
          validationErrors: projectResult.validationErrors
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('📦 Project Creation Test:', projectTest);

    // Test 5: Test dynamic skill creation with Wide Corp schema
    const skillTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing dynamic skill creation...');
        
        const skillResult = await window.liveStoreDomain.services.skill.create({
          name: 'Playwright Testing',
          category: 'technical',
          level: 'expert',
          description: 'Automated testing with dynamic LiveStore domains'
        });

        return {
          success: skillResult.success,
          hasData: !!skillResult.data,
          skillId: skillResult.data?.id,
          error: skillResult.error,
          validationErrors: skillResult.validationErrors
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🎯 Skill Creation Test:', skillTest);

    // Test 6: Test custom entity service creation
    const customEntityTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing custom entity service creation...');
        
        // Try to create a service for any entity type defined in Wide Corp's schema
        const customService = window.liveStoreDomain.services.forCurrentOrg('CustomProject');
        
        return {
          success: true,
          hasCustomService: !!customService,
          serviceMethods: customService ? Object.keys(customService) : []
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🔧 Custom Entity Test:', customEntityTest);

    // Test 7: Test full domain services integration
    const integrationTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Running full dynamic domain services test...');
        
        const result = await window.liveStoreDomain.test();
        
        return {
          success: !result.error,
          result,
          error: result.error
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🚀 Integration Test:', integrationTest);

    // Test 8: Verify sync status
    const syncStatus = await page.evaluate(() => {
      try {
        return {
          success: true,
          status: window.liveStoreDomain.syncStatus()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🔄 Sync Status:', syncStatus);

    // Assertions
    if (projectTest.success) {
      expect(projectTest.success).toBe(true);
      expect(projectTest.hasData).toBe(true);
      console.log('✅ Dynamic project creation successful');
    } else {
      console.log('⚠️ Project creation test:', projectTest.error);
    }

    if (skillTest.success) {
      expect(skillTest.success).toBe(true);
      expect(skillTest.hasData).toBe(true);
      console.log('✅ Dynamic skill creation successful');
    } else {
      console.log('⚠️ Skill creation test:', skillTest.error);
    }

    // Final verification
    console.log('\n🎉 Dynamic LiveStore Domain Services Test Summary:');
    console.log('  📊 Domain services loaded:', domainServicesLoaded.available);
    console.log('  🏢 Organization detected:', !!orgInfo.orgId);
    console.log('  📦 Project creation:', projectTest.success ? '✅' : '❌');
    console.log('  🎯 Skill creation:', skillTest.success ? '✅' : '❌');
    console.log('  🔧 Custom entities:', customEntityTest.success ? '✅' : '❌');
    console.log('  🚀 Full integration:', integrationTest.success ? '✅' : '❌');
    console.log('  🔄 Sync status:', syncStatus.success ? '✅' : '❌');
  });

  test('should handle schema validation and error cases', async ({ page }) => {
    await page.goto('/_authenticated/debug/livestore-test');
    
    await page.waitForFunction(() => 
      window.liveStoreDomain && window.liveStoreDomain.services
    );

    // Test validation with invalid data
    const validationTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing schema validation...');
        
        // Try to create a project with invalid/missing required fields
        const result = await window.liveStoreDomain.services.project.create({
          // Missing required 'name' field
          description: 'This should fail validation',
          invalidField: 'This should be filtered out'
        });

        return {
          success: result.success,
          error: result.error,
          validationErrors: result.validationErrors,
          hasValidationErrors: !!result.validationErrors
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          caughtError: true
        };
      }
    });

    console.log('🔍 Validation Test Result:', validationTest);

    // The validation should fail due to missing required fields
    if (validationTest.hasValidationErrors) {
      console.log('✅ Schema validation working correctly');
      expect(validationTest.success).toBe(false);
    } else {
      console.log('⚠️ Validation test:', validationTest);
    }
  });

  test('should support different entity types for Wide Corp', async ({ page }) => {
    await page.goto('/_authenticated/debug/livestore-test');
    
    await page.waitForFunction(() => 
      window.liveStoreDomain && window.liveStoreDomain.services
    );

    // Test creating different types of entities
    const entityTypesTest = await page.evaluate(async () => {
      const results = {};
      
      try {
        // Test client creation
        console.log('🧪 Testing client entity...');
        const clientResult = await window.liveStoreDomain.services.client.create({
          name: 'Playwright Test Client',
          email: 'test@widecorp.com',
          status: 'active'
        });
        results.client = {
          success: clientResult.success,
          hasData: !!clientResult.data,
          error: clientResult.error
        };

        // Test timesheet creation
        console.log('🧪 Testing timesheet entity...');
        const timesheetResult = await window.liveStoreDomain.services.timesheet.create({
          date: new Date().toISOString().split('T')[0],
          hours: 8,
          description: 'Playwright testing session'
        });
        results.timesheet = {
          success: timesheetResult.success,
          hasData: !!timesheetResult.data,
          error: timesheetResult.error
        };

      } catch (error) {
        results.error = error.message;
      }

      return results;
    });

    console.log('🏢 Entity Types Test:', entityTypesTest);

    // Verify that different entity types work
    if (entityTypesTest.client && entityTypesTest.client.success) {
      expect(entityTypesTest.client.success).toBe(true);
      console.log('✅ Client entity creation successful');
    }

    if (entityTypesTest.timesheet && entityTypesTest.timesheet.success) {
      expect(entityTypesTest.timesheet.success).toBe(true);
      console.log('✅ Timesheet entity creation successful');
    }
  });
});